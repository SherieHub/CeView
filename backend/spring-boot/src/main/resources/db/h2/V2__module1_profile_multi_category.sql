-- H2 mirror of db/migration/V2. See that file for the full operator ->
-- business_profile_id UUID map (same fixed literals are used here so
-- H2-backed tests exercise the same data shape as Postgres).

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

-- ── 9 realistic Cebu MSME operator accounts (replaces the "dev operator" seed) ─
MERGE INTO tbl_msme_operator (operator_id, first_name, last_name, email, password_hash, contact_number, created_at)
KEY(operator_id)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Ramon',     'Dela Cruz Jr.',    'ramon.delacruz@ceview.local',  '$2a$10$UV3Ch0mUwjcRCiO.Y.05buhVpOxxLi2FXi/Q9qJdYpxff6Yuokbtm', '+63 917 234 5678', TIMESTAMP '2025-01-10 09:15:00'),
    ('10000000-0000-0000-0000-000000000002', 'Ferdinand', 'Bacus',            'ferdie.bacus@ceview.local',    '$2a$10$Nn7CQJZm4X.lw7y1bb.W6OoUfeiwmFS6OiTTLbayjodhK8.a3EMC.', '+63 918 345 6789', TIMESTAMP '2025-01-14 10:40:00'),
    ('10000000-0000-0000-0000-000000000003', 'Marites',   'Abellana',         'marites.abellana@ceview.local','$2a$10$27ERzbWnBA8JmK.jnKw6UetqpVcDWJqbYyiJAVkniiw32ll1uO6Q6', '+63 919 456 7890', TIMESTAMP '2025-01-20 08:05:00'),
    ('10000000-0000-0000-0000-000000000004', 'Teresita',  'Osmeña-Ybañez',    'teresita.osmena@ceview.local', '$2a$10$u40hEPGEi6GDrHnNcDQNJOP38d8G6FvEqAmPH6BsoEDcjPi4a2aY6', '+63 920 567 8901', TIMESTAMP '2025-02-01 13:25:00'),
    ('10000000-0000-0000-0000-000000000005', 'Ariel',     'Cabahug',          'ariel.cabahug@ceview.local',   '$2a$10$F37QVK0DQ1Z5FnL4Tu.qpOEPoHWFdxqzRcun2tN7KxbT1rOVokT9K', '+63 921 678 9012', TIMESTAMP '2025-02-05 16:50:00'),
    ('10000000-0000-0000-0000-000000000006', 'Nena',      'Villaflor',        'nena.villaflor@ceview.local',  '$2a$10$g92.f6D2tIthgHqnpKjkXOMIze/ESHYNPfAJmMD3Hkfz6CVSwN7/6', '+63 922 789 0123', TIMESTAMP '2025-02-11 07:30:00'),
    ('10000000-0000-0000-0000-000000000007', 'Christian', 'Mendiola',         'christian.mendiola@ceview.local','$2a$10$Olk/lJvij4VegduzOEwHdOAQ3KfVzATgjXpgRZNm7Rlbf4CpVM9si', '+63 923 890 1234', TIMESTAMP '2025-02-18 11:00:00'),
    ('10000000-0000-0000-0000-000000000008', 'Krizia',    'Fernandez',        'krizia.fernandez@ceview.local','$2a$10$cJQ0unrH9Ie9Vp/P5xieBup/Vp0YF38OEBcbmfuyvLR4iBsP7EgIa', '+63 924 901 2345', TIMESTAMP '2025-02-24 19:10:00'),
    ('10000000-0000-0000-0000-000000000009', 'Boyet',     'Lim',              'boyet.lim@ceview.local',       '$2a$10$q3Koyc65vgWh.tA0W1AlwOAAhaXc0KLNflmyeKuHV8IrF7y3pJT92', '+63 925 012 3456', TIMESTAMP '2025-03-02 06:45:00');

-- ── Business profiles (one per operator) ───────────────────────────────────
MERGE INTO tbl_business_profile (business_profile_id, user_id, business_name, business_description, uvp, core_services, image_url, categories, confidence_score, uniqueness_score, created_at, updated_at)
KEY(business_profile_id)
VALUES
    ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
     'Moalboal FreeDive Cebu',
     'A PADI-affiliated freediving and snorkeling outfit based on Panagsama Beach, Moalboal, running daily trips to the famous sardine run and nearby turtle sanctuary. Small groups of six or fewer set out each morning by outrigger boat, guided by instructors who have logged thousands of dives along this reef wall, with certification courses running from beginner breath-hold basics through advanced depth training, plus full gear rental and a post-dive underwater photo review included in every booking.',
     'The only Moalboal operator combining certified freediving instruction with guided sardine-run snorkeling, so guests leave with both a new skill and a story, backed by instructors who log the sardine ball''s daily location each morning before any group ever leaves the shore.',
     'Freediving certification courses,Guided sardine run snorkeling tours,Turtle sanctuary boat trips,Underwater photography add-ons',
     NULL, 'Coastal & Island', 0.88, 0.74, TIMESTAMP '2025-01-11 09:00:00', TIMESTAMP '2025-01-11 09:00:00'),

    ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002',
     'Oslob Whale Shark Adventures',
     'Community-partnered whale shark interaction and watching tours in Tan-awan, Oslob, paired with a short countryside habal-habal ride to Tumalog Falls. Guests join a briefing on the community''s strict interaction code before boarding a paddle boat at sunrise, when the whale sharks feed closest to shore, then transfer by motorbike sidecar along winding barangay roads to swim beneath the two-tier limestone falls before the afternoon tour buses arrive.',
     'Small-group, strict-code-of-conduct whale shark encounters bundled with a Tumalog Falls side trip, so one morning booking covers two of southern Cebu''s biggest draws, without guests needing to arrange separate transport, entrance permits, or guides for either stop, and every dive opens with a certified marine conservation briefing.',
     'Whale shark watching and snorkeling,Tumalog Falls habal-habal transfers,Underwater photo and video packages,Private van pickup from Cebu City',
     NULL, 'Adventure & Nature', 0.83, 0.69, TIMESTAMP '2025-01-15 10:00:00', TIMESTAMP '2025-01-15 10:00:00'),

    ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003',
     'Bantayan Blue Waters Island Hopping',
     'Family-run island-hopping and sandbar tour operator sailing traditional bangkas out of Santa Fe, Bantayan Island, to Virgin Island and Hilantagaan. Three generations of the same fishing family captain the boats, timing each departure around the tides so guests wade onto powder-white sandbars at low tide, snorkel over coral gardens between stops, and finish the trip with grilled seafood cooked fresh on board by the crew.',
     'Runs the smallest boats on the route, carrying eight passengers at most, so groups get sandbars to themselves instead of sharing with the big tour-bus crowds bussed in from the ferry terminal, and can shift the day''s itinerary on the spot whenever weather or tide favors one island over another.',
     'Virgin Island sandbar tours,Hilantagaan snorkeling trips,Sunset sailing charters,Beachfront lechon lunch catering',
     NULL, 'Coastal & Island', 0.79, 0.63, TIMESTAMP '2025-01-21 08:30:00', TIMESTAMP '2025-01-21 08:30:00'),

    ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004',
     'Sugbo Heritage Walks',
     'Licensed heritage guide service leading walking tours through Fort San Pedro, Magellan''s Cross, Basilica del Santo Niño, and the Colon Street heritage district, reputedly Asia''s oldest street. Each two-hour route is capped at twelve guests and includes skip-the-line entry coordination at the Basilica museum, a stop inside Casa Gorordo''s restored ancestral rooms, and closes at a heritage-district carinderia for a taste of old Cebu home cooking.',
     'Guides are trained local historians with backgrounds in Philippine studies, not generalist tour agents, so the Fort San Pedro-to-Casa Gorordo route comes with stories no guidebook prints, drawn from archival research and family accounts passed down through several of Cebu''s oldest heritage households over generations.',
     'Guided heritage walking tours,Museum and Casa Gorordo entry coordination,School group educational tours,Custom Sinulog history tours',
     NULL, 'Cultural & Heritage', 0.86, 0.71, TIMESTAMP '2025-02-02 13:45:00', TIMESTAMP '2025-02-02 13:45:00'),

    ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005',
     'Sinulog Fiesta Dance & Cultural Show',
     'Nightly Sinulog-themed dance and cultural performance venue near Fuente Osmeña, Cebu City, featuring live drums, festival costumes, and audience street-dance segments. The seventy-minute program moves through Cebu''s pre-colonial rituals, Spanish-era fiesta traditions, and the modern Sinulog street parade, closing with dancers pulling guests onto the floor for the two-step sinulog beat, backed throughout by a live percussion ensemble that rehearses year-round for the show.',
     'Brings the Sinulog street-dance experience to visitors year-round, not just during the January festival window, with a live drum-and-brass band show unmatched by scripted hotel revues, performed by dancers who compete in the actual Sinulog Grand Parade and bring that same festival-day energy to every single nightly performance.',
     'Nightly cultural dance shows,Private event and corporate bookings,Festival costume photo experiences,Group dinner-and-show packages',
     NULL, 'Theme Parks / Entertainment', 0.81, 0.66, TIMESTAMP '2025-02-06 17:00:00', TIMESTAMP '2025-02-06 17:00:00'),

    ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006',
     'Nena''s Talisay Lechon House',
     'Third-generation lechon house in Talisay City slow-roasting whole pigs over charcoal using a family recipe passed down since the 1970s, with dine-in carinderia service and province-wide delivery. Pigs are stuffed with a secret blend of lemongrass, garlic, and native spices, turned by hand on bamboo spits for eight hours, and sold whole, by the kilo, or packed to order for fiesta and wedding catering.',
     'One of the last Talisay lechoneros still hand-basting over open charcoal for eight hours instead of switching to gas rotisseries, giving a crackling skin and smoky flavor that mass producers cannot replicate, and drawing repeat wholesale orders from Cebu City restaurants that quietly serve it as their own house specialty.',
     'Whole roasted lechon orders,Dine-in carinderia service,Province-wide lechon delivery,Catering for fiestas and weddings',
     NULL, 'Culinary & Gastronomy', 0.90, 0.77, TIMESTAMP '2025-02-12 07:00:00', TIMESTAMP '2025-02-12 07:00:00'),

    ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007',
     'Mactan Sunset Beachfront Resort',
     'Boutique 20-room beachfront resort on Mactan Island with a private cove, an infinity pool overlooking the Mactan Channel, and easy access to Mactan Shrine and the airport. Rooms range from garden-view standards to overwater-style villas, every guest receives a complimentary sunset catamaran ride twice a week, and the in-house restaurant serves a daily catch-of-the-day menu sourced from the resort''s own local fishing partners.',
     'Only ten minutes from the airport yet feels like a private-island escape, letting layover travelers and weekend guests get a full resort day, cove swim, and sunset dinner without the hour-long commute out to Panglao or Bantayan, all inside a gated twenty-room property small enough to still feel personal.',
     'Beachfront room and villa stays,Day-use pool and cove packages,Airport transfer and layover packages,Sunset cruise add-ons',
     NULL, 'Accommodation & Staycation', 0.85, 0.68, TIMESTAMP '2025-02-19 11:30:00', TIMESTAMP '2025-02-19 11:30:00'),

    ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000008',
     'IT Park Nightlife & City Tour Co.',
     'Evening rooftop-bar hopping and city tour operator based in Cebu IT Park, walking small groups through IT Park''s rooftop bars, the Escario Street food strip, and the older Colon nightlife district. Each four-hour circuit includes a welcome drink at three curated venues, a late-night stop for street food, and a local host who personally knows the bouncers, so every group skips the cover charges and the queues.',
     'Curates a walkable rooftop-to-street-food circuit through IT Park and Escario, letting visiting professionals and digital nomads see Cebu''s nightlife without needing a car, a designated driver, or advance reservations, since the host''s standing relationships with bar managers get every group straight past the line at each stop.',
     'Rooftop bar hopping tours,IT Park district food walks,Corporate team-night bookings,Custom nightlife itinerary planning',
     NULL, 'Urban & City', 0.77, 0.61, TIMESTAMP '2025-02-25 19:30:00', TIMESTAMP '2025-02-25 19:30:00'),

    ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000009',
     'Carbon Market Street Food Crawl',
     'Guided street-food walking tour through Cebu City''s historic Carbon Market, sampling puso hanging rice, ngohiong, dried mangoes, and fresh lechon straight off the spit at stalls the operator has known for years. The two-hour route winds through the wet market''s produce and spice sections before ending at a family-run turo-turo for a full Cebuano lunch plate included in every single booking.',
     'Runs entirely through vendor relationships built over a decade working and eating at Carbon Market, getting guests into stalls and back-alley kitchens a tourist would never find alone, with the operator personally vouching for every vendor''s hygiene and sourcing practices before ever adding them to the route.',
     'Guided street food walking tours,Vendor and market sourcing introductions,Private group tastings,Custom Cebuano cooking demos',
     NULL, 'Culinary & Gastronomy', 0.80, 0.65, TIMESTAMP '2025-03-03 07:15:00', TIMESTAMP '2025-03-03 07:15:00');

-- ── Category-score breakdowns (7 columns, assigned category scores highest) ─
MERGE INTO tbl_business_categories_score (categories_score_id, business_profile_id, coastal_island, adventure, cultural, theme_parks, urban, culinary, accommodation)
KEY(categories_score_id)
VALUES
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 0.88, 0.32, 0.10, 0.05, 0.08, 0.12, 0.15),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 0.55, 0.83, 0.20, 0.06, 0.05, 0.10, 0.12),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 0.79, 0.28, 0.08, 0.05, 0.07, 0.18, 0.25),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 0.10, 0.15, 0.86, 0.20, 0.30, 0.12, 0.05),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 0.05, 0.08, 0.35, 0.81, 0.25, 0.10, 0.06),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 0.06, 0.05, 0.22, 0.08, 0.20, 0.90, 0.05),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 0.45, 0.10, 0.08, 0.06, 0.12, 0.10, 0.85),
    ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 0.05, 0.06, 0.15, 0.30, 0.77, 0.28, 0.10),
    ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 0.08, 0.07, 0.28, 0.10, 0.35, 0.80, 0.06);

-- ── Classification-run logs (one completed SUCCESS run per profile) ────────
MERGE INTO tbl_classification_logs (log_id, business_profile_id, inference_status, confidence_score, execution_time, error_message)
KEY(log_id)
VALUES
    ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'SUCCESS', 0.88, TIMESTAMP '2025-01-11 09:02:00', NULL),
    ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'SUCCESS', 0.83, TIMESTAMP '2025-01-15 10:03:00', NULL),
    ('40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'SUCCESS', 0.79, TIMESTAMP '2025-01-21 08:32:00', NULL),
    ('40000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'SUCCESS', 0.86, TIMESTAMP '2025-02-02 13:47:00', NULL),
    ('40000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'SUCCESS', 0.81, TIMESTAMP '2025-02-06 17:02:00', NULL),
    ('40000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'SUCCESS', 0.90, TIMESTAMP '2025-02-12 07:02:00', NULL),
    ('40000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'SUCCESS', 0.85, TIMESTAMP '2025-02-19 11:32:00', NULL),
    ('40000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'SUCCESS', 0.77, TIMESTAMP '2025-02-25 19:32:00', NULL),
    ('40000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'SUCCESS', 0.80, TIMESTAMP '2025-03-03 07:17:00', NULL);
