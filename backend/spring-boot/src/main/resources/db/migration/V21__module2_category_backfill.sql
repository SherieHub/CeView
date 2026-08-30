-- V21 — Backfill category onto Module 2 rows seeded before V20.
--
-- V18 inserted signal/forecast rows with no category column in existence, so
-- every seeded row has category = NULL. The dashboard filters alerts by
-- profile.categories.includes(alert.category), so without this backfill the
-- seeded demo operators see an empty alert feed.
--
-- tbl_business_profile.categories is a plain text column (one category per
-- seeded profile). split_part(...,',',1) takes the first entry, which is exact
-- for single-category seed data and a defensible primary for any future
-- comma-separated value. Only NULL rows are touched, so this is idempotent and
-- never overwrites a category written by the live ingestion path.

UPDATE tbl_market_signal_record msr
   SET category = btrim(split_part(bp.categories, ',', 1))
  FROM tbl_business_profile bp
 WHERE msr.business_profile_id = bp.business_profile_id
   AND msr.category IS NULL
   AND bp.categories IS NOT NULL
   AND btrim(bp.categories) <> '';

UPDATE tbl_forecast_result fr
   SET category = btrim(split_part(bp.categories, ',', 1))
  FROM tbl_business_profile bp
 WHERE fr.business_profile_id = bp.business_profile_id
   AND fr.category IS NULL
   AND bp.categories IS NOT NULL
   AND btrim(bp.categories) <> '';
