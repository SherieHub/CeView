-- V29 — Module 2 E2E, Step 2 (docs/module-2/MODULE_2_E2E_CONTRACT.md §6-§7).
--
-- tbl_demand_alert today is reachable by tenant only through a 3-table join
-- (demand_alert -> market_score -> forecast_result), which every read has to
-- repeat. This migration denormalizes the owning profile and category directly
-- onto the alert, and adds the uplift percentage the alert's own message needs.
--
-- Columns added:
--   business_profile_id  UUID              — FK to tbl_business_profile, backfilled
--                                             via the existing market_score/
--                                             forecast_result join. Nullable (see
--                                             note below), so the FK constraint
--                                             only checks rows that have a value.
--   category              VARCHAR(100)     — backfilled from
--                                             tbl_forecast_result.category via the
--                                             same join. Nullable for the same
--                                             reason, and because pre-V20 forecast
--                                             rows can themselves have a null
--                                             category.
--   uplift_pct             DOUBLE PRECISION — left NULL for every historical row.
--                                             There is no honest way to reconstruct
--                                             the uplift a past alert represented
--                                             without inventing a number, and the
--                                             contract explicitly forbids treating
--                                             the old fixed 20% threshold as if it
--                                             were a measured value.
--
-- NOT NULL is intentionally NOT added to business_profile_id or category, even
-- though the backfill below is expected to succeed for every existing row (both
-- market_score_id -> tbl_market_score and forecast_result_id -> tbl_forecast_result
-- are enforced foreign keys per V1, so the join cannot silently miss). The
-- reason is the same as V28's: ForecastingService.persistDemandAlert does not yet
-- set these fields on newly created alerts (that lands in a later, dedicated
-- alert-rules step), and a NOT NULL constraint today would break that insert path
-- immediately on the next forecast run.
--
-- ROLLBACK NOTE:
--   The backfilled data is fully re-derivable from the market_score/forecast_result
--   join at any time, so this migration is safe to reverse without any data-loss
--   caveat (unlike V27/V28):
--     DROP INDEX IF EXISTS idx_demand_alert_profile_date;
--     ALTER TABLE tbl_demand_alert DROP CONSTRAINT IF EXISTS fk_demand_alert_business_profile;
--     ALTER TABLE tbl_demand_alert DROP COLUMN IF EXISTS business_profile_id;
--     ALTER TABLE tbl_demand_alert DROP COLUMN IF EXISTS category;
--     ALTER TABLE tbl_demand_alert DROP COLUMN IF EXISTS uplift_pct;
--
-- VERIFICATION (see the bottom of this file for the exact SELECTs).

-- ── Add the columns ──────────────────────────────────────────────────────────
ALTER TABLE tbl_demand_alert
    ADD COLUMN IF NOT EXISTS business_profile_id UUID,
    ADD COLUMN IF NOT EXISTS category             VARCHAR(100),
    ADD COLUMN IF NOT EXISTS uplift_pct           DOUBLE PRECISION;

ALTER TABLE tbl_demand_alert
    ADD CONSTRAINT fk_demand_alert_business_profile
        FOREIGN KEY (business_profile_id) REFERENCES tbl_business_profile(business_profile_id)
        ON DELETE CASCADE;

-- ── Backfill business_profile_id and category via the existing join ─────────
-- uplift_pct is deliberately left NULL — see the header note.
UPDATE tbl_demand_alert da
   SET business_profile_id = fr.business_profile_id,
       category            = fr.category
  FROM tbl_market_score ms
  JOIN tbl_forecast_result fr ON fr.forecast_result_id = ms.forecast_result_id
 WHERE da.market_score_id = ms.market_score_id
   AND da.business_profile_id IS NULL;

-- ── Every tenant-scoped alert read filters/orders by (profile, date) ────────
CREATE INDEX IF NOT EXISTS idx_demand_alert_profile_date
    ON tbl_demand_alert (business_profile_id, alert_date DESC);

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
-- 1. Every pre-existing alert resolved a profile (uplift_pct stays null by design):
--      SELECT COUNT(*) AS unresolved FROM tbl_demand_alert WHERE business_profile_id IS NULL;
--      -- expect 0, for rows that existed before this migration
--
-- 2. Spot check the backfilled values against the join directly:
--      SELECT da.demand_alert_id, da.business_profile_id, da.category, da.uplift_pct,
--             fr.business_profile_id AS via_join_profile, fr.category AS via_join_category
--        FROM tbl_demand_alert da
--        JOIN tbl_market_score ms ON ms.market_score_id = da.market_score_id
--        JOIN tbl_forecast_result fr ON fr.forecast_result_id = ms.forecast_result_id
--       ORDER BY da.alert_date DESC
--       LIMIT 20;
--      -- business_profile_id/category must equal via_join_profile/via_join_category on every row
--
-- 3. The index and FK exist:
--      SELECT indexname FROM pg_indexes WHERE indexname = 'idx_demand_alert_profile_date';
--      SELECT conname FROM pg_constraint WHERE conname = 'fk_demand_alert_business_profile';
--      -- expect exactly 1 row each
