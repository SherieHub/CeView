-- V12: Resize tbl_business_embedding.embedding_vector from 384 → 768 dims to match
--       the intfloat/multilingual-e5-base encoder used in fastapi-sbert, and add an
--       HNSW index for fast cosine-distance queries (Module 1 uniqueness corpus search).

-- Step 1: Drop the 384-dim column (existing data is unusable with the 768-dim encoder)
ALTER TABLE tbl_business_embedding
    DROP COLUMN IF EXISTS embedding_vector;

-- Step 2: Add correctly-sized column
ALTER TABLE tbl_business_embedding
    ADD COLUMN embedding_vector vector(768);

-- Step 3: HNSW index — enables sub-linear cosine similarity search via pgvector
CREATE INDEX IF NOT EXISTS idx_biz_emb_cosine
    ON tbl_business_embedding
    USING hnsw (embedding_vector vector_cosine_ops);

-- Step 4: Ensure unique constraint on business_profile_id so upserts work cleanly
ALTER TABLE tbl_business_embedding
    DROP CONSTRAINT IF EXISTS uq_biz_emb_profile;

ALTER TABLE tbl_business_embedding
    ADD CONSTRAINT uq_biz_emb_profile UNIQUE (business_profile_id);
