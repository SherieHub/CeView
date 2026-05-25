-- H2 mirror of db/migration/V2.
ALTER TABLE tbl_business_profile DROP COLUMN IF EXISTS business_type;

ALTER TABLE tbl_business_profile ALTER COLUMN finalized_category RENAME TO categories;
ALTER TABLE tbl_business_profile ALTER COLUMN categories SET DATA TYPE CLOB;

DELETE FROM tbl_business_category;
INSERT INTO tbl_business_category (category_id, category_name, category_description) VALUES
    (RANDOM_UUID(), 'Coastal & Island',             'Beachfront, island-hopping, and water leisure'),
    (RANDOM_UUID(), 'Adventure & Nature',           'Outdoor adventure, eco-tourism, nature trails'),
    (RANDOM_UUID(), 'Cultural & Heritage',          'Historical sites, museums, cultural experiences'),
    (RANDOM_UUID(), 'Theme Parks / Entertainment',  'Theme parks, entertainment venues, family fun'),
    (RANDOM_UUID(), 'Urban & City',                 'City-center hotels, urban exploration'),
    (RANDOM_UUID(), 'Culinary & Gastronomy',        'Dining, food tours, culinary experiences'),
    (RANDOM_UUID(), 'Accommodation & Staycation',   'Hotels, resorts, staycation packages');

MERGE INTO tbl_msme_operator (operator_id, first_name, last_name, email)
KEY(operator_id)
VALUES ('00000000-0000-0000-0000-000000000001', 'Dev', 'Operator', 'dev@ceview.local');
