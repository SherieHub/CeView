-- V28 — Module 2 E2E, Step 2 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2).
--
-- Gives tbl_market_signal_record an explicit ISO-week identity so "one row per
-- (profile, category, market, week)" can be enforced by the database rather than
-- by application discipline alone.
--
-- Columns added (nullable — see note below):
--   iso_year         SMALLINT  — ISO-8601 week-based year (UTC), can differ from
--                                the Gregorian year at year boundaries.
--   iso_week         SMALLINT  — ISO-8601 week number, 1-53 (UTC).
--   week_start_date  DATE      — the Monday (UTC) that begins that ISO week.
-- Backfilled from the existing aggregated_at column, which every row already has
-- (MarketSignalRecord.onCreate() has always defaulted it), using Postgres's
-- built-in ISO-8601 week functions:
--   EXTRACT(ISOYEAR FROM ts)      -- ISO week-based year
--   EXTRACT(WEEK    FROM ts)      -- ISO week number (Postgres defines WEEK as ISO)
--   date_trunc('week', ts)::date  -- Postgres truncates 'week' to Monday, matching ISO
-- All three are computed against `aggregated_at AT TIME ZONE 'UTC'`, matching the
-- contract's UTC requirement regardless of the column's stored offset.
--
-- NOT NULL is intentionally NOT added in this migration. MarketDataIngestionService
-- does not yet populate these three fields on new rows (that lands in a later,
-- dedicated cadence step per the E2E plan) — enforcing NOT NULL now would make
-- every INSERT from the current, unmodified ingestion code fail. Postgres's
-- standard NULL semantics already give the constraint real teeth for every row
-- that DOES carry a value: a UNIQUE constraint never treats two NULLs as equal,
-- so rows missing the new key are simply exempt from it until a later step
-- starts populating them, rather than blocking ingestion in the meantime.
--
-- DEDUPLICATION — required before the unique constraint can be added. Existing
-- rows may include more than one observation for the same
-- (business_profile_id, category, target_market, iso_year, iso_week) tuple (e.g.
-- the daily cron writing a fresh row every day within one ISO week, before the
-- upsert behavior lands). Rule: keep the row with the latest aggregated_at per
-- tuple; ties are broken by the highest signal_record_id (arbitrary but
-- deterministic, so a rerun of a hypothetical repair script is reproducible).
-- Rows with a NULL category, target_market, iso_year or iso_week are exempt from
-- this collapse for the same NULL-never-equals-NULL reason as the constraint
-- itself — there is nothing to deduplicate among them by this key.
--
-- ROLLBACK NOTE:
--   DROP the unique constraint and the three columns (see below) to fully
--   reverse the additive part of this migration. The deduplication DELETE above
--   is NOT reversible — rows it removes are gone. If historical duplicate weeks
--   must be recovered, restore tbl_market_signal_record from the pre-deploy
--   backup instead of attempting to undo the DELETE.
--     ALTER TABLE tbl_market_signal_record DROP CONSTRAINT IF EXISTS uq_msr_profile_category_market_iso_week;
--     ALTER TABLE tbl_market_signal_record DROP COLUMN IF EXISTS iso_year;
--     ALTER TABLE tbl_market_signal_record DROP COLUMN IF EXISTS iso_week;
--     ALTER TABLE tbl_market_signal_record DROP COLUMN IF EXISTS week_start_date;
--
-- VERIFICATION (see the bottom of this file for the exact SELECTs).

-- ── Add the columns (nullable — see note above) ─────────────────────────────
ALTER TABLE tbl_market_signal_record
    ADD COLUMN IF NOT EXISTS iso_year        SMALLINT,
    ADD COLUMN IF NOT EXISTS iso_week        SMALLINT,
    ADD COLUMN IF NOT EXISTS week_start_date DATE;

-- ── Backfill from aggregated_at (UTC) ────────────────────────────────────────
UPDATE tbl_market_signal_record
   SET iso_year        = EXTRACT(ISOYEAR FROM aggregated_at AT TIME ZONE 'UTC')::SMALLINT,
       iso_week        = EXTRACT(WEEK    FROM aggregated_at AT TIME ZONE 'UTC')::SMALLINT,
       week_start_date = date_trunc('week', aggregated_at AT TIME ZONE 'UTC')::DATE
 WHERE aggregated_at IS NOT NULL
   AND iso_year IS NULL;

-- ── Collapse duplicate weeks, keeping the newest aggregated_at ──────────────
DELETE FROM tbl_market_signal_record msr
 USING (
   SELECT signal_record_id,
          ROW_NUMBER() OVER (
            PARTITION BY business_profile_id, category, target_market, iso_year, iso_week
            ORDER BY aggregated_at DESC, signal_record_id DESC
          ) AS rn
     FROM tbl_market_signal_record
 ) ranked
 WHERE msr.signal_record_id = ranked.signal_record_id
   AND ranked.rn > 1;

-- ── One row per (profile, category, market, ISO week) ───────────────────────
ALTER TABLE tbl_market_signal_record
    ADD CONSTRAINT uq_msr_profile_category_market_iso_week
        UNIQUE (business_profile_id, category, target_market, iso_year, iso_week);

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
-- 1. No duplicate (profile, category, market, iso_year, iso_week) groups remain
--    among rows that carry the new key (NULL-keyed rows are expected to repeat
--    and are excluded here on purpose — see the note above):
--      SELECT business_profile_id, category, target_market, iso_year, iso_week, COUNT(*)
--        FROM tbl_market_signal_record
--       WHERE iso_year IS NOT NULL AND iso_week IS NOT NULL
--       GROUP BY 1, 2, 3, 4, 5
--      HAVING COUNT(*) > 1;
--      -- expect 0 rows
--
-- 2. The new columns agree with aggregated_at (spot check):
--      SELECT signal_record_id, aggregated_at, iso_year, iso_week, week_start_date
--        FROM tbl_market_signal_record
--       WHERE iso_year IS NOT NULL
--       ORDER BY aggregated_at DESC
--       LIMIT 20;
--      -- week_start_date must be a Monday, on or before aggregated_at's date,
--      -- and no more than 6 days before it
--
-- 3. The constraint exists:
--      SELECT conname FROM pg_constraint WHERE conname = 'uq_msr_profile_category_market_iso_week';
--      -- expect exactly 1 row
