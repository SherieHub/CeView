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


def fetch_others(exclude_profile_id: str = "") -> List[List[float]]:
    """Return all stored 768-dim vectors except *exclude_profile_id*'s own.

    Used during uniqueness scoring to build the comparison corpus.  Returns an
    empty list when the DB is unreachable or the table has no rows.

    Args:
        exclude_profile_id: UUID string to exclude (the current business's own
                            saved embedding so it is not compared against itself).
                            Pass "" or None to include all rows.

    Returns:
        List of 768-element float lists, one per stored business profile.
    """
    try:
        conn = _connect()
        cur = conn.cursor()

        if exclude_profile_id:
            cur.execute(
                """
                SELECT embedding_vector::text
                FROM   tbl_business_embedding
                WHERE  embedding_vector IS NOT NULL
                  AND  business_profile_id != %s::uuid
                """,
                (exclude_profile_id,),
            )
        else:
            cur.execute(
                """
                SELECT embedding_vector::text
                FROM   tbl_business_embedding
                WHERE  embedding_vector IS NOT NULL
                """
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
