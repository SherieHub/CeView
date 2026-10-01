-- V26: Module 1 reference corpus for uniqueness scoring.
--
-- WHY THIS EXISTS
-- Uniqueness scoring compares a business against a cohort of other businesses.
-- Until now nothing seeded tbl_business_embedding, so that cohort was whatever
-- profiles happened to have been saved on a given machine — scores were not
-- reproducible between developers, and on a fresh database the corpus fell
-- below the 3-row floor and every business silently scored 100.
--
-- This migration seeds the *text* of a fixed reference corpus. The vectors are
-- generated from it by scripts/generate-reference-corpus.py, which runs the
-- same ml_classifier.embed_business() path production uses, and exports
-- db/dump/uniqueness-corpus.sql for other developers to import. Seeding text
-- here and vectors there is deliberate: a vector literal in SQL would silently
-- rot the moment _build_text or the encoder changes.
--
-- These are reference data, not fixtures and not runtime mocks. They are real
-- rows in the real table, loaded by Flyway like any other seed, and they exist
-- only to give the cohort query something to compare against.
--
-- ── is_reference ────────────────────────────────────────────────────────────
-- Reference rows are corpus material, NOT tenants. They have no operator
-- (user_id IS NULL) and must never surface in an operator-scoped read. The
-- uniqueness cohort query is the single place they are wanted — it is
-- deliberately cross-tenant, because an operator is being compared against the
-- Cebu market rather than against their own account.
--   Guard test: ReferenceProfileIsolationTest (03-spring-calibration.md Task 12).
--
-- ── Cohort density ──────────────────────────────────────────────────────────
-- Counts are deliberately uneven so the density messaging on the onboarding
-- score screen has real data behind it rather than invented tiers:
--     dense     Coastal & Island 12, Adventure & Nature 12, Culinary 12
--     moderate  Accommodation 9, Cultural & Heritage 9
--     sparse    Urban & City 5, Theme Parks / Entertainment 5
-- Descriptions run 55-70 words and UVPs 32-45 words — the lengths real
-- onboarding produces, since obDraft.tsx enforces >=50 and >=30. A corpus of
-- one-line summaries would make every real operator look artificially unique.
--
-- ID convention follows V2: reference profiles use 25000000-…-0000000000NN.
-- V2 uses 20000000-… for the 9 seeded demo operators' own profiles; those stay
-- is_reference = FALSE because they are real tenants with login credentials.

-- ── Schema ──────────────────────────────────────────────────────────────────

ALTER TABLE tbl_business_profile
    ADD COLUMN IF NOT EXISTS is_reference BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN tbl_business_profile.is_reference IS
    'TRUE for uniqueness-corpus reference rows (no operator). Must be excluded '
    'from every operator-scoped query; included only by the uniqueness cohort.';

-- The 9 demo operators from V2 are tenants, not corpus. Explicit for the
-- avoidance of doubt even though FALSE is the column default.
UPDATE tbl_business_profile SET is_reference = FALSE WHERE user_id IS NOT NULL;

-- Cohort lookups filter by category then join to embeddings.
CREATE INDEX IF NOT EXISTS idx_biz_profile_reference_category
    ON tbl_business_profile (is_reference, categories);

-- ── Reference profiles ──────────────────────────────────────────────────────

INSERT INTO tbl_business_profile
    (business_profile_id, user_id, business_name, business_description, uvp,
     core_services, image_url, categories, confidence_score, uniqueness_score,
     is_reference, created_at, updated_at)
VALUES

-- ══ Coastal & Island (dense, 12) ════════════════════════════════════════════

('25000000-0000-0000-0000-000000000001', NULL,
 'Sumilon Sandbar Day Charters',
 'Day-boat charters from Bancogon port in Oslob out to the shifting sandbar off Sumilon Island, timed around the tide tables so guests land while the bar is still above water. Trips include two snorkel drops on the island''s marine sanctuary wall, a packed lunch of grilled tuna and puso, and a return leg that swings past the Tan-awan coastline in the early afternoon light.',
 'The only Oslob charter that publishes its sandbar timings from the actual tide tables a week ahead, so guests book the morning the bar is widest instead of arriving to find it underwater and being offered a reef stop as consolation.',
 'Sandbar day charters,Marine sanctuary snorkeling,Island packed lunches,Sunset return cruises',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-10 08:00:00+08', '2025-03-10 08:00:00+08'),

('25000000-0000-0000-0000-000000000002', NULL,
 'Pescador Island Dive Charters',
 'A six-boat dive operation on Panagsama Beach, Moalboal, running three daily departures to Pescador Island''s cathedral formation and the house reef sardine ball. Divers are grouped by certification level rather than by booking time, so open-water guests are never dragged onto a deep wall profile, and every boat carries oxygen, a spare regulator set, and a divemaster who surfaces last.',
 'Groups strictly by certification rather than by arrival, which means a first-time open-water diver never ends up on a 30-metre wall profile beside a technical diver, and the cathedral is dived at the depth each guest is actually rated for.',
 'Pescador Island dives,Sardine run house reef dives,Open water certification,Night dives',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-11 08:00:00+08', '2025-03-11 08:00:00+08'),

('25000000-0000-0000-0000-000000000003', NULL,
 'Malapascua Thresher Shark Divers',
 'Pre-dawn dive trips from Logon Beach, Malapascua, to the Monad Shoal cleaning station where thresher sharks rise from deep water at first light. Boats leave at four in the morning to reach the plateau before the sharks arrive, and each group is briefed on the shoal''s roped observation line, which divers stay behind so the cleaning behaviour is not disrupted.',
 'Runs the only Monad Shoal briefing that walks guests through the observation-line rules on land the night before rather than on a rocking boat at four in the morning, which is why our groups hold position and the sharks stay on the station.',
 'Thresher shark dives,Gato Island night dives,Wreck dives,Advanced certification courses',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-12 08:00:00+08', '2025-03-12 08:00:00+08'),

('25000000-0000-0000-0000-000000000004', NULL,
 'Camotes Island Hopping Collective',
 'A cooperative of eleven bangka owners on Pacijan Island running island-hopping circuits between Santiago Bay, Buho Rock, and the Timubo cave pools. Bookings rotate through the member boats on a fixed roster so no single family takes the season''s income, and every trip includes a stop at Lake Danao for lunch cooked by the boat crew''s own households.',
 'Bookings rotate on a published roster across eleven member families rather than going to whoever shouts loudest at the pier, so the income spreads through Pacijan and guests get a crew that is rested rather than on its fourth straight run.',
 'Island hopping circuits,Timubo cave swimming,Lake Danao lunches,Buho Rock cliff stops',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-13 08:00:00+08', '2025-03-13 08:00:00+08'),

('25000000-0000-0000-0000-000000000005', NULL,
 'Olango Reef Flats Snorkel Tours',
 'Shallow-water snorkel tours across the Olango Island reef flats, a twenty-minute crossing from Punta Engano on Mactan. Trips are scheduled to the neap tides when the flats sit waist-deep and clear, making them workable for children and non-swimmers in buoyancy vests. Guides carry laminated species cards and the route finishes at the sanctuary boardwalk on the island''s eastern shore.',
 'Built entirely around neap-tide windows on the shallow flats, so families with small children and adults who cannot swim get a genuine reef experience standing waist-deep instead of being told to wait on the boat.',
 'Shallow reef snorkeling,Family and non-swimmer tours,Bird sanctuary boardwalk visits,Species identification guiding',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-14 08:00:00+08', '2025-03-14 08:00:00+08'),

('25000000-0000-0000-0000-000000000006', NULL,
 'Sogod Bay Beach Club Charters',
 'Private beach-club day charters along the northern Cebu coast at Sogod, combining a cove landing, a shaded lunch setup carried in by the crew, and an afternoon paddleboard session in flat water. The operation runs from a single wooden bangka fitted with a sun canopy and a cooler bench, and takes one group per day rather than turning boats around twice.',
 'Takes exactly one booking per day on one boat, so the cove is genuinely private rather than shared with a second group arriving as the first leaves, and the crew sets up lunch on the sand instead of serving it on deck.',
 'Private cove charters,Beach lunch setups,Paddleboard sessions,Snorkel gear rental',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-15 08:00:00+08', '2025-03-15 08:00:00+08'),

('25000000-0000-0000-0000-000000000007', NULL,
 'Bantayan Sunset Bangka Cruises',
 'Evening sailing trips out of Santa Fe on Bantayan Island aboard a repainted fishing bangka, running ninety minutes offshore for the sunset and back under running lights. The crew serves calamansi juice and grilled squid cooked on a charcoal box mounted at the stern, and the boat carries no sound system, which is the point for most of the people who book it.',
 'Deliberately carries no sound system and caps the boat at twelve people, so the ninety minutes offshore are quiet enough to hear the hull, which is exactly what guests fleeing the party-boat circuit off Santa Fe are looking for.',
 'Sunset sailing cruises,Onboard grilled seafood,Private charters,Photography trips',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-16 08:00:00+08', '2025-03-16 08:00:00+08'),

('25000000-0000-0000-0000-000000000008', NULL,
 'Alegria Turtle Cove Snorkel Co.',
 'Shore-entry snorkel guiding at the turtle cove in Barangay Guadalupe, Alegria, where green turtles feed on the seagrass beds forty metres out. Guests walk in from the beach rather than boarding a boat, groups are capped at six, and every session opens with a briefing on the three-metre distance rule the barangay adopted after the site began drawing crowds.',
 'The only Alegria operator that walks guests in from shore instead of running boats over the seagrass beds the turtles feed on, and the only one whose distance-rule briefing is given before entry rather than shouted from the water.',
 'Shore-entry turtle snorkeling,Seagrass bed guiding,Underwater photography,Conservation briefings',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-17 08:00:00+08', '2025-03-17 08:00:00+08'),

('25000000-0000-0000-0000-000000000009', NULL,
 'Mactan Channel Paraw Sailing',
 'Traditional double-outrigger paraw sailing across the Mactan Channel, launched from a beach in Punta Engano under sail alone with no motor aboard. Trips run two hours on the afternoon wind, and guests are put on the tiller and the sheet if they want to be. The two boats were built by a shipwright in Cordova using the older, deeper hull pattern.',
 'Sails engineless on locally built deep-hull paraws and puts guests on the tiller, so the Mactan Channel is crossed the way it was before outboards, rather than motoring out and raising a decorative sail for photographs.',
 'Paraw sailing trips,Hands-on sailing instruction,Sunset sails,Traditional boatbuilding talks',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-18 08:00:00+08', '2025-03-18 08:00:00+08'),

('25000000-0000-0000-0000-000000000010', NULL,
 'Tingko Beach Family Boat Tours',
 'Half-day boat tours from Tingko Beach in Alcoy aimed squarely at families, running a short hop to a shallow snorkel patch, a beach stop with shade tents, and a return by mid-afternoon so young children are not out in the worst of the heat. Life vests are stocked in child sizes down to toddler, which most operators on this stretch do not carry.',
 'Stocks child and toddler life vests down to the smallest size and schedules the return for mid-afternoon, so families with under-fives are not improvising with adult vests or riding home at four in the heat.',
 'Family half-day boat tours,Shallow snorkeling,Beach shade setups,Child equipment provision',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-19 08:00:00+08', '2025-03-19 08:00:00+08'),

('25000000-0000-0000-0000-000000000011', NULL,
 'Aloguinsan Coastal Bangka Tours',
 'Community-run coastal boat tours out of Aloguinsan on the western Cebu coast, tracing the limestone shore between the Bojo river mouth and Hermit''s Cove. Boatmen are drawn from the barangay''s fishing association and trained as guides by the municipal tourism office. Trips run in the morning when the water off the cliffs is still glassy and the light is under the overhangs.',
 'Every boatman is a working Aloguinsan fisherman certified as a guide by the municipality, so the limestone shore is narrated by people who fish it daily, and the fees route back through the barangay association rather than an outside operator.',
 'Coastal limestone tours,Hermit''s Cove landings,River mouth paddling,Community guide programs',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-20 08:00:00+08', '2025-03-20 08:00:00+08'),

('25000000-0000-0000-0000-000000000012', NULL,
 'Ginatilan Sardine Wall Divers',
 'A two-boat dive shop in Ginatilan, at the southern end of Cebu''s west coast, working a steep sardine wall that sees a fraction of Moalboal''s traffic. Dives are run as shore-and-boat combinations, with the wall reached in eight minutes and the second dive usually on a shallow coral garden north of the pier. The shop fills its own tanks on site.',
 'Works a sardine wall eight minutes from the pier that sees a fraction of Moalboal''s boat traffic, and fills tanks on site rather than trucking them from Badian, so afternoon dives are not cancelled when the delivery is late.',
 'Wall dives,Shore dives,Tank filling and gear servicing,Small-group guiding',
 NULL, 'Coastal & Island', NULL, NULL, TRUE, '2025-03-21 08:00:00+08', '2025-03-21 08:00:00+08'),

-- ══ Adventure & Nature (dense, 12) ══════════════════════════════════════════

('25000000-0000-0000-0000-000000000013', NULL,
 'Osmeña Peak Ridge Treks',
 'Guided treks along the jagged limestone ridge at Osmeña Peak in Mantalongon, Dalaguete, starting from the vegetable-terrace trailhead before four in the morning to reach the summit for sunrise. The longer route continues down the back of the ridge to Dalaguete proper, a five-hour descent through cabbage terraces that most operators skip in favour of a van pickup at the top.',
 'Runs the full ridge-to-Dalaguete descent through the cabbage terraces rather than driving guests back down from the summit, which turns a sunrise photo stop into an actual day of walking and puts lunch money into the terrace households along the way.',
 'Sunrise ridge treks,Ridge-to-town descents,Camping support,Terrace farm visits',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-22 08:00:00+08', '2025-03-22 08:00:00+08'),

('25000000-0000-0000-0000-000000000014', NULL,
 'Kanlaob Canyon Descents',
 'Canyoneering operator working the Kanlaob river gorge from the Alegria side, descending through a sequence of jumps, two rappels, and a chest-deep flume before the exit at the upper tiers of Kawasan Falls. The team is nine guides, all water-safety certified, and the shop keeps a river gauge reading from the upstream barangay posted at the trailhead each morning.',
 'Posts the upstream gauge reading at the trailhead every morning and closes the canyon outright above flood stage, refunding rather than rescheduling, which is why we run fewer days a season than the operators who launch regardless of the water.',
 'Canyoneering descents,Rappelling instruction,Water safety training,Falls exit trips',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-23 08:00:00+08', '2025-03-23 08:00:00+08'),

('25000000-0000-0000-0000-000000000015', NULL,
 'Cebu Highlands Trail Guides',
 'Multi-day trekking support along the Cebu Highlands Trail, the long-distance route running the island''s central spine from Danao in the north toward Santander. The outfit handles segment logistics, homestay bookings in the ridge barangays, and resupply drops, and guides the harder karst sections where the trail crosses private land and the right of way needs local negotiation.',
 'The only outfit holding standing right-of-way arrangements with the ridge landowners on the trail''s karst sections, so multi-day walkers cross private ground with permission already in place instead of being turned back at a fence line.',
 'Multi-day trek support,Homestay logistics,Resupply drops,Karst section guiding',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-24 08:00:00+08', '2025-03-24 08:00:00+08'),

('25000000-0000-0000-0000-000000000016', NULL,
 'Tabunan Forest Birding',
 'Dawn birding walks in the Tabunan forest block above Cebu City, one of the last fragments of old-growth left on the island and the stronghold of the Cebu flowerpecker. Groups are capped at four, walks start at half past four, and the guides work from a fifteen-year sighting log kept for the block rather than a generic Philippine field list.',
 'Works from a fifteen-year sighting log kept specifically for the Tabunan block, so groups are walked to where the flowerpecker has actually been recorded this month rather than to the viewpoint every tour uses.',
 'Dawn birding walks,Endemic species guiding,Photography hides,Conservation education',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-25 08:00:00+08', '2025-03-25 08:00:00+08'),

('25000000-0000-0000-0000-000000000017', NULL,
 'Bojo River Paddle Guides',
 'Community paddle tours up the Bojo river in Aloguinsan, a slow mangrove-lined estuary that opens to the sea through a limestone gap. Boats are paddled rather than motored, the guides are members of the local peoples'' organisation that manages the river, and the trip ends with a fish lunch cooked at the association''s riverside kitchen.',
 'The river is managed by the guides'' own peoples'' organisation, which sets the daily boat cap and keeps the estuary paddle-only, so the mangrove channel stays quiet enough for kingfishers instead of being run at outboard speed.',
 'Mangrove paddle tours,Estuary birdwatching,Community kitchen lunches,River conservation talks',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-26 08:00:00+08', '2025-03-26 08:00:00+08'),

('25000000-0000-0000-0000-000000000018', NULL,
 'Sirao Peak Sunrise Rides',
 'Habal-habal motorcycle runs from Cebu City up the Transcentral Highway to the Sirao and Kan-Irag ridge for sunrise, returning through the flower farms by mid-morning. Riders are all licensed and the operation maintains its own machines rather than subcontracting to whoever is at the terminal, which is the usual arrangement on this route.',
 'Owns and services its own bikes and employs licensed riders on payroll, rather than subcontracting at the terminal, so the machine going up the Transcentral at four in the morning has a maintenance record somebody can produce.',
 'Sunrise ridge rides,Flower farm circuits,Photography transport,Highland village stops',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-27 08:00:00+08', '2025-03-27 08:00:00+08'),

('25000000-0000-0000-0000-000000000019', NULL,
 'Mantayupan Falls Rappel Co.',
 'Rappelling and via ferrata operator at Mantayupan Falls in Barili, working the ninety-metre upper drop and a shorter training wall beside it. Every guest runs the training wall first regardless of claimed experience, and the anchors on the main drop are inspected and logged before the first descent of each day.',
 'Puts every guest on the training wall before the ninety-metre drop no matter what experience they claim, and logs an anchor inspection each morning, which is why we turn away roughly one booking in ten at the wall.',
 'Waterfall rappelling,Via ferrata routes,Rope skills training,Anchor safety programs',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-28 08:00:00+08', '2025-03-28 08:00:00+08'),

('25000000-0000-0000-0000-000000000020', NULL,
 'Casino Peak Scramble Tours',
 'Half-day scrambles on the limestone teeth of Casino Peak near Mantalongon, a shorter and steeper outing than the neighbouring Osmeña ridge and largely hands-on rock rather than walking. Groups are six at most because the summit blocks hold no more than that safely, and helmets are issued for the loose upper section.',
 'Caps groups at six because the summit blocks hold no more, and issues helmets for the loose upper section, on a peak where the standard practice is to take twenty people up bare-headed and photograph them on the same rock.',
 'Limestone scrambling,Helmet-issued summit trips,Small-group guiding,Sunrise scrambles',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-29 08:00:00+08', '2025-03-29 08:00:00+08'),

('25000000-0000-0000-0000-000000000021', NULL,
 'Buhisan Watershed Mountain Bike Tours',
 'Guided mountain-bike descents through the Buhisan watershed reserve above Cebu City, using the old fire roads and singletrack that drop back toward Guadalupe. Bikes are provided and serviced in-house, the routes are graded green through black, and rides are cancelled outright in heavy rain because the clay surface tears when it is wet.',
 'Cancels rides outright in heavy rain because the watershed clay tears and takes a season to recover, which costs us bookings and is the reason the singletrack we ride is still rideable after eleven years.',
 'Guided MTB descents,Bike rental and servicing,Skills clinics,Trail maintenance programs',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-30 08:00:00+08', '2025-03-30 08:00:00+08'),

('25000000-0000-0000-0000-000000000022', NULL,
 'Cantabaco Rock Climbing School',
 'Sport-climbing instruction on the limestone crag at Cantabaco, Toledo City, the island''s main climbing wall with routes from beginner slabs to long overhanging pitches. The school runs belay certification over two days, maintains a bolt fund for the crag, and keeps a logbook of which routes have been rebolted and when.',
 'Keeps and publishes the rebolting log for the entire Cantabaco crag, funded by a levy on every course we run, so climbers know the age of the hardware they are clipping instead of guessing from the colour of the hanger.',
 'Sport climbing instruction,Belay certification,Bolt fund and rebolting,Guided crag days',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-03-31 08:00:00+08', '2025-03-31 08:00:00+08'),

('25000000-0000-0000-0000-000000000023', NULL,
 'Cebu Karst Cave Expeditions',
 'Caving trips into the karst systems around Argao and Dalaguete, ranging from a walk-through river cave suitable for beginners to a vertical system requiring a single-rope descent. Group sizes are set by the passage rather than by demand, and the operation works to a rotation that rests each cave for a fortnight between visits.',
 'Rests every cave for a fortnight between trips on a published rotation, so bat colonies are not disturbed weekly, and sets group size by the passage width rather than by how many people want to come that day.',
 'River cave walkthroughs,Vertical caving,Single-rope technique training,Cave conservation rotations',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-04-01 08:00:00+08', '2025-04-01 08:00:00+08'),

('25000000-0000-0000-0000-000000000024', NULL,
 'Inambakan Falls Canyon Walks',
 'Walking and swimming routes through the Inambakan and Cambais falls system in Ginatilan, southern Cebu, linking three cascades by river-level paths rather than road transfers. The trip involves several swims, no jumps, and no ropes, which makes it a canyon day for people who want the water without the exposure.',
 'Links the three Ginatilan cascades at river level with no jumps and no ropes, which is a genuinely different product from the canyoneering next door and the only option here for guests who want the gorge without the exposure.',
 'River-level canyon walks,Multi-falls circuits,Swimming-based trips,Non-technical guiding',
 NULL, 'Adventure & Nature', NULL, NULL, TRUE, '2025-04-02 08:00:00+08', '2025-04-02 08:00:00+08'),

-- ══ Culinary & Gastronomy (dense, 12) ═══════════════════════════════════════

('25000000-0000-0000-0000-000000000025', NULL,
 'Talisay Lechon Belly Bar',
 'A counter-service lechon belly shop on the national road in Talisay City, roasting rolled belly rather than whole pigs so the skin-to-meat ratio stays consistent through the day. Batches come off the charcoal every ninety minutes from ten in the morning, and the shop closes when the last batch sells rather than holding stock overnight.',
 'Roasts rolled belly in ninety-minute batches and closes when the last one sells rather than reheating, so nobody is ever served lechon that has been sitting since the lunch rush, which is the standard practice along this stretch of the national road.',
 'Lechon belly by the kilo,Counter dining,Batch roasting,Party trays',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-03 08:00:00+08', '2025-04-03 08:00:00+08'),

('25000000-0000-0000-0000-000000000026', NULL,
 'Cebu Sutukil Seafood Kitchen',
 'A sutukil kitchen beside the Mactan public market where guests choose fish from the wet stalls and carry it next door to be cooked three ways — grilled, stewed in sour broth, and served raw in vinegar. The kitchen charges a cooking fee by weight rather than marking up the fish, so the market price is the price.',
 'Charges a flat cooking fee by weight and never marks up the fish, so guests pay the actual wet-market price they watched being weighed, in a market where the usual arrangement is a quiet commission split with the stall.',
 'Sutukil cooking service,Market fish sourcing,Grilled and kinilaw preparation,Group dining',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-04 08:00:00+08', '2025-04-04 08:00:00+08'),

('25000000-0000-0000-0000-000000000027', NULL,
 'Danao Chorizo Makers',
 'A family sausage works in Danao City producing the sweet and garlicky Cebuano chorizo in casings, hand-linked and air-dried on racks rather than machine-extruded. The operation runs a small retail counter, supplies market stalls across northern Cebu, and takes visitors through the mixing and linking room on weekday mornings. The recipe has not changed since the founder''s mother set the sugar and garlic ratio in the nineteen sixties.',
 'Hand-links and air-dries on racks rather than machine-extruding, which is why the Danao chorizo here has a casing snap that the vacuum-packed supermarket version cannot reproduce, and why the northern market stalls buy from this room.',
 'Cebuano chorizo production,Retail counter sales,Wholesale supply,Production floor tours',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-05 08:00:00+08', '2025-04-05 08:00:00+08'),

('25000000-0000-0000-0000-000000000028', NULL,
 'Argao Torta Bakehouse',
 'A bakehouse in Argao producing the town''s heavy, lard-enriched torta in a wood-fired brick oven, using tuba as the leavening agent the way the recipe was written before commercial yeast. Loaves are baked in the early morning, sold from the front window, and the oven is fired with mango wood cut from the municipality.',
 'Still leavens with fermented tuba rather than commercial yeast and fires the brick oven with local mango wood, which is why the Argao torta here goes stale in three days like it is supposed to instead of keeping for a fortnight.',
 'Wood-fired torta baking,Tuba-leavened breads,Front-window retail,Baking demonstrations',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-06 08:00:00+08', '2025-04-06 08:00:00+08'),

('25000000-0000-0000-0000-000000000029', NULL,
 'Liloan Rosquillos Heritage Bakery',
 'The rosquillos bakery in Liloan working from the original ring-shaped biscuit recipe the town is known for, cut by hand with a scalloped stamp and baked in shallow trays. The bakery keeps a display of the older stamping tools and sells seconds by the bag at the back counter, which is where most of the town buys.',
 'Hand-stamps every rosquillos ring with the scalloped cutter rather than sheet-cutting, and sells the broken seconds cheaply at the back counter, which is why Liloan households buy here and tourists buy the boxed version at the highway stalls.',
 'Rosquillos baking,Heritage recipe production,Boxed pasalubong,Bakery tours',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-07 08:00:00+08', '2025-04-07 08:00:00+08'),

('25000000-0000-0000-0000-000000000030', NULL,
 'Cebu Dried Mango Tasting Room',
 'A tasting room attached to a small dried-mango processor outside Mandaue, running comparative flights of fruit dried at different sugar levels and from different harvest months. Visitors taste unsweetened, lightly sweetened, and the standard export cut side by side, which is the only way most people discover they prefer the unsweetened.',
 'Runs comparative flights across sugar levels and harvest months rather than handing out one sample of the export cut, so visitors leave knowing which style they actually like instead of buying the only version they were given.',
 'Dried mango tastings,Comparative flights,Processor tours,Direct retail',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-08 08:00:00+08', '2025-04-08 08:00:00+08'),

('25000000-0000-0000-0000-000000000031', NULL,
 'Mandaue Puso Weaving & Grill',
 'A roadside grill in Mandaue that weaves its own puso on site from coconut fronds cut the same morning, rather than buying pre-woven bundles from the market. The grill runs pork belly, chicken inasal, and isaw over charcoal from late afternoon, and teaches the weaving to anyone who waits at the counter long enough to ask.',
 'Weaves its own puso on site from fronds cut that morning instead of buying pre-woven bundles, so the rice comes out of a leaf that is still green, and anyone who asks at the counter gets taught the fold.',
 'Charcoal grilling,On-site puso weaving,Weaving demonstrations,Late-night service',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-09 08:00:00+08', '2025-04-09 08:00:00+08'),

('25000000-0000-0000-0000-000000000032', NULL,
 'Carcar Chicharon Row Tours',
 'Guided tasting walks along the chicharon row at the Carcar public market, comparing the puffed, the meaty, and the laminated styles across six long-established stalls. The walk includes the rendering yard behind the market where the pork rind is prepared, which visitors are almost never shown. Groups are kept to eight so the stallholders can still serve their regular market customers while the tasting runs.',
 'Takes guests into the rendering yard behind the Carcar market that no walk-in tourist sees, and compares six stalls side by side, so the difference between puffed and laminated chicharon is tasted rather than explained.',
 'Chicharon tasting walks,Market stall comparisons,Rendering yard visits,Pasalubong sourcing',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-10 08:00:00+08', '2025-04-10 08:00:00+08'),

('25000000-0000-0000-0000-000000000033', NULL,
 'Bantayan Dried Fish Kitchen',
 'A drying yard and kitchen on Bantayan Island working danggit and pusit through a salt-and-sun process on raised bamboo racks, then serving them for breakfast with garlic rice and vinegar. The yard is open to visitors during the morning turn, when the fish are flipped and the racks are moved to follow the sun.',
 'Opens the drying yard to visitors during the morning rack turn rather than selling finished packs from a storefront, so guests see the salt-and-sun process that separates Bantayan danggit from the oven-dried product sold as it.',
 'Danggit and pusit drying,Breakfast service,Drying yard visits,Vacuum-packed retail',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-11 08:00:00+08', '2025-04-11 08:00:00+08'),

('25000000-0000-0000-0000-000000000034', NULL,
 'Cebu Cacao & Sikwate House',
 'A sikwate house in Cebu City grinding its own tablea from cacao bought directly from farms in Balamban and Toledo, roasted and stone-ground on the premises. Chocolate is served thick in clay cups with puto maya and ripe mango, and the grinding room is visible from the seating area through a glass panel.',
 'Buys cacao direct from named Balamban and Toledo farms and stone-grinds the tablea in a room guests can watch through glass, rather than reselling bulk tablea from the market like every other sikwate counter in the city.',
 'Sikwate service,On-site tablea grinding,Direct farm sourcing,Puto maya breakfasts',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-12 08:00:00+08', '2025-04-12 08:00:00+08'),

('25000000-0000-0000-0000-000000000035', NULL,
 'Larsian Barbecue Night Tours',
 'Evening eating tours through the Larsian barbecue hall off Fuente Osmeña, working across four stalls to compare marinades, and finishing with tuslob buwa at a nearby alley counter. The tour is priced to cover the food outright so guests are not handed a bill at each stop, and it runs late enough to catch the hall at full smoke.',
 'Prices the food into the ticket across four Larsian stalls so nobody is settling four separate bills in the smoke, and runs late enough to hit the hall at its busiest rather than at the tourist-friendly early sitting.',
 'Barbecue hall tours,Multi-stall tastings,Tuslob buwa stops,Late-night food walks',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-13 08:00:00+08', '2025-04-13 08:00:00+08'),

('25000000-0000-0000-0000-000000000036', NULL,
 'Tuburan Bibingka Clay Oven',
 'A bibingka stall in Tuburan baking in clay pots with coals set both under and on the lid, the older method that has largely given way to sheet ovens. Rice batter is ground fresh each morning from soaked grain rather than mixed from flour, and the stall operates only from dawn until the batter runs out.',
 'Bakes in clay pots with coals above and below and grinds the rice batter fresh from soaked grain each dawn, a method that costs us three hours a morning and is the reason the texture cannot be matched by the sheet-oven stalls.',
 'Clay-pot bibingka,Fresh-ground rice batter,Dawn service,Traditional method demonstrations',
 NULL, 'Culinary & Gastronomy', NULL, NULL, TRUE, '2025-04-14 08:00:00+08', '2025-04-14 08:00:00+08'),

-- ══ Accommodation & Staycation (moderate, 9) ════════════════════════════════

('25000000-0000-0000-0000-000000000037', NULL,
 'Moalboal Cliffside Guesthouse',
 'An eight-room guesthouse set on the low cliff above Panagsama Beach in Moalboal, with rooms opening onto a shared terrace over the water and a stair cut down to the house reef. There is no pool and no restaurant; guests use the dive shops and eateries along the beach path, which is a two-minute walk below.',
 'Deliberately has no pool and no restaurant, keeping rates well under the beachfront resorts while putting guests directly above the house reef, which suits divers who spend their day in the water and their evening on the beach path.',
 'Cliffside rooms,House reef stair access,Long-stay diver rates,Terrace common areas',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-15 08:00:00+08', '2025-04-15 08:00:00+08'),

('25000000-0000-0000-0000-000000000038', NULL,
 'Bantayan Sandbar Cottages',
 'Six nipa-roofed cottages on the sand at the northern end of Santa Fe, Bantayan, built on posts above the tide line with shuttered windows rather than glass. Power runs on a solar bank with a generator backup, and the cottages are spaced far enough apart that neighbours are not audible, which is unusual on this beach.',
 'Runs on a solar bank rather than mains power and spaces six cottages across a stretch that most operators would fit twelve on, so the northern Santa Fe sand stays quiet and the cottages keep working through the island''s brownouts.',
 'Beachfront cottages,Solar-powered accommodation,Low-density siting,Long-stay bookings',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-16 08:00:00+08', '2025-04-16 08:00:00+08'),

('25000000-0000-0000-0000-000000000039', NULL,
 'Camotes Lakeside Cabins',
 'Four timber cabins on the shore of Lake Danao on Pacijan Island, Camotes, each with a small dock and a kayak. The site is a twenty-minute ride from the Consuelo port and has no through road past it, so the lake edge stays quiet after the day visitors leave in the late afternoon.',
 'Sits past the end of the through road on Lake Danao, so once the day visitors leave in the afternoon the only boats on the water are the four tied to our own docks, which no lakeside property nearer the port can offer.',
 'Lakeside cabins,Private docks and kayaks,Fishing access,Off-road quiet siting',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-17 08:00:00+08', '2025-04-17 08:00:00+08'),

('25000000-0000-0000-0000-000000000040', NULL,
 'Argao Heritage Casa Stay',
 'A restored bahay na bato in the Argao heritage district let as a whole-house stay, with capiz shutters, a wide molave staircase, and the original ground-floor stone walls. The house sleeps nine, sits a block from the church complex, and is furnished with pieces recovered from the family''s own storerooms rather than reproductions.',
 'Lets the entire restored bahay na bato to one party rather than renting rooms, furnished from the family''s own recovered pieces, so guests occupy a heritage house as a household would instead of as guests in a converted hotel.',
 'Whole-house heritage stays,Restored ancestral interiors,Walking access to the church complex,Family group bookings',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-18 08:00:00+08', '2025-04-18 08:00:00+08'),

('25000000-0000-0000-0000-000000000041', NULL,
 'Malapascua Dive Lodge',
 'A twelve-room lodge on Logon Beach, Malapascua, built around the pre-dawn thresher shark schedule: breakfast is served from half past three, tanks are loaded the night before, and rooms are grouped so early risers are not sharing a wall with late sleepers. Rooms are simple concrete and nipa with cold water only, which keeps the rate low for divers staying a week or more between thresher mornings.',
 'Built entirely around the half-past-three thresher departure — breakfast that early, tanks loaded the night before, and rooms zoned by wake time — which no general-purpose Logon Beach resort attempts.',
 'Dive-schedule lodging,Pre-dawn breakfast service,Tank and gear storage,Zoned room allocation',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-19 08:00:00+08', '2025-04-19 08:00:00+08'),

('25000000-0000-0000-0000-000000000042', NULL,
 'Busay Ridge Mountain Villas',
 'Three villas on the Busay ridge above Cebu City at around six hundred metres, high enough that the evenings need a blanket and the city reads as a grid of light below. Each villa has its own kitchen and a deck facing west, and the site is fifteen minutes above the Transcentral junction.',
 'Sits high enough on the Busay ridge that rooms genuinely do not need air-conditioning at night, which the lower staycation properties along the Transcentral cannot claim, and each villa has a full kitchen rather than a minibar.',
 'Ridge-top villas,Self-catering kitchens,City-view decks,Cool-climate staycations',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-20 08:00:00+08', '2025-04-20 08:00:00+08'),

('25000000-0000-0000-0000-000000000043', NULL,
 'Cordova Mangrove Eco-Huts',
 'Stilt huts set among replanted mangroves at the Cordova wetland on Mactan, reached by a boardwalk from the barangay road. The huts have composting toilets and rainwater catchment, and a portion of every booking funds the propagation nursery that supplies the replanting sites along the channel. Each hut sleeps two, and the boardwalk is lit only at the handrail so the wetland stays dark after sundown.',
 'Every booking funds the propagation nursery supplying the Cordova replanting sites, and the huts run on composting toilets and rainwater catchment, so the wetland the guests came to sleep in is not being degraded by their staying there.',
 'Stilt hut accommodation,Composting and rainwater systems,Mangrove nursery funding,Boardwalk wetland access',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-21 08:00:00+08', '2025-04-21 08:00:00+08'),

('25000000-0000-0000-0000-000000000044', NULL,
 'Badian Riverside Glamping',
 'Canvas tents on raised platforms along the river in Badian, upstream of the canyoneering exit, each with a proper bed, a fan, and a private shower block behind. The camp is walk-in from a parking area two hundred metres away, and the river runs shallow enough here to sit in.',
 'Pitches on raised platforms upstream of the canyoneering exit where the river runs shallow and quiet, so guests get river frontage without the queues of wet, helmeted groups that pass the downstream properties all afternoon.',
 'Riverside glamping tents,Raised platform pitches,Private shower blocks,River swimming access',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-22 08:00:00+08', '2025-04-22 08:00:00+08'),

('25000000-0000-0000-0000-000000000045', NULL,
 'Cebu City Capsule Stay',
 'A capsule hostel near the Fuente Osmeña rotunda aimed at transiting divers and backpackers, with sixty pods, locked gear cages sized for dive luggage, and a wash-and-dry service that turns around overnight. Check-in runs twenty-four hours because most guests arrive off the northern bus or a late flight. Pods are grouped by check-out time so a four in the morning airport departure does not wake the whole floor.',
 'Sized its gear cages for dive luggage and staffed check-in around the clock, because the guests are transiting between Malapascua and the airport at hours when every other Fuente-area hostel has the shutter down.',
 'Capsule accommodation,Dive luggage storage,Overnight laundry,24-hour check-in',
 NULL, 'Accommodation & Staycation', NULL, NULL, TRUE, '2025-04-23 08:00:00+08', '2025-04-23 08:00:00+08'),

-- ══ Cultural & Heritage (moderate, 9) ═══════════════════════════════════════

('25000000-0000-0000-0000-000000000046', NULL,
 'Carcar Heritage House Tours',
 'Walking tours of the Carcar heritage district covering the Balay na Tisa, the rotunda, and four privately owned ancestral houses whose families open their ground floors by arrangement. The route is timed for late afternoon when the light comes through the capiz, and ends at the public market''s chicharon row.',
 'Holds standing arrangements with four Carcar families to open their private ancestral ground floors, so the route goes inside houses that are locked to every other tour, rather than photographing facades from the road.',
 'Heritage district walks,Private ancestral house access,Architectural interpretation,Market finishes',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-04-24 08:00:00+08', '2025-04-24 08:00:00+08'),

('25000000-0000-0000-0000-000000000047', NULL,
 'Argao Church & Bakehouse Walks',
 'Guided visits to the Argao church complex — the baroque facade, the coral-stone convento, and the walled cemetery chapel outside town — paired with a stop at a working tuba-leavened bakehouse. The guides are drawn from the parish heritage committee and have access to the convento rooms not on the public route.',
 'Guided by parish heritage committee members who can open the convento rooms closed to the public route, and paired with a working bakehouse rather than a souvenir stop, which is how the church and the town''s food history connect.',
 'Church complex tours,Convento interior access,Cemetery chapel visits,Heritage bakehouse stops',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-04-25 08:00:00+08', '2025-04-25 08:00:00+08'),

('25000000-0000-0000-0000-000000000048', NULL,
 'Boljoon Fortress Church Guides',
 'Interpretation at the Boljoon church and its surviving defensive complex on southern Cebu''s coast — the watchtower, the fortified walls, and the parish museum holding the retablo fragments. Guides work from the parish archive and the National Museum''s documentation of the site''s declaration. Sessions run ninety minutes and start at the sea wall rather than the church door, because the site only makes sense read from the water inward.',
 'Works from the parish archive and the National Museum declaration documents rather than a script, which matters at a site where most of what visitors are told about the raids and the fortifications is repeated local invention.',
 'Fortress church interpretation,Watchtower visits,Parish museum tours,Archival-based guiding',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-04-26 08:00:00+08', '2025-04-26 08:00:00+08'),

('25000000-0000-0000-0000-000000000049', NULL,
 'Cebu Santo Niño Devotion Walks',
 'Walks tracing the Santo Niño devotion through the Basilica, the Magellan''s Cross kiosk, and the smaller neighbourhood chapels that hold their own replicas and processions. The route runs on Fridays when the novena fills the pilgrim centre, and the guide explains the sinulog gesture as devotion rather than as festival choreography.',
 'Runs on novena Fridays and covers the neighbourhood chapels with their own replicas, framing the sinulog gesture as a devotional act rather than festival choreography, which is the opposite of how the January tour circuit presents it.',
 'Devotion walking tours,Basilica and chapel visits,Novena-day guiding,Religious practice interpretation',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-04-27 08:00:00+08', '2025-04-27 08:00:00+08'),

('25000000-0000-0000-0000-000000000050', NULL,
 'Abuno Guitar Workshop Visits',
 'Visits to the guitar-making workshops in Abuno, Lapu-Lapu City, where instruments are still built from jackfruit and mahogany with hand-bent sides. The visit covers bending, bracing, and finishing benches, and guests can hear the same model played in raw and finished states, which is the part that changes minds about the price difference.',
 'Takes guests through bending, bracing and finishing benches and lets them hear one model raw and finished side by side, rather than the showroom walkthrough the highway outlets run to move factory instruments.',
 'Luthier workshop visits,Instrument construction demonstrations,Comparative playing sessions,Direct workshop purchasing',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-04-28 08:00:00+08', '2025-04-28 08:00:00+08'),

('25000000-0000-0000-0000-000000000051', NULL,
 'Talisay Landing Memorial Tours',
 'Tours of the Talisay landing beaches and the memorial marking the 1945 return, covering the shoreline positions, the inland route the advance followed, and the civilian evacuation sites in the hills above. The guide works from unit records and from oral accounts collected in the barangays along the route. The full route takes most of a day and covers about six kilometres on foot.',
 'Pairs unit records with oral accounts collected from the barangays along the inland route, so the civilian evacuation into the hills is part of the story rather than a footnote to the landing beaches.',
 'Second World War site tours,Landing beach interpretation,Inland route walks,Oral history sessions',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-04-29 08:00:00+08', '2025-04-29 08:00:00+08'),

('25000000-0000-0000-0000-000000000052', NULL,
 'Sialo Kabilin Cultural Weekends',
 'Weekend cultural programmes across the southern Cebu towns of the old Sialo district, rotating between Oslob, Boljoon and Santander with dance, weaving, and cooking sessions run by household practitioners rather than a performing company. Each town hosts one weekend a month, with sessions running from Saturday morning through Sunday lunch, and participants stay in barangay homestays arranged through the host families rather than in hotels along the highway.',
 'Rotates weekends between three southern towns and is taught by household practitioners rather than a touring company, so the weaving and the dances shown are the versions those families actually keep rather than a staged composite.',
 'Rotating cultural weekends,Household-taught workshops,Weaving and dance sessions,Multi-town programming',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-04-30 08:00:00+08', '2025-04-30 08:00:00+08'),

('25000000-0000-0000-0000-000000000053', NULL,
 'Cebu Watchtower Circuit',
 'A full-day drive-and-walk circuit of the surviving Spanish-era coastal watchtowers down the island''s eastern and southern shores, from Liloan''s lighthouse to the coral-block baluartes at Dalaguete and Boljoon. Each stop covers the tower''s sightline to the next, which is the logic that explains their spacing. The day runs about ten hours including the drive, with lunch taken at a coastal carinderia between the Dalaguete and Boljoon stops.',
 'Presents the towers as a single sightline network by covering each one''s line to the next, which explains their spacing and is entirely lost when they are visited individually as photo stops on unrelated day trips.',
 'Watchtower circuit tours,Coastal defence interpretation,Full-day driving routes,Lighthouse visits',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-05-01 08:00:00+08', '2025-05-01 08:00:00+08'),

('25000000-0000-0000-0000-000000000054', NULL,
 'Bantayan Salt Making Heritage',
 'Demonstrations of the asin tibuok clay-pot salt process on Bantayan Island, from the soaking of driftwood in seawater through the burning and the filtering to the final firing of the brine in unglazed pots that must be broken to release the salt. Visitors join whichever stage is running that week, and the finished salt is sold in the same unglazed shards it was fired in.',
 'One of a handful of operations still firing brine in unglazed clay pots that have to be broken to release the salt, a process that takes months and that industrial sea-salt production replaced everywhere else on the island.',
 'Salt making demonstrations,Clay pot firing,Heritage food production,Direct salt sales',
 NULL, 'Cultural & Heritage', NULL, NULL, TRUE, '2025-05-02 08:00:00+08', '2025-05-02 08:00:00+08'),

-- ══ Urban & City (sparse, 5) ════════════════════════════════════════════════

('25000000-0000-0000-0000-000000000055', NULL,
 'Cebu Business Park Design Walks',
 'Afternoon walks through Cebu Business Park and the surrounding blocks looking at the city''s contemporary architecture, public art, and the older structures absorbed as the district was built out. The route ends at a design store and coffee bar on Cardinal Rosales Avenue. Walks run about two and a half hours at an easy pace, and the guide is a practising architect rather than a general city guide.',
 'Reads the Business Park as a built environment rather than a shopping destination, covering the absorbed older structures most walking tours route around, which makes it the only architecture-led walk in the district.',
 'Architecture walking tours,Public art routes,Design retail stops,Urban development interpretation',
 NULL, 'Urban & City', NULL, NULL, TRUE, '2025-05-03 08:00:00+08', '2025-05-03 08:00:00+08'),

('25000000-0000-0000-0000-000000000056', NULL,
 'Colon Vintage Cinema Tours',
 'Walking tours of the surviving and lost cinema houses along Colon Street, covering the art deco facades still standing, the sites that have become retail floors, and the projection room of one theatre whose owner opens it by appointment. The walk covers roughly two kilometres of Colon and the streets immediately behind it, and finishes at a surviving lobby that now trades as a hardware floor.',
 'Gets inside a Colon projection room by standing arrangement with the owner and maps the lost houses as well as the surviving facades, treating the street''s cinema era as documented history rather than nostalgia.',
 'Cinema heritage walks,Art deco facade tours,Projection room access,Colon Street history',
 NULL, 'Urban & City', NULL, NULL, TRUE, '2025-05-04 08:00:00+08', '2025-05-04 08:00:00+08'),

('25000000-0000-0000-0000-000000000057', NULL,
 'Cebu Night Market Circuit',
 'Evening circuits across three of the city''s night markets — Sugbo Mercado, the Mandaue weekend market, and a smaller barangay market that runs on Wednesdays — with transport between them and a fixed budget of tasting portions at each. The circuit runs from six in the evening until close to eleven, and the group travels together in a single van between the three stops.',
 'Links three markets across two cities in one evening with transport included, including a Wednesday barangay market no visitor finds alone, instead of parking guests at Sugbo Mercado for the night like every other food tour.',
 'Night market circuits,Inter-market transport,Fixed tasting budgets,Local market access',
 NULL, 'Urban & City', NULL, NULL, TRUE, '2025-05-05 08:00:00+08', '2025-05-05 08:00:00+08'),

('25000000-0000-0000-0000-000000000058', NULL,
 'Mango Avenue Live Music Crawl',
 'A guided crawl of the live music rooms along General Maxilom Avenue, built around the house bands rather than the venues, with the night''s route set by who is actually playing that week rather than by a fixed list of bars. Four rooms are visited across an evening, with the group arriving at each between sets so introductions to the musicians are possible.',
 'Sets the route each week by which house bands are actually playing rather than running a fixed bar list, which is why regulars book it repeatedly and why it never lands a group in a room with a backing track.',
 'Live music crawls,House band programming,Weekly route planning,Venue introductions',
 NULL, 'Urban & City', NULL, NULL, TRUE, '2025-05-06 08:00:00+08', '2025-05-06 08:00:00+08'),

('25000000-0000-0000-0000-000000000059', NULL,
 'Cebu Coworking & Nomad Tours',
 'Orientation services for remote workers arriving in Cebu, covering coworking space trials across IT Park and Banilad, SIM and banking setup, long-stay housing viewings, and an introduction to the weekly meetups where most arrivals find their footing. The programme runs across a full week, with each element booked in advance so arrivals are not spending their first days queuing at a bank branch.',
 'Bundles coworking trials, SIM and banking setup, and housing viewings into a single arrival week, which no coworking space offers because each one is selling only its own desks. and which no relocation agent here covers, because their business is corporate postings rather than independent remote workers',
 'Remote worker orientation,Coworking space trials,Housing viewings,Banking and SIM setup',
 NULL, 'Urban & City', NULL, NULL, TRUE, '2025-05-07 08:00:00+08', '2025-05-07 08:00:00+08'),

-- ══ Theme Parks / Entertainment (sparse, 5) ═════════════════════════════════

('25000000-0000-0000-0000-000000000060', NULL,
 'Anjo World Day Trip Shuttles',
 'Scheduled shuttle service and gate-bundled tickets to the Anjo World theme park in Minglanilla, running from three pickup points in Cebu City with a fixed return in the early evening. The service handles the ticket queue in advance so groups walk straight through the gate. Departures run on weekends and public holidays, with a second afternoon pickup for families who prefer to arrive after the midday heat.',
 'Bundles the gate ticket into a scheduled shuttle from three city pickup points, so families reach Minglanilla without a car and skip the ticket queue, which is the single largest complaint about the park on a weekend.',
 'Theme park shuttles,Bundled gate tickets,Group bookings,Scheduled city pickups',
 NULL, 'Theme Parks / Entertainment', NULL, NULL, TRUE, '2025-05-08 08:00:00+08', '2025-05-08 08:00:00+08'),

('25000000-0000-0000-0000-000000000061', NULL,
 'Cebu Ocean Park Guided Visits',
 'Guided visits to Cebu Ocean Park with an interpreter who covers the species, the husbandry, and the local reef context the tanks stand in, timed around the feeding and the dive show so groups are in position rather than queuing. Groups are capped at fifteen so the interpreter can be heard in front of the tanks, and school bookings include a worksheet set to the visit.',
 'Provides an interpreter who connects the tanks to the reefs outside and times the route around feeds so groups are in position, turning a self-guided walkthrough into a marine biology session for school and family groups.',
 'Guided aquarium visits,Species interpretation,Show and feeding timing,School group programs',
 NULL, 'Theme Parks / Entertainment', NULL, NULL, TRUE, '2025-05-09 08:00:00+08', '2025-05-09 08:00:00+08'),

('25000000-0000-0000-0000-000000000062', NULL,
 'Sky Experience Edge Bookings',
 'Booking and preparation service for the edge coaster and the tower ropes course at the Crown Regency in Cebu City, including a briefing beforehand for guests nervous about height and a photographer positioned on the deck below. The briefing runs in a ground-floor room before the lift up, and covers the harness system, the platform rules, and what the thirty-eighth floor will feel like.',
 'Briefs height-nervous guests properly before they are harnessed at the thirty-eighth floor and stations its own photographer on the deck, rather than selling a ticket and leaving people to work out the edge coaster on the platform.',
 'Edge coaster bookings,Ropes course access,Pre-ride briefings,Deck photography',
 NULL, 'Theme Parks / Entertainment', NULL, NULL, TRUE, '2025-05-10 08:00:00+08', '2025-05-10 08:00:00+08'),

('25000000-0000-0000-0000-000000000063', NULL,
 'Crocolandia Wildlife Park Tours',
 'Educational visits to the Crocolandia wildlife park in Talisay, focused on the endemic Philippine species held there and the rescue and rehabilitation work behind the enclosures, with keeper talks arranged in advance rather than left to chance. Visits run about two hours, and the route is ordered so the enclosures holding rescued animals are seen after the talk explaining how they arrived.',
 'Arranges keeper talks in advance so the rescue and rehabilitation work behind the enclosures is actually explained, which is what separates an educational visit from a walk past cages with a laminated sign on each.',
 'Wildlife park visits,Keeper talk arrangement,Endemic species education,School programs',
 NULL, 'Theme Parks / Entertainment', NULL, NULL, TRUE, '2025-05-11 08:00:00+08', '2025-05-11 08:00:00+08'),

('25000000-0000-0000-0000-000000000064', NULL,
 'Cebu Safari Day Transfers',
 'Day transfers from Cebu City to the safari and adventure park in Carmen, with an early departure that reaches the gate at opening, a route briefing on the two-hour drive, and a scheduled return that avoids the northbound evening traffic. The van leaves Cebu City at half past five, and the return is scheduled for four in the afternoon to clear Carmen before the highway backs up.',
 'Departs early enough to reach Carmen at opening and returns before the northbound evening traffic builds, which is the difference between seeing the park unhurried and spending three of the day''s hours on the highway.',
 'Safari park transfers,Early gate arrivals,Route briefings,Traffic-timed returns',
 NULL, 'Theme Parks / Entertainment', NULL, NULL, TRUE, '2025-05-12 08:00:00+08', '2025-05-12 08:00:00+08')

ON CONFLICT (business_profile_id) DO NOTHING;
