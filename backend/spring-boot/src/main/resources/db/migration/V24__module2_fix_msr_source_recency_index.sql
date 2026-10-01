-- V24 — Realign idx_msr_source_recency with the query Task 12 runs against it.
--
-- V22 shipped this index as
--   (business_profile_id, target_market, source, aggregated_at DESC)
-- with a comment claiming it serves "profile+category+market" lookups — but it
-- has no `category` column, so EnrichedSequenceBuilder.findRealByProfileAndMarket
-- (which filters by business_profile_id + category + target_market + source and
-- orders by aggregated_at DESC) cannot use it as a covering index.
--
-- V20 already established the correct grid key on this table:
--   idx_msr_profile_category_market (business_profile_id, category, target_market)
-- This migration recreates the recency index to match, with `source` and the
-- descending timestamp appended so the real-only, newest-first read is a single
-- index range scan.
--
-- V22 is already applied to the live database, so it is not edited in place.

DROP INDEX IF EXISTS idx_msr_source_recency;

CREATE INDEX IF NOT EXISTS idx_msr_source_recency
    ON tbl_market_signal_record
       (business_profile_id, category, target_market, source, aggregated_at DESC);
