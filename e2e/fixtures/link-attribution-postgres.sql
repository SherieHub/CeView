-- Track 5 link-attribution sample data for a LOCAL Postgres database.
--
-- NOT a migration. Seeds test links, clicks and redemptions onto one operator's
-- business profile so GET /api/attribution/links/{id}/creatives can be checked by
-- hand before Tracks 2-4 exist. Change the two emails below, then run the whole file.
--
-- Everything it creates is recognisable and removable:
--   links   slug 't5-...'            category 'T5 Seed'
--   codes   code 'T5SEED-...'        category 'T5 Seed'
--   clicks  id '7a5c....'
-- Re-running first deletes exactly those rows, then recreates them. Nothing else is
-- touched, including links the forecasting pipeline minted for the same profile.
--
-- To remove the sample data without re-seeding, run only the CLEANUP block.

DO $$
DECLARE
    target_email text := 'sherielyn@gmail.com';        -- the account you will test as
    other_email  text := 'ramon.delacruz@ceview.local'; -- another tenant, for the 404 check
    p   uuid;   -- target profile
    o   uuid;   -- other tenant's profile (may be null)
    ws  timestamptz := '2026-09-01 00:00:00+08';
    we  timestamptz := '2026-10-31 00:00:00+08';
BEGIN
    SELECT bp.business_profile_id INTO p
      FROM tbl_business_profile bp JOIN tbl_msme_operator op ON op.operator_id = bp.user_id
     WHERE op.email = target_email LIMIT 1;
    IF p IS NULL THEN RAISE EXCEPTION 'No business profile for %', target_email; END IF;

    SELECT bp.business_profile_id INTO o
      FROM tbl_business_profile bp JOIN tbl_msme_operator op ON op.operator_id = bp.user_id
     WHERE op.email = other_email LIMIT 1;

    -- ------------------------------------------------------------ CLEANUP
    DELETE FROM tbl_attribution_redemption WHERE attribution_code_id IN
        (SELECT attribution_code_id FROM tbl_attribution_code WHERE code LIKE 'T5SEED-%');
    DELETE FROM tbl_attribution_click WHERE click_id::text LIKE '7a5c%';
    DELETE FROM tbl_attribution_link  WHERE slug LIKE 't5-%';
    DELETE FROM tbl_attribution_code  WHERE code LIKE 'T5SEED-%';

    -- ------------------------------------------------------------ codes
    -- Every redemption needs a code (NOT NULL FK), even LINK-sourced ones.
    INSERT INTO tbl_attribution_code
        (attribution_code_id, business_profile_id, category, target_market, code, window_start, window_end, created_at)
    VALUES
        ('7a5d0000-0000-0000-0000-000000000001', p, 'T5 Seed', 'korea', 'T5SEED-KR', ws, we, now()),
        ('7a5d0000-0000-0000-0000-000000000002', p, 'T5 Seed', 'japan', 'T5SEED-JP', ws, we, now());

    -- ------------------------------------------------------------ links
    INSERT INTO tbl_attribution_link
        (link_id, business_profile_id, category, target_market, slug, window_start, window_end, created_at)
    VALUES
        ('7a5a0000-0000-0000-0000-000000000001', p, 'T5 Seed', 'korea', 't5-split',    ws, we, now()),
        ('7a5a0000-0000-0000-0000-000000000002', p, 'T5 Seed', 'japan', 't5-untagged', ws, we, now()),
        ('7a5a0000-0000-0000-0000-000000000003', p, 'T5 Seed', 'usa',   't5-empty',    ws, we, now());

    -- ------------------------------------------------------------ link 1: t5-split
    -- Expected (conversions desc, then ad id; untagged after tagged on ties):
    --   Ad ad-A              3 clicks  2 conversions  1500.50
    --   Ad ad-B              2 clicks  1 conversion      0.00   <- enquiry, zero revenue
    --   Organic / untagged   2 clicks  1 conversion    250.00   <- one NULL id + one blank id
    --   Ad ad-C              1 click   0 conversions     0.00
    --   Total                8         4              1750.50
    -- Must NOT count: the out-of-window ad-A click (and its 999.00), the MANUAL row.
    INSERT INTO tbl_attribution_click
        (click_id, link_id, business_profile_id, external_ad_id, platform, in_window, clicked_at)
    VALUES
        ('7a5c0001-0000-0000-0000-000000000001', '7a5a0000-0000-0000-0000-000000000001', p, 'ad-A', 'META',    TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000002', '7a5a0000-0000-0000-0000-000000000001', p, 'ad-A', 'META',    TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000003', '7a5a0000-0000-0000-0000-000000000001', p, 'ad-A', 'META',    TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000004', '7a5a0000-0000-0000-0000-000000000001', p, 'ad-B', 'TIKTOK',  TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000005', '7a5a0000-0000-0000-0000-000000000001', p, 'ad-B', 'TIKTOK',  TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000006', '7a5a0000-0000-0000-0000-000000000001', p, 'ad-C', 'META',    TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000007', '7a5a0000-0000-0000-0000-000000000001', p, NULL,   'UNKNOWN', TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000008', '7a5a0000-0000-0000-0000-000000000001', p, '',     'UNKNOWN', TRUE,  now()),
        ('7a5c0001-0000-0000-0000-000000000009', '7a5a0000-0000-0000-0000-000000000001', p, 'ad-A', 'META',    FALSE, now());

    INSERT INTO tbl_attribution_redemption
        (redemption_id, attribution_code_id, business_profile_id, source, event_at, bookings, revenue, attribution_click_id, created_at)
    VALUES
        (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000001', p, 'LINK',   NULL,  1, 1000.00, '7a5c0001-0000-0000-0000-000000000001', now()),
        (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000001', p, 'LINK',   NULL,  1,  500.50, '7a5c0001-0000-0000-0000-000000000002', now()),
        (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000001', p, 'LINK',   NULL,  1,    0.00, '7a5c0001-0000-0000-0000-000000000004', now()),
        (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000001', p, 'LINK',   NULL,  1,  250.00, '7a5c0001-0000-0000-0000-000000000007', now()),
        (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000001', p, 'LINK',   NULL,  1,  999.00, '7a5c0001-0000-0000-0000-000000000009', now()),
        (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000001', p, 'MANUAL', now(), 1,  300.00, NULL,                                   now());

    -- ------------------------------------------------------------ link 2: t5-untagged
    -- Expected: one row, Organic / untagged, 4 clicks, 1 conversion, 1200.00.
    INSERT INTO tbl_attribution_click
        (click_id, link_id, business_profile_id, external_ad_id, platform, in_window, clicked_at)
    VALUES
        ('7a5c0002-0000-0000-0000-000000000001', '7a5a0000-0000-0000-0000-000000000002', p, NULL, 'META',    TRUE, now()),
        ('7a5c0002-0000-0000-0000-000000000002', '7a5a0000-0000-0000-0000-000000000002', p, NULL, 'META',    TRUE, now()),
        ('7a5c0002-0000-0000-0000-000000000003', '7a5a0000-0000-0000-0000-000000000002', p, NULL, 'UNKNOWN', TRUE, now()),
        ('7a5c0002-0000-0000-0000-000000000004', '7a5a0000-0000-0000-0000-000000000002', p, NULL, 'UNKNOWN', TRUE, now());

    INSERT INTO tbl_attribution_redemption
        (redemption_id, attribution_code_id, business_profile_id, source, bookings, revenue, attribution_click_id, created_at)
    VALUES
        (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000002', p, 'LINK', 1, 1200.00, '7a5c0002-0000-0000-0000-000000000001', now());

    -- ------------------------------------------------------------ link 3: t5-empty
    -- No clicks. Expected: totals 0 / 0 / 0 and an empty creatives list.

    -- ------------------------------------------------------------ link 4: t5-other
    -- Another tenant's link. Requesting it as the target account must return 404.
    IF o IS NOT NULL THEN
        INSERT INTO tbl_attribution_code
            (attribution_code_id, business_profile_id, category, target_market, code, window_start, window_end, created_at)
        VALUES ('7a5d0000-0000-0000-0000-000000000004', o, 'T5 Seed', 'korea', 'T5SEED-OT', ws, we, now());
        INSERT INTO tbl_attribution_link
            (link_id, business_profile_id, category, target_market, slug, window_start, window_end, created_at)
        VALUES ('7a5a0000-0000-0000-0000-000000000004', o, 'T5 Seed', 'korea', 't5-other', ws, we, now());
        INSERT INTO tbl_attribution_click
            (click_id, link_id, business_profile_id, external_ad_id, platform, in_window, clicked_at)
        VALUES ('7a5c0004-0000-0000-0000-000000000001', '7a5a0000-0000-0000-0000-000000000004', o, 'ad-A', 'META', TRUE, now());
        INSERT INTO tbl_attribution_redemption
            (redemption_id, attribution_code_id, business_profile_id, source, bookings, revenue, attribution_click_id, created_at)
        VALUES (gen_random_uuid(), '7a5d0000-0000-0000-0000-000000000004', o, 'LINK', 1, 5000.00, '7a5c0004-0000-0000-0000-000000000001', now());
    END IF;
END $$;
