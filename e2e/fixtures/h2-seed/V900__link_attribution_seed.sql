-- Track 5 link-attribution sample data for the local H2 backend.
--
-- NOT part of the app's migrations. It only runs when you point Flyway at this
-- folder yourself, from backend/spring-boot:
--
--   java -jar target\ceview-backend-0.1.0.jar --spring.profiles.active=h2 `
--     "--spring.flyway.locations=classpath:db/h2,filesystem:../../e2e/fixtures/h2-seed"
--
-- The H2 console cannot be used for this: SecurityConfig does not exempt /h2,
-- so it answers 401. The database is in memory, so a restart without the flag
-- starts clean again. The cleanup block below keeps the script safe to re-run.
--
-- Every row uses a fixed id starting with 7a5..., so it never touches real seed data.
--
-- Scenarios (all on Ramon's profile unless noted):
--   Link 1  t5-split     three creatives + untagged + noise   -> canonical split
--   Link 2  t5-untagged  untagged clicks only                  -> "bare link pasted" prompt
--   Link 3  t5-empty     no clicks at all                      -> empty state
--   Link 4  t5-ferdie    Ferdie's link                         -> 404 for Ramon
--
-- Expected GET /api/attribution/links/{id}/creatives results are listed under each link.

-- ---------------------------------------------------------------- H2 schema gap
-- WORKAROUND, not Track 5's fix to make: Postgres V26__module1_reference_corpus.sql
-- added tbl_business_profile.is_reference, but db/h2 never got a mirror. Without it
-- every JWT request that resolves the business profile fails with a 500 on the h2
-- profile. The real fix is an h2 migration owned by Module 1.
ALTER TABLE tbl_business_profile ADD COLUMN IF NOT EXISTS is_reference BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------- cleanup
DELETE FROM tbl_attribution_redemption WHERE attribution_code_id IN
    (SELECT attribution_code_id FROM tbl_attribution_code WHERE code LIKE 'T5SEED%');
DELETE FROM tbl_attribution_click WHERE CAST(click_id AS VARCHAR) LIKE '7a5c%';
DELETE FROM tbl_attribution_link  WHERE slug LIKE 't5-%';
DELETE FROM tbl_attribution_code  WHERE code LIKE 'T5SEED%';

-- ---------------------------------------------------------------- profiles
SET @RAMON  = (SELECT business_profile_id FROM tbl_business_profile
               WHERE user_id = '10000000-0000-0000-0000-000000000001' LIMIT 1);
SET @FERDIE = (SELECT business_profile_id FROM tbl_business_profile
               WHERE user_id = '10000000-0000-0000-0000-000000000002' LIMIT 1);

-- Window: open around "now" so the data reads as a current campaign.
SET @WS = TIMESTAMP WITH TIME ZONE '2026-09-01 00:00:00+08:00';
SET @WE = TIMESTAMP WITH TIME ZONE '2026-10-31 00:00:00+08:00';

-- ---------------------------------------------------------------- codes
-- Every redemption row needs a code (NOT NULL FK), even LINK-sourced ones.
INSERT INTO tbl_attribution_code
    (attribution_code_id, business_profile_id, category, target_market, code, window_start, window_end, created_at)
VALUES
    ('7a5d0000-0000-0000-0000-000000000001', @RAMON,  'T5 Seed', 'KR', 'T5SEED-KR', @WS, @WE, CURRENT_TIMESTAMP),
    ('7a5d0000-0000-0000-0000-000000000002', @RAMON,  'T5 Seed', 'JP', 'T5SEED-JP', @WS, @WE, CURRENT_TIMESTAMP),
    ('7a5d0000-0000-0000-0000-000000000004', @FERDIE, 'T5 Seed', 'KR', 'T5SEED-FB', @WS, @WE, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------- links
INSERT INTO tbl_attribution_link
    (link_id, business_profile_id, category, target_market, slug, window_start, window_end, created_at)
VALUES
    ('7a5a0000-0000-0000-0000-000000000001', @RAMON,  'T5 Seed', 'KR', 't5-split',    @WS, @WE, CURRENT_TIMESTAMP),
    ('7a5a0000-0000-0000-0000-000000000002', @RAMON,  'T5 Seed', 'JP', 't5-untagged', @WS, @WE, CURRENT_TIMESTAMP),
    ('7a5a0000-0000-0000-0000-000000000003', @RAMON,  'T5 Seed', 'US', 't5-empty',    @WS, @WE, CURRENT_TIMESTAMP),
    ('7a5a0000-0000-0000-0000-000000000004', @FERDIE, 'T5 Seed', 'KR', 't5-ferdie',   @WS, @WE, CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------- link 1: t5-split
-- Expected (sorted by conversions desc, then ad id; untagged last on ties):
--   Ad ad-A              3 clicks  2 conversions  1500.50
--   Ad ad-B              2 clicks  1 conversion      0.00   <- enquiry, zero revenue
--   Organic / untagged   2 clicks  1 conversion    250.00   <- one NULL id + one blank id
--   Ad ad-C              1 click   0 conversions     0.00
--   Total                8         4              1750.50
-- Must NOT count: the out-of-window ad-A click (and its 999.00), the MANUAL row.
INSERT INTO tbl_attribution_click
    (click_id, link_id, business_profile_id, external_ad_id, platform, in_window, clicked_at)
VALUES
    ('7a5c0001-0000-0000-0000-000000000001', '7a5a0000-0000-0000-0000-000000000001', @RAMON, 'ad-A', 'META',    TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000002', '7a5a0000-0000-0000-0000-000000000001', @RAMON, 'ad-A', 'META',    TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000003', '7a5a0000-0000-0000-0000-000000000001', @RAMON, 'ad-A', 'META',    TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000004', '7a5a0000-0000-0000-0000-000000000001', @RAMON, 'ad-B', 'TIKTOK',  TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000005', '7a5a0000-0000-0000-0000-000000000001', @RAMON, 'ad-B', 'TIKTOK',  TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000006', '7a5a0000-0000-0000-0000-000000000001', @RAMON, 'ad-C', 'META',    TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000007', '7a5a0000-0000-0000-0000-000000000001', @RAMON, NULL,   'UNKNOWN', TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000008', '7a5a0000-0000-0000-0000-000000000001', @RAMON, '',     'UNKNOWN', TRUE,  CURRENT_TIMESTAMP),
    ('7a5c0001-0000-0000-0000-000000000009', '7a5a0000-0000-0000-0000-000000000001', @RAMON, 'ad-A', 'META',    FALSE, CURRENT_TIMESTAMP);

INSERT INTO tbl_attribution_redemption
    (redemption_id, attribution_code_id, business_profile_id, source, event_at, bookings, revenue, attribution_click_id, created_at)
VALUES
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000001', @RAMON, 'LINK',   NULL,              1, 1000.00, '7a5c0001-0000-0000-0000-000000000001', CURRENT_TIMESTAMP),
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000001', @RAMON, 'LINK',   NULL,              1,  500.50, '7a5c0001-0000-0000-0000-000000000002', CURRENT_TIMESTAMP),
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000001', @RAMON, 'LINK',   NULL,              1,    0.00, '7a5c0001-0000-0000-0000-000000000004', CURRENT_TIMESTAMP),
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000001', @RAMON, 'LINK',   NULL,              1,  250.00, '7a5c0001-0000-0000-0000-000000000007', CURRENT_TIMESTAMP),
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000001', @RAMON, 'LINK',   NULL,              1,  999.00, '7a5c0001-0000-0000-0000-000000000009', CURRENT_TIMESTAMP),
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000001', @RAMON, 'MANUAL', CURRENT_TIMESTAMP, 1,  300.00, NULL,                                   CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------- link 2: t5-untagged
-- Expected: one row, Organic / untagged, 4 clicks, 1 conversion, 1200.00.
-- The UI shows the "bare link may have been pasted" prompt for this link.
INSERT INTO tbl_attribution_click
    (click_id, link_id, business_profile_id, external_ad_id, platform, in_window, clicked_at)
VALUES
    ('7a5c0002-0000-0000-0000-000000000001', '7a5a0000-0000-0000-0000-000000000002', @RAMON, NULL, 'META',    TRUE, CURRENT_TIMESTAMP),
    ('7a5c0002-0000-0000-0000-000000000002', '7a5a0000-0000-0000-0000-000000000002', @RAMON, NULL, 'META',    TRUE, CURRENT_TIMESTAMP),
    ('7a5c0002-0000-0000-0000-000000000003', '7a5a0000-0000-0000-0000-000000000002', @RAMON, NULL, 'UNKNOWN', TRUE, CURRENT_TIMESTAMP),
    ('7a5c0002-0000-0000-0000-000000000004', '7a5a0000-0000-0000-0000-000000000002', @RAMON, NULL, 'UNKNOWN', TRUE, CURRENT_TIMESTAMP);

INSERT INTO tbl_attribution_redemption
    (redemption_id, attribution_code_id, business_profile_id, source, bookings, revenue, attribution_click_id, created_at)
VALUES
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000002', @RAMON, 'LINK', 1, 1200.00, '7a5c0002-0000-0000-0000-000000000001', CURRENT_TIMESTAMP);

-- ---------------------------------------------------------------- link 3: t5-empty
-- No clicks. Expected: totals 0 / 0 / 0 and an empty creatives list.

-- ---------------------------------------------------------------- link 4: t5-ferdie
-- Ferdie's data. Ramon requesting this link id must get 404, and none of it may
-- leak into Ramon's links.
INSERT INTO tbl_attribution_click
    (click_id, link_id, business_profile_id, external_ad_id, platform, in_window, clicked_at)
VALUES
    ('7a5c0004-0000-0000-0000-000000000001', '7a5a0000-0000-0000-0000-000000000004', @FERDIE, 'ad-A', 'META', TRUE, CURRENT_TIMESTAMP);

INSERT INTO tbl_attribution_redemption
    (redemption_id, attribution_code_id, business_profile_id, source, bookings, revenue, attribution_click_id, created_at)
VALUES
    (RANDOM_UUID(), '7a5d0000-0000-0000-0000-000000000004', @FERDIE, 'LINK', 1, 5000.00, '7a5c0004-0000-0000-0000-000000000001', CURRENT_TIMESTAMP);
