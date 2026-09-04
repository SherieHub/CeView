"""
Backfill tbl_business_embedding for every business profile that lacks one.

MUST run inside the ceview-fastapi container: that is where the E5 encoder
(intfloat/multilingual-e5-base, 1.1GB) and DATABASE_URL both live.

    docker cp scripts/mock-data/generate_embeddings.py ceview-fastapi:/tmp/
    docker exec ceview-fastapi python /tmp/generate_embeddings.py

It deliberately reuses the application's own modules rather than
reimplementing the encode step, so the stored vectors are bit-identical to
what a real profile save would have produced:

  * ml_classifier._build_text  -- the exact "services/uvp/description" format
  * ml_classifier._bert.encoder with normalize_embeddings=True
  * embedding_store.upsert_embedding -- the same ON CONFLICT upsert

Getting this wrong is not a cosmetic problem.  Random or differently-formatted
vectors sit at a mean cosine distance near 1.0, which pins every uniqueness
score at 100 -- indistinguishable from the empty-corpus default this script
exists to fix.
"""

from __future__ import annotations

import os
import sys

BATCH = 16


def main() -> int:
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn:
        print("DATABASE_URL is not set -- run this inside the ceview-fastapi container.",
              file=sys.stderr)
        return 1

    import psycopg2

    sys.path.insert(0, "/app")
    from app.core.BertModel import E5_MODEL_ID
    from app.services import embedding_store, ml_classifier

    if ml_classifier._bert is None:
        print("E5 encoder failed to load -- cannot generate embeddings.", file=sys.stderr)
        return 1

    only_missing = "--all" not in sys.argv
    where = (
        """WHERE NOT EXISTS (
                 SELECT 1 FROM tbl_business_embedding e
                 WHERE e.business_profile_id = p.business_profile_id)"""
        if only_missing else ""
    )

    conn = psycopg2.connect(dsn)
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT business_profile_id, business_name,
                   COALESCE(core_services, ''), COALESCE(business_description, ''),
                   COALESCE(uvp, '')
            FROM tbl_business_profile p
            {where}
            ORDER BY created_at
        """)
        rows = cur.fetchall()
    conn.close()

    if not rows:
        print("Nothing to do -- every profile already has an embedding.")
        return 0

    print(f"Encoding {len(rows)} profile(s) with {E5_MODEL_ID} ...")

    encoder = ml_classifier._bert.encoder
    written = failed = 0

    for start in range(0, len(rows), BATCH):
        chunk = rows[start:start + BATCH]
        texts = []
        for _pid, _name, services, description, uvp in chunk:
            service_list = [s.strip() for s in services.split(",") if s.strip()]
            # Argument order matters: _build_text(core_services, uvp, description)
            texts.append(ml_classifier._build_text(service_list, uvp, description))

        vectors = encoder.encode(texts, normalize_embeddings=True)

        for (pid, name, *_), vector in zip(chunk, vectors):
            vec = [float(v) for v in vector]
            if len(vec) != 768:
                print(f"  ! {name}: got {len(vec)} dims, expected 768 -- skipped")
                failed += 1
                continue
            embedding_store.upsert_embedding(str(pid), vec)
            written += 1

        done = min(start + BATCH, len(rows))
        print(f"  {done}/{len(rows)} encoded")

    # upsert_embedding swallows its own errors, so verify against the table.
    conn = psycopg2.connect(dsn)
    with conn.cursor() as cur:
        cur.execute("SELECT count(*) FROM tbl_business_embedding WHERE embedding_vector IS NOT NULL")
        stored = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM tbl_business_profile")
        profiles = cur.fetchone()[0]
    conn.close()

    print(f"\nAttempted {written}, skipped {failed}.")
    print(f"tbl_business_embedding now holds {stored} vectors for {profiles} profiles.")
    if stored < 3:
        print("WARNING: fewer than 3 vectors -- the <3 corpus guard will still return 100.")
    return 0 if stored >= 3 else 1


if __name__ == "__main__":
    raise SystemExit(main())
