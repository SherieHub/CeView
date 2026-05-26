-- Module 1 alignment: drop unused `business_type`, rename `finalized_category`
-- to `categories` (now a comma-joined list), and seed a dev operator row so the
-- pre-auth `operatorId` placeholder used by the frontend satisfies the FK.

ALTER TABLE tbl_business_profile DROP COLUMN IF EXISTS business_type;

ALTER TABLE tbl_business_profile RENAME COLUMN finalized_category TO categories;
ALTER TABLE tbl_business_profile ALTER COLUMN categories TYPE TEXT;

-- Replace the seed canonical categories with the Cebu-tourism vocabulary that
-- the calibration model and frontend now share.
DELETE FROM tbl_business_category;
INSERT INTO tbl_business_category (category_id, category_name, category_description) VALUES
    (gen_random_uuid(), 'Coastal & Island',             'Beachfront, island-hopping, and water leisure'),
    (gen_random_uuid(), 'Adventure & Nature',           'Outdoor adventure, eco-tourism, nature trails'),
    (gen_random_uuid(), 'Cultural & Heritage',          'Historical sites, museums, cultural experiences'),
    (gen_random_uuid(), 'Theme Parks / Entertainment',  'Theme parks, entertainment venues, family fun'),
    (gen_random_uuid(), 'Urban & City',                 'City-center hotels, urban exploration'),
    (gen_random_uuid(), 'Culinary & Gastronomy',        'Dining, food tours, culinary experiences'),
    (gen_random_uuid(), 'Accommodation & Staycation',   'Hotels, resorts, staycation packages');

-- Dev operator placeholder so pre-auth PUTs do not violate the user_id FK.
INSERT INTO tbl_msme_operator (operator_id, first_name, last_name, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dev', 'Operator', 'dev@ceview.local')
ON CONFLICT (operator_id) DO NOTHING;
