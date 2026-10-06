-- Removes the seeded demo data from a production database. Run by
-- scripts/init-data.sh (docs/DEPLOY_AWS.md B13); safe to run again.
--
-- The 9 demo operators (V2, emails @ceview.local) have their plaintext
-- passwords published in SEED_CREDENTIALS.md, so they must not exist in prod.
-- Their profiles (20000000-…) carry the V15/V18/V40 demo rows.
--
-- Nearly every tenant table references tbl_business_profile with ON DELETE
-- CASCADE, and tbl_business_profile references tbl_msme_operator the same way,
-- so deleting the profiles removes their campaigns, signals, forecasts, scores,
-- alerts, content, embeddings, ad connections and attribution rows. The two
-- tables below carry business_profile_id without a foreign key, so they are
-- cleared explicitly first.
--
-- The 64 reference-corpus profiles (25000000-…, is_reference = TRUE) have no
-- operator, so the join below can never select them.

BEGIN;

CREATE TEMP TABLE demo_profile ON COMMIT DROP AS
SELECT bp.business_profile_id
FROM tbl_business_profile bp
JOIN tbl_msme_operator o ON o.operator_id = bp.user_id
WHERE o.email LIKE '%@ceview.local'
  AND bp.is_reference = FALSE;

DELETE FROM tbl_market_ingestion_error
WHERE business_profile_id IN (SELECT business_profile_id FROM demo_profile);

DELETE FROM tbl_ad_oauth_state
WHERE business_profile_id IN (SELECT business_profile_id FROM demo_profile);

DELETE FROM tbl_business_profile
WHERE business_profile_id IN (SELECT business_profile_id FROM demo_profile);

DELETE FROM tbl_msme_operator
WHERE email LIKE '%@ceview.local';

-- V18's demo GDP/forex history for korea/japan/usa. Market-level rather than
-- tenant data; the daily ingestion job writes the real figures.
DELETE FROM tbl_market_economic_trend
WHERE trend_id IN ('90000000-0000-0000-0000-000000000001',
                   '90000000-0000-0000-0000-000000000002',
                   '90000000-0000-0000-0000-000000000003');

COMMIT;
