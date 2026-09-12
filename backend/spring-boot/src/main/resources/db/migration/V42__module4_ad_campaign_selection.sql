-- ============================================================================
-- V28 — Module 4: report on one ad campaign instead of the whole account
--
-- WHY
--   An operator often runs several unrelated campaigns on one ad account. The
--   account total (V27's level=account fetch) mixes them into a single PES
--   score. These columns let the operator pin the sync to one campaign.
--
-- NULL is the unchanged default: no campaign chosen = whole account, exactly
-- as V27 shipped.
-- ============================================================================

ALTER TABLE tbl_ad_platform_connection
    ADD COLUMN IF NOT EXISTS external_campaign_id   TEXT,
    ADD COLUMN IF NOT EXISTS external_campaign_name TEXT;

COMMENT ON COLUMN tbl_ad_platform_connection.external_campaign_id IS
    'Platform campaign id to scope the sync to. NULL = whole account.';

ALTER TABLE tbl_ad_insight
    ADD COLUMN IF NOT EXISTS external_campaign_id TEXT;

COMMENT ON COLUMN tbl_ad_insight.external_campaign_id IS
    'Campaign this cached row was scoped to, or NULL for a whole-account row.';
