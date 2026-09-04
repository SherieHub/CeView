#!/usr/bin/env python3
"""Embed the Module 1 reference corpus and export it as an importable dump.

WHY A SCRIPT AND NOT SQL
V26__module1_reference_corpus.sql seeds the *text* of the corpus. The vectors
have to be produced by the same code path production uses — ml_classifier's
_build_text + embed_business — or they sit in a different region of the
embedding space than anything scored against them. A vector literal pasted
into SQL would silently rot the first time _build_text or the encoder changed;
regenerating from text cannot.

WHAT IT WRITES
backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql — INSERTs
for tbl_business_embedding only. The profile *text* is not dumped: V26 already
seeds it through Flyway, and duplicating it here would create two sources of
truth that could disagree. Import order is therefore: migrate (text) then
import (vectors).

HOW TO RUN
Inside the fastapi container, which already has the encoder and DATABASE_URL:

    docker exec -i ceview-fastapi python - < scripts/generate-reference-corpus.py

Or locally from backend/fastapi-sbert with the model cached and

    DATABASE_URL=postgresql://ceview:ceview@localhost:5433/ceview \
        python ../../scripts/generate-reference-corpus.py

IDEMPOTENT
upsert_embedding is ON CONFLICT DO UPDATE, so re-running after a corpus edit
refreshes vectors in place. Re-run it after ANY change to _build_text, the
encoder, or V26 — and regenerate the dump in the same pass, or the committed
dump and the code drift apart.

--all: RE-EMBED EVERY PROFILE, NOT JUST THE REFERENCE ROWS
Changing the embedding scheme (the E5 prefix, the _build_text layout, the
model) makes previously-stored vectors incomparable with new ones. Mean cosine
distance between two differently-built populations is dominated by the scheme,
not by the businesses — so a mixed table produces confident nonsense rather
than an error. Any machine that already had saved profiles will be mixed the
first time this script runs, because the reference rows get the new scheme and
the pre-existing tenant rows keep the old one. `--all` re-embeds tenant
profiles too, from text already in the database, and is the correct response
to any scheme change.

    docker exec -i ceview-fastapi python - --all < scripts/generate-reference-corpus.py

The dump is always reference-rows-only regardless of this flag: tenant profiles
belong to whoever created them and must never be shipped between machines.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Importable whether launched from the repo root or from backend/fastapi-sbert.
for candidate in (Path.cwd(), Path.cwd() / "backend" / "fastapi-sbert", Path("/app")):
    if (candidate / "app" / "services" / "ml_classifier.py").exists():
        sys.path.insert(0, str(candidate))
        break

from app.services import embedding_store, ml_classifier  # noqa: E402

DUMP_PATH = Path("backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql")

SELECT_PROFILES = """
    SELECT business_profile_id::text,
           business_name,
           COALESCE(core_services, ''),
           COALESCE(business_description, ''),
           COALESCE(uvp, '')
    FROM   tbl_business_profile
    WHERE  (%(all_profiles)s OR is_reference = TRUE)
    ORDER  BY is_reference DESC, business_profile_id
"""

COUNT_BY_VERSION = """
    SELECT embedding_model_version, COUNT(*)
    FROM   tbl_business_embedding
    GROUP  BY embedding_model_version
    ORDER  BY 2 DESC
"""

SELECT_REFERENCE_EMBEDDINGS = """
    SELECT e.business_profile_id::text,
           e.embedding_vector::text,
           e.embedding_model_version
    FROM   tbl_business_embedding e
    JOIN   tbl_business_profile p USING (business_profile_id)
    WHERE  p.is_reference = TRUE
    ORDER  BY e.business_profile_id
"""


def _query(sql: str, params: dict | None = None) -> list[tuple]:
    conn = embedding_store._connect()
    try:
        cur = conn.cursor()
        cur.execute(sql, params or {})
        rows = cur.fetchall()
        cur.close()
        return rows
    finally:
        conn.close()


def embed_all(all_profiles: bool) -> int:
    if ml_classifier._bert is None:
        raise SystemExit(
            "E5 encoder unavailable — refusing to write a partial corpus. "
            "Run inside ceview-fastapi, or ensure the model cache is present."
        )

    profiles = _query(SELECT_PROFILES, {"all_profiles": all_profiles})
    if not profiles:
        raise SystemExit(
            "No is_reference rows found. Apply V26__module1_reference_corpus.sql first."
        )

    for profile_id, name, core_services, description, uvp in profiles:
        services = [s.strip() for s in core_services.split(",") if s.strip()]
        vector = ml_classifier.embed_business(services, description, uvp)
        if not vector:
            raise SystemExit(f"embed_business returned nothing for {name} ({profile_id})")
        embedding_store.upsert_embedding(profile_id, vector)
        print(f"  embedded {name}")

    return len(profiles)


def report_scheme_mix() -> None:
    """Warn loudly when the table holds vectors from more than one scheme.

    A mixed table does not error — it silently produces distances dominated by
    the scheme difference rather than by the businesses, which is worse than a
    crash because it looks like a working score.
    """
    rows = _query(COUNT_BY_VERSION)
    print("\nembedding_model_version in tbl_business_embedding:")
    for version, count in rows:
        marker = "  <- current" if version == embedding_store.EMBEDDING_MODEL_VERSION else ""
        print(f"  {count:5d}  {version}{marker}")

    stale = [v for v, _ in rows if v != embedding_store.EMBEDDING_MODEL_VERSION]
    if stale:
        print(
            "\nWARNING: mixed-scheme corpus. Vectors built under "
            f"{stale} are not comparable with "
            f"{embedding_store.EMBEDDING_MODEL_VERSION}.\n"
            "         Re-run with --all to re-embed every profile from its stored text,\n"
            "         and make sure the cohort query filters on embedding_model_version."
        )


def write_dump() -> int:
    conn = embedding_store._connect()
    try:
        cur = conn.cursor()
        cur.execute(SELECT_REFERENCE_EMBEDDINGS)
        rows = cur.fetchall()
        cur.close()
    finally:
        conn.close()

    if not rows:
        raise SystemExit("No reference embeddings to dump — run the embed step first.")

    versions = {version for _, _, version in rows}
    if len(versions) > 1:
        raise SystemExit(
            f"Refusing to dump a mixed-scheme corpus: {sorted(versions)}. "
            "Vectors built with different embedding_model_versions are not comparable."
        )

    DUMP_PATH.parent.mkdir(parents=True, exist_ok=True)
    with DUMP_PATH.open("w", encoding="utf-8", newline="\n") as fh:
        fh.write(
            "-- Module 1 uniqueness reference corpus — EMBEDDINGS ONLY.\n"
            "--\n"
            "-- Generated by scripts/generate-reference-corpus.py. Do not hand-edit:\n"
            "-- these vectors must match ml_classifier._build_text exactly, and the\n"
            "-- only way to keep that true is to regenerate.\n"
            "--\n"
            "-- The profile TEXT lives in V26__module1_reference_corpus.sql and is\n"
            "-- applied by Flyway. Import order:\n"
            "--     1. ./mvnw flyway:migrate                (seeds the text)\n"
            f"--     2. psql \"$DATABASE_URL\" -f {DUMP_PATH.as_posix()}\n"
            "--\n"
            f"-- embedding_model_version: {versions.pop()}\n"
            f"-- rows: {len(rows)}\n"
            "--\n"
            "-- Every developer on the uniqueness-scoring plan must import this same\n"
            "-- dump. Scores are only reproducible across machines if the corpus is\n"
            "-- byte-identical.\n\n"
        )
        for profile_id, vector, version in rows:
            fh.write(
                "INSERT INTO tbl_business_embedding "
                "(embedding_id, business_profile_id, embedding_vector, embedding_model_version)\n"
                f"VALUES (gen_random_uuid(), '{profile_id}', '{vector}'::vector, '{version}')\n"
                "ON CONFLICT (business_profile_id) DO UPDATE SET\n"
                "    embedding_vector        = EXCLUDED.embedding_vector,\n"
                "    embedding_model_version = EXCLUDED.embedding_model_version,\n"
                "    generated_at            = NOW();\n"
            )

    return len(rows)


def main() -> None:
    all_profiles = "--all" in sys.argv
    print(f"DATABASE_URL: {'set' if os.environ.get('DATABASE_URL') else 'MISSING'}")
    print(f"Embedding {'ALL' if all_profiles else 'reference'} profiles…")
    embedded = embed_all(all_profiles)
    print(f"Embedded {embedded} profiles. Writing dump…")
    dumped = write_dump()
    print(f"Wrote {dumped} reference rows to {DUMP_PATH}")
    report_scheme_mix()


if __name__ == "__main__":
    main()
