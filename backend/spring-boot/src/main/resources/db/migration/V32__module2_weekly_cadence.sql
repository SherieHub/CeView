-- V32 — Module 2 E2E, Step 4 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-03).
--
-- Closes the gap V28 deliberately left open: iso_year/iso_week/week_start_date
-- become NOT NULL now that MarketDataIngestionService always populates them
-- explicitly (via java.time.temporal.WeekFields.ISO — never dayOfYear/7+1), and
-- MarketSignalRecord's @PrePersist/@PreUpdate also derives them as a safety net
-- for any writer that doesn't set them itself. Adds first_seen_at — the "when
-- was this ISO week's row first created" timestamp the weekly upsert's merge
-- rule needs: unlike aggregated_at/source_fetched_at, a same-week re-ingest
-- must never move it.
--
-- ROLLBACK NOTE:
--   ALTER TABLE tbl_market_signal_record ALTER COLUMN iso_year        DROP NOT NULL;
--   ALTER TABLE tbl_market_signal_record ALTER COLUMN iso_week        DROP NOT NULL;
--   ALTER TABLE tbl_market_signal_record ALTER COLUMN week_start_date DROP NOT NULL;
--   ALTER TABLE tbl_market_signal_record DROP COLUMN IF EXISTS first_seen_at;
--   (Safe: relaxing NOT NULL destroys nothing, and first_seen_at only ever
--   mirrors aggregated_at for rows that predate this column.)
--
-- VERIFICATION (see the bottom of this file for the exact SELECTs).

ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ;

-- Backfill any row still missing one — either a genuinely pre-Step-4 row, or
-- one written between V28's deploy and this step's code landing. aggregated_at
-- is the best available approximation of "first seen" for those.
UPDATE tbl_market_signal_record
   SET first_seen_at = aggregated_at
 WHERE first_seen_at IS NULL;

-- V28 already backfilled iso_year/iso_week/week_start_date for every row that
-- existed at its own deploy time; this catches any row written since then by
-- code that predates this step (same ISO-week math V28 used).
UPDATE tbl_market_signal_record
   SET iso_year        = EXTRACT(ISOYEAR FROM aggregated_at AT TIME ZONE 'UTC')::SMALLINT,
       iso_week        = EXTRACT(WEEK    FROM aggregated_at AT TIME ZONE 'UTC')::SMALLINT,
       week_start_date = date_trunc('week', aggregated_at AT TIME ZONE 'UTC')::DATE
 WHERE iso_year IS NULL OR iso_week IS NULL OR week_start_date IS NULL;

ALTER TABLE tbl_market_signal_record
    ALTER COLUMN first_seen_at    SET NOT NULL,
    ALTER COLUMN iso_year         SET NOT NULL,
    ALTER COLUMN iso_week         SET NOT NULL,
    ALTER COLUMN week_start_date  SET NOT NULL;

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
--      SELECT COUNT(*) FROM tbl_market_signal_record
--       WHERE iso_year IS NULL OR iso_week IS NULL OR week_start_date IS NULL
--          OR first_seen_at IS NULL;
--      -- expect 0
--
--      SELECT business_profile_id, category, target_market, iso_year, iso_week, COUNT(*)
--        FROM tbl_market_signal_record GROUP BY 1,2,3,4,5 HAVING COUNT(*) > 1;
--      -- expect 0 (uq_msr_profile_category_market_iso_week, added in V28,
--      -- already enforces this going forward)
--
--      -- After a Refresh forecast run for a seeded operator, confirm the
--      -- weekly upsert actually updated in place rather than inserting:
--      SELECT business_profile_id, category, target_market, iso_year, iso_week,
--             first_seen_at, aggregated_at
--        FROM tbl_market_signal_record
--       WHERE iso_year = EXTRACT(ISOYEAR FROM NOW() AT TIME ZONE 'UTC')
--         AND iso_week = EXTRACT(WEEK    FROM NOW() AT TIME ZONE 'UTC');
--      -- first_seen_at should predate aggregated_at once the same week has
--      -- been ingested twice; both should postdate first ingestion otherwise
