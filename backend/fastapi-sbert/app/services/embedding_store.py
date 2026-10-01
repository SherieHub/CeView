"""
Embedding store — thin psycopg2 wrapper for tbl_business_embedding.

Responsible for:
  - upsert_embedding(): write a 768-dim E5 vector for a saved business profile
  - fetch_others():     read all stored vectors except (optionally) the caller's own

The module is intentionally dependency-free of FastAPI/ML code so it can be imported
early without triggering model loads.  It degrades gracefully when DATABASE_URL is not
set (returns empty list / logs a warning).
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import List

log = logging.getLogger("module1.embedding_store")

_DATABASE_URL: str = os.environ.get("DATABASE_URL", "")

# Identifies the scheme that produced a stored vector, not just the model.
# Vectors written with and without the E5 instruction prefix are NOT comparable
# — mean cosine distance between the two populations is dominated by the prefix
# rather than by the businesses. Bumping this on any change to
# ml_classifier._build_text is what makes a mixed corpus detectable instead of
# silently wrong; see 01-prerequisites.md Task 1.
EMBEDDING_MODEL_VERSION = "intfloat/multilingual-e5-base+e5prefix"


# ── lazy connection helper ─────────────────────────────────────────────────────

def _connect():
    """Open a new psycopg2 connection.  Raises RuntimeError when URL is absent."""
    if not _DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL not set — embedding store is unavailable. "
            "Add DATABASE_URL to the fastapi-sbert environment in docker-compose."
        )
    import psycopg2  # deferred so the module loads even without the driver installed
    return psycopg2.connect(_DATABASE_URL)


# ── public API ─────────────────────────────────────────────────────────────────

def upsert_embedding(business_profile_id: str, vector: List[float]) -> None:
    """Insert or replace the 768-dim embedding for *business_profile_id*.

    Uses an ON CONFLICT … DO UPDATE so re-saving an existing profile refreshes
    the vector in place (the unique constraint uq_biz_emb_profile on
    tbl_business_embedding guarantees at most one row per profile).

    Args:
        business_profile_id: UUID string of the saved business profile.
        vector:              768-element float list produced by the E5 encoder.
    """
    if not business_profile_id or not vector:
        log.warning("embedding_store.upsert: skipped — empty profile_id or vector")
        return

    try:
        conn = _connect()
        cur = conn.cursor()
        # pgvector expects the vector as a string literal '[f1,f2,…]'
        vec_str = "[" + ",".join(f"{v:.8f}" for v in vector) + "]"
        cur.execute(
            """
            INSERT INTO tbl_business_embedding
                (embedding_id, business_profile_id, embedding_vector, embedding_model_version)
            VALUES (%s, %s, %s::vector, %s)
            ON CONFLICT (business_profile_id)
            DO UPDATE SET
                embedding_vector       = EXCLUDED.embedding_vector,
                embedding_model_version = EXCLUDED.embedding_model_version,
                generated_at           = NOW()
            """,
            (
                str(uuid.uuid4()),
                business_profile_id,
                vec_str,
                EMBEDDING_MODEL_VERSION,
            ),
        )
        conn.commit()
        cur.close()
        conn.close()
        log.info("embedding_store: stored embedding for profile %s", business_profile_id)
    except Exception as exc:
        log.warning(
            "embedding_store.upsert: failed for profile %s — %s",
            business_profile_id,
            exc,
            extra={"code": "MOD1_EMBED_STORE_FAIL"},
        )


def fetch_others(
    exclude_profile_id: str = "",
    categories: list[str] | None = None,
) -> List[List[float]]:
    """Return stored 768-dim vectors for the cohort, except *exclude_profile_id*'s own.

    Used during uniqueness scoring to build the comparison corpus.  Returns an
    empty list when the DB is unreachable or the table has no rows.

    Args:
        exclude_profile_id: UUID string to exclude (the current business's own
                            saved embedding so it is not compared against itself).
                            Pass "" or None to include all rows.
        categories:         when non-empty, restricts the cohort to profiles
                            sharing at least one of these categories — the
                            screen's "against the local cohort in those
                            categories" claim (02-scoring-math.md Task 7).
                            `tbl_business_profile.categories` is comma-joined
                            TEXT, not a join table
                            (V2__module1_profile_multi_category.sql), so
                            matching is containment via `string_to_array`, not
                            an `IN` clause. Pass None or [] for the old
                            unfiltered behaviour.

                            Deliberately includes `is_reference = TRUE` rows
                            AND real tenant rows with a saved embedding: an
                            operator is being compared against the Cebu
                            market as a whole, not just the seeded corpus —
                            CohortContext's "sharpens as more operators join"
                            copy depends on tenant rows counting here. This
                            resolves the "open item for Dev B" left in
                            01-prerequisites.md. Every OTHER read in this
                            codebase must still exclude reference rows from
                            tenant-scoped results; this function is the one
                            deliberate exception.

    Returns:
        List of 768-element float lists, one per stored business profile.
    """
    try:
        conn = _connect()
        cur = conn.cursor()

        conditions = ["be.embedding_vector IS NOT NULL"]
        params: list = []

        if categories:
            conditions.append("string_to_array(bp.categories, ',') && %s::text[]")
            params.append(categories)

        if exclude_profile_id:
            conditions.append("be.business_profile_id != %s::uuid")
            params.append(exclude_profile_id)

        cur.execute(
            f"""
            SELECT be.embedding_vector::text
            FROM   tbl_business_embedding be
            JOIN   tbl_business_profile bp
                   ON bp.business_profile_id = be.business_profile_id
            WHERE  {' AND '.join(conditions)}
            """,
            params,
        )

        rows = cur.fetchall()
        cur.close()
        conn.close()

        embeddings: List[List[float]] = []
        for (vec_text,) in rows:
            try:
                # pgvector returns the vector as '[f1,f2,…]'
                parsed = json.loads(vec_text)
                if isinstance(parsed, list) and len(parsed) == 768:
                    embeddings.append([float(x) for x in parsed])
                else:
                    log.debug("embedding_store.fetch: skipped malformed row (len=%d)", len(parsed))
            except Exception as parse_exc:
                log.debug("embedding_store.fetch: could not parse row — %s", parse_exc)

        log.info(
            "embedding_store.fetch_others: returning %d embeddings (excluded=%s)",
            len(embeddings),
            exclude_profile_id or "none",
        )
        return embeddings

    except RuntimeError as rt:
        # DATABASE_URL not set — expected in dev/test without Docker
        log.info("embedding_store.fetch_others: %s — returning []", rt)
        return []
    except Exception as exc:
        log.warning(
            "embedding_store.fetch_others: DB error — %s",
            exc,
            extra={"code": "MOD1_EMBED_FETCH_FAIL"},
        )
        return []


# Category share of the total corpus, above/below which a cohort counts as
# dense/sparse rather than moderate. Derived from a category's share of the
# whole corpus rather than a hardcoded list of category names, so this does
# not go stale the first time the corpus grows — see 02-scoring-math.md Task 8.
# On the seeded corpus (64 rows: 12/12/12/9/9/5/5) these fall cleanly either
# side of every category's actual share, with no category landing near a
# boundary.
_DENSE_SHARE = 0.15
_SPARSE_SHARE = 0.10


def fetch_cohort_stats(
    categories: list[str] | None = None,
    exclude_profile_id: str = "",
) -> dict:
    """Return `cohortSize` and `categoryDensity` for the cohort `fetch_others`
    would build with the same arguments.

    This is a separate, cheap COUNT query rather than len(fetch_others(...))
    so the caller is not forced to fetch every vector just to report a size —
    Tasks 16/17 (frontend) need these numbers to disclose the cohort and
    reassure with, and they come from the same category filter Task 7 already
    defines.

    `cohortMedianScore` is NOT computed here — it is the median of each
    cohort member's own distance-based score, which needs the pairwise
    distance matrix `ml_classifier.compute_semantic_uniqueness` already
    builds (see `SemanticUniqueness.cohort_scores`). Computing it here would
    mean a second, redundant pass over the corpus, and would require this
    module to import `ml_classifier` — which it deliberately does not do (see
    the module docstring: dependency-free of ML code so it loads without
    triggering a model load). The router assembles the two pieces together.

    Args:
        categories:         same semantics as `fetch_others` — non-empty
                            restricts to profiles sharing at least one of
                            these categories; empty/None counts the whole
                            corpus.
        exclude_profile_id: excluded from the count, matching `fetch_others`.

    Returns:
        {"cohortSize": int, "categoryDensity": "dense" | "moderate" | "sparse"}
        Zeros/"" gracefully when the DB is unreachable, matching
        `fetch_others`'s empty-list-on-failure convention.
    """
    try:
        conn = _connect()
        cur = conn.cursor()

        conditions = ["be.embedding_vector IS NOT NULL"]
        params: list = []
        if categories:
            conditions.append("string_to_array(bp.categories, ',') && %s::text[]")
            params.append(categories)
        if exclude_profile_id:
            conditions.append("be.business_profile_id != %s::uuid")
            params.append(exclude_profile_id)

        cur.execute(
            f"""
            SELECT COUNT(*)
            FROM   tbl_business_embedding be
            JOIN   tbl_business_profile bp
                   ON bp.business_profile_id = be.business_profile_id
            WHERE  {' AND '.join(conditions)}
            """,
            params,
        )
        cohort_size = int(cur.fetchone()[0])

        total_conditions = ["embedding_vector IS NOT NULL"]
        total_params: list = []
        if exclude_profile_id:
            total_conditions.append("business_profile_id != %s::uuid")
            total_params.append(exclude_profile_id)
        cur.execute(
            f"SELECT COUNT(*) FROM tbl_business_embedding WHERE {' AND '.join(total_conditions)}",
            total_params,
        )
        total_size = int(cur.fetchone()[0])

        cur.close()
        conn.close()

        share = (cohort_size / total_size) if total_size > 0 else 0.0
        if share >= _DENSE_SHARE:
            density = "dense"
        elif share < _SPARSE_SHARE:
            density = "sparse"
        else:
            density = "moderate"

        log.info(
            "embedding_store.fetch_cohort_stats: size=%d share=%.3f density=%s",
            cohort_size,
            share,
            density,
        )
        return {"cohortSize": cohort_size, "categoryDensity": density}

    except RuntimeError as rt:
        log.info("embedding_store.fetch_cohort_stats: %s — returning zeros", rt)
        return {"cohortSize": 0, "categoryDensity": "sparse"}
    except Exception as exc:
        log.warning(
            "embedding_store.fetch_cohort_stats: DB error — %s",
            exc,
            extra={"code": "MOD1_EMBED_FETCH_FAIL"},
        )
        return {"cohortSize": 0, "categoryDensity": "sparse"}
