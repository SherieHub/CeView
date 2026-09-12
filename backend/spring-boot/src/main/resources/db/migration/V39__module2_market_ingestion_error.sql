-- V39 — Module 2 E2E, Step 18 (C-21, C-22, C-23; H-11).
--
-- The stale-data banner needs to say WHY a market's data hasn't refreshed —
-- "Latest attempt failed — {cause}" — but Step 16 retired the only thing that
-- ever recorded a per-market fetch failure (TrendFetchSchedulerService wrote
-- tbl_trend_fetch_job; MarketDataIngestionService's per-profile catch block
-- only logs, it never persists). This table is that missing per-(profile,
-- category, market) "last ingestion failure" record: upserted on a failed
-- ingestMarket() call, deleted on the next successful one for that same key —
-- so a non-null row always means "the MOST RECENT attempt failed", never a
-- stale error masking a since-recovered market.
--
-- Synthetic UUID PK (matches this schema's existing convention, e.g.
-- tbl_market_signal_record) rather than a composite key, so the JPA entity
-- needs no @IdClass/@EmbeddedId — the natural key is enforced separately.
--
-- ROLLBACK NOTE:
--   DROP TABLE IF EXISTS tbl_market_ingestion_error;
--   (Safe — purely diagnostic; nothing else derives from it.)
--
-- VERIFICATION (run manually after deploy; not executed by Flyway):
--   SELECT business_profile_id, category, target_market, error_message, occurred_at
--     FROM tbl_market_ingestion_error
--    ORDER BY occurred_at DESC
--    LIMIT 20;

CREATE TABLE tbl_market_ingestion_error (
    ingestion_error_id   UUID         PRIMARY KEY,
    business_profile_id  UUID         NOT NULL,
    category             VARCHAR(120) NOT NULL,
    target_market        VARCHAR(60)  NOT NULL,
    error_message        TEXT         NOT NULL,
    occurred_at          TIMESTAMPTZ  NOT NULL,
    CONSTRAINT uq_mie_profile_category_market UNIQUE (business_profile_id, category, target_market)
);
