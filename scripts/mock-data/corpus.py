"""
Synthetic Cebu tourism MSME corpus for local uniqueness-scoring testing.

Deterministic: the same SEED always produces the same N businesses, so the
generated database is reproducible and the seeder can be re-run idempotently.

Design note on semantic spread
------------------------------
Uniqueness scoring (Module 1, Algorithm B) measures mean cosine distance from
the caller's E5 embedding to every other stored embedding.  A corpus of
template-filled clones collapses to near-zero distance and pins every score
low; a corpus of unrelated noise pins every score at 100.  Neither is useful
for testing.

So the corpus is built in two layers:

  * ARCHETYPES give genuine between-cluster distance -- a lechon house and a
    freediving school share almost no vocabulary.
  * Town / service / operating-detail variation gives within-cluster distance --
    four island-hopping outfits in four towns are similar but not identical.

The result is a realistic spread where some businesses are near-duplicates
(low uniqueness, as intended) and some are genuinely distinctive (high).
"""

from __future__ import annotations

import random

SEED = 20260904

# Must match CATEGORY_LABELS in backend/fastapi-sbert/app/services/ml_classifier.py
# and BUSINESS_CATEGORIES in frontend/components/module-1/onboarding/steps/BasicInfoStep.tsx
CATEGORIES = [
    "Coastal & Island",
    "Adventure & Nature",
    "Cultural & Heritage",
    "Theme Parks / Entertainment",
    "Urban & City",
    "Culinary & Gastronomy",
    "Accommodation & Staycation",
]

# Column order of tbl_business_categories_score
CATEGORY_COLUMNS = [
    "coastal_island", "adventure", "cultural",
    "theme_parks", "urban", "culinary", "accommodation",
]

MARKETS = ["korea", "japan", "usa"]

FIRST_NAMES = [
    "Ramon", "Marites", "Ferdinand", "Teresita", "Ariel", "Nena", "Christian",
    "Krizia", "Boyet", "Imelda", "Rodel", "Jocelyn", "Dante", "Mercedes",
    "Nonoy", "Lourdes", "Efren", "Divina", "Joel", "Cristina", "Alfonso",
    "Rowena", "Bernardo", "Perlita", "Gerardo", "Marilou", "Nestor", "Editha",
    "Rogelio", "Susana", "Wilfredo", "Aileen", "Ronaldo", "Gemma", "Danilo",
    "Rosalinda", "Eduardo", "Nerissa", "Manolo", "Corazon",
]

LAST_NAMES = [
    "Dela Cruz", "Abellana", "Bacus", "Osmena", "Cabahug", "Villaflor",
    "Mendiola", "Fernandez", "Lim", "Yap", "Go", "Tan", "Alcoseba", "Rama",
    "Duterte", "Garcia", "Sarmiento", "Cortes", "Empacis", "Baricuatro",
    "Kintanar", "Almendras", "Solon", "Zosa", "Veloso", "Pacana", "Ouano",
    "Seno", "Gantuangco", "Berdin", "Tumulak", "Labra", "Canete", "Booc",
]


# ---------------------------------------------------------------------------
# Archetypes -- each is a distinct semantic cluster
# ---------------------------------------------------------------------------

ARCHETYPES = [
    # -- Coastal & Island ---------------------------------------------------
    {
        "category": "Coastal & Island",
        "secondary": None,
        "towns": ["Moalboal", "Badian", "Alcoy", "Dalaguete", "Samboan"],
        "names": ["{town} Blue Reef Divers", "{town} Freedive Collective",
                  "Deep Current {town}", "{town} Sardine Run Divers"],
        "services": [
            "Freediving certification courses", "Guided sardine run snorkeling",
            "Turtle sanctuary boat trips", "Open water scuba certification",
            "Night dive excursions", "Underwater photography add-ons",
            "Full gear rental and servicing", "Reef conservation briefings",
        ],
        "opener": [
            "A PADI-affiliated dive and freediving outfit working the reef wall off {town}, "
            "running two boat departures a day from a small beachfront shophouse.",
            "A family-run dive centre on the {town} coast, operating out of a converted "
            "fisherman's bunkhouse a hundred metres from the drop-off.",
            "An owner-operated freediving school in {town} built around breath-hold training "
            "and the sardine ball that gathers over the shallow shelf each morning.",
        ],
        "middle": [
            "Groups are capped at {n} guests so instructors can keep every diver in sight along "
            "the wall, and courses run from beginner breath-hold basics through advanced depth work.",
            "The team logs the sardine ball's position at first light before any group leaves shore, "
            "which is why departures shift by up to an hour depending on the current.",
            "Every course includes a post-dive video debrief, and the shop maintains its own "
            "compressor and rental stock so trips are never cancelled for gear.",
        ],
        "closer": [
            "Instructors between them have logged over {k} hundred dives on this stretch of reef.",
            "The shop has run reef clean-ups with the {town} barangay every quarter since it opened.",
            "Roughly {pct} percent of guests arrive on referral from previous divers.",
        ],
        "uvp": [
            "The only {town} operator pairing certified freediving instruction with guided sardine-run "
            "snorkeling, so guests leave with both a new skill and a story.",
            "A dive shop that scouts the reef every morning before booking, so no group is ever sold "
            "a dive the conditions cannot support.",
            "Six-guest maximum groups on a coast where most operators run twenty, with instructors who "
            "know this single reef wall better than any dive map.",
        ],
    },
    {
        "category": "Coastal & Island",
        "secondary": "Adventure & Nature",
        "towns": ["Bantayan", "Malapascua", "Camotes", "Sumilon", "Pescador"],
        "names": ["{town} Island Hopping Co.", "{town} Outrigger Tours",
                  "Salt and Sail {town}", "{town} Sandbar Expeditions"],
        "services": [
            "Multi-island hopping day tours", "Private outrigger charters",
            "Sandbar picnic lunches", "Snorkeling gear provision",
            "Sunset cruise packages", "Island photography tours",
            "Overnight camping transfers", "Fishing village visits",
        ],
        "opener": [
            "An island-hopping operator sailing from {town} port with three outriggers and a crew of {n} "
            "boatmen, most of them former commercial fishermen from the same barangay.",
            "A small boat charter business running daily multi-island circuits out of {town}, built "
            "around tide tables rather than a fixed schedule.",
            "A {town}-based outrigger outfit offering private and shared island circuits, with a grilled "
            "seafood lunch cooked aboard on the return leg.",
        ],
        "middle": [
            "Routes are re-planned each morning against the tide chart so the sandbar stop always lands "
            "at low water, when the bar is fully exposed.",
            "Boats carry marine radios and life vests sized for children, and the crew handles all permit "
            "and sanctuary fees so guests never queue at the pier.",
            "Shared trips cap at {n} guests per boat; private charters take the same boat for a single group.",
        ],
        "closer": [
            "The crew has worked these channels for an average of {k} years each.",
            "Lunch is bought that morning from the {town} public market and grilled on board.",
            "About {pct} percent of bookings are repeat family groups.",
        ],
        "uvp": [
            "Tide-planned island circuits from {town}, so the sandbar stop is always at low water instead of "
            "underwater, a scheduling detail most operators ignore.",
            "Crews drawn entirely from {town} fishing families, which means the route adapts to the day's "
            "conditions rather than a printed itinerary.",
            "The only {town} charter that includes all sanctuary and permit fees up front, with no pier-side surcharges.",
        ],
    },
    # -- Adventure & Nature -------------------------------------------------
    {
        "category": "Adventure & Nature",
        "secondary": None,
        "towns": ["Badian", "Alegria", "Kawasan", "Matutinao", "Ginatilan"],
        "names": ["{town} Canyoneering Guides", "Whitewater {town}",
                  "{town} Falls Adventure Co.", "Gorge Runners {town}"],
        "services": [
            "Guided canyoneering descents", "Cliff jumping instruction",
            "Waterfall rappelling", "Helmet and life vest provision",
            "Trail-to-falls hiking packages", "Riverside lunch service",
            "Action camera rental", "Group safety briefings",
        ],
        "opener": [
            "A canyoneering outfit guiding the {town} gorge route, with certified rope handlers stationed "
            "at each of the {n} major jump points.",
            "An adventure guiding company running river descents through the {town} canyon system, "
            "operating on a staggered departure schedule to keep the gorge uncrowded.",
            "A locally licensed {town} canyoneering operator combining rappels, swims, and controlled "
            "cliff jumps across a half-day river route.",
        ],
        "middle": [
            "Every group carries a lead and a sweep guide, and jumps are optional at every point, with "
            "guides walking anyone who opts out around by a bypass trail.",
            "Departures are staggered at thirty-minute intervals so groups never stack up at the rappel stations.",
            "Water levels are checked at the upstream gauge each morning; the route closes outright after heavy rain.",
        ],
        "closer": [
            "Guides are first-aid certified and re-tested every {k} months.",
            "The company has run the route without a serious incident since opening.",
            "Around {pct} percent of guests are first-time canyoneers.",
        ],
        "uvp": [
            "Staggered small-group departures through the {town} gorge, so guests are not queuing at a rappel "
            "station behind three other tour buses.",
            "Every jump is optional with a guided bypass, which makes the {town} canyon route accessible to "
            "mixed-confidence groups rather than only thrill-seekers.",
            "A gorge operator that closes the route on its own call after heavy rain, rather than running "
            "groups through rising water to protect a day's bookings.",
        ],
    },
    {
        "category": "Adventure & Nature",
        "secondary": "Coastal & Island",
        "towns": ["Oslob", "Tanon Strait", "Moalboal", "Pescador", "Sumilon"],
        "names": ["{town} Whale Shark Encounters", "Blue Water {town} Wildlife",
                  "{town} Marine Safari", "{town} Dolphin Watch"],
        "services": [
            "Whale shark viewing transfers", "Dolphin watching cruises",
            "Marine wildlife briefings", "Snorkeling equipment rental",
            "Conservation talk sessions", "Sunrise departure packages",
            "Underwater videography", "Sanctuary fee handling",
        ],
        "opener": [
            "A marine wildlife operator running early-morning viewing trips off {town}, with a strict "
            "no-touch, no-feed briefing delivered before anyone enters the water.",
            "A {town} wildlife encounter outfit working with the local sanctuary office on regulated "
            "viewing slots and a fixed maximum swimmer count.",
            "A conservation-oriented boat operator on the {town} coast offering dolphin and whale shark "
            "viewing on sunrise departures.",
        ],
        "middle": [
            "Departures leave at first light when the animals are most active and the channel is calmest, "
            "with a maximum of {n} swimmers in the water at once.",
            "Guests sit through a mandatory conservation briefing covering minimum approach distances "
            "before boarding, and guides enforce the distance in the water.",
            "The company caps daily bookings well under the sanctuary's own limit to keep viewing pressure down.",
        ],
        "closer": [
            "A share of every booking goes to the {town} marine sanctuary fund.",
            "Guides have logged around {k} hundred viewing trips on this stretch of water.",
            "About {pct} percent of trips record a confirmed sighting.",
        ],
        "uvp": [
            "A whale shark operator that caps bookings below the sanctuary's legal limit, choosing lower "
            "volume over the crowding that {town} has become known for.",
            "Mandatory conservation briefings and enforced approach distances, aimed at travellers who "
            "want the encounter without the ethical compromise.",
            "Sunrise-only departures off {town}, when the water is clearest and the day-tripper boats "
            "have not yet arrived.",
        ],
    },
    {
        "category": "Adventure & Nature",
        "secondary": None,
        "towns": ["Osmena Peak", "Dalaguete", "Mantalongon", "Argao", "Balamban"],
        "names": ["{town} Trekking Collective", "Highland {town} Hikes",
                  "{town} Ridge Trails", "Summit {town} Guides"],
        "services": [
            "Guided summit treks", "Overnight camping expeditions",
            "Sunrise hike packages", "Camping gear rental",
            "Vegetable farm trail walks", "Habal-habal trailhead transfers",
            "Trail photography guiding", "Packed trail meals",
        ],
        "opener": [
            "A trekking outfit guiding the {town} ridge line, with routes ranging from a two-hour sunrise "
            "walk to an overnight traverse across {n} peaks.",
            "A highland hiking company based near {town}, running guided treks through terraced vegetable "
            "farms up onto the limestone ridge.",
            "A small guiding collective in {town} offering summit hikes and overnight camps on the "
            "grassland peaks above the farming barangays.",
        ],
        "middle": [
            "Guides are recruited from the farming households along the trail, and the route fee includes "
            "a land-access share paid directly to those families.",
            "Overnight groups camp on the ridge with gear carried in, and the company packs out every "
            "item of waste it brings up.",
            "Sunrise departures leave at two in the morning to reach the peak before first light.",
        ],
        "closer": [
            "The collective has guided roughly {k} hundred groups up the ridge since it formed.",
            "Trail fees support the {town} farmers association directly.",
            "Around {pct} percent of guests book the overnight rather than the day option.",
        ],
        "uvp": [
            "Guides who farm the land the trail crosses, paid a direct land-access share rather than a "
            "flat porter wage.",
            "A pack-in pack-out policy on the {town} ridge that the company enforces on its own groups, "
            "on a peak that has a visible litter problem.",
            "Overnight ridge camps above {town} for travellers who want the sunrise without the "
            "two-in-the-morning trailhead scramble.",
        ],
    },
    # -- Cultural & Heritage ------------------------------------------------
    {
        "category": "Cultural & Heritage",
        "secondary": "Urban & City",
        "towns": ["Cebu City", "Carcar", "Argao", "Boljoon", "Dalaguete"],
        "names": ["{town} Heritage Walks", "Sugbo {town} Walking Tours",
                  "{town} Colonial Trails", "Old {town} Story Walks"],
        "services": [
            "Guided heritage walking tours", "Colonial church visits",
            "Ancestral house interior access", "Local historian talks",
            "Archival photograph sessions", "Heritage food tasting stops",
            "Small-group private tours", "School and university programmes",
        ],
        "opener": [
            "A walking-tour company covering the {town} heritage district, led by guides with formal "
            "history training rather than a memorised script.",
            "A heritage interpretation outfit in {town} running small-group walks through the colonial "
            "core, with negotiated interior access to {n} ancestral houses normally closed to the public.",
            "A {town} walking tour operator focused on the Spanish-era street grid, its stone churches, "
            "and the families who still occupy the surrounding ancestral homes.",
        ],
        "middle": [
            "Routes stop at ancestral houses where the owners themselves come out to talk, an arrangement "
            "built over years rather than booked through an agency.",
            "Guides carry archival photographs of each stop so guests can compare the street as it stands "
            "with how it looked a century ago.",
            "Groups are capped at {n} so the walk can move through narrow interior stairwells and "
            "chapel side-rooms.",
        ],
        "closer": [
            "The company has trained {k} guides through its own history reading programme.",
            "Tours run rain or shine, with the wet-weather route moving indoors through the church complex.",
            "About {pct} percent of guests are returning visitors bringing family.",
        ],
        "uvp": [
            "Negotiated interior access to {town} ancestral houses that are closed to every other tour "
            "operator, because the arrangement is with the families and not an agency.",
            "Guides trained in actual archival research who carry period photographs, so the walk is "
            "history rather than anecdote.",
            "The only {town} heritage walk with a full indoor wet-weather route, so a rainy-season booking "
            "is never a cancelled one.",
        ],
    },
    {
        "category": "Cultural & Heritage",
        "secondary": None,
        "towns": ["Cebu City", "Mandaue", "Talisay", "Liloan", "Consolacion"],
        "names": ["{town} Craft Heritage Studio", "Guild of {town} Artisans",
                  "{town} Weaving House", "Hand and Loom {town}"],
        "services": [
            "Artisan workshop sessions", "Guitar-making demonstrations",
            "Hand-weaving classes", "Shellcraft studio tours",
            "Traditional dance performances", "Craft market sourcing tours",
            "Corporate team workshops", "Souvenir commissioning",
        ],
        "opener": [
            "A craft heritage studio in {town} where visitors sit in on working artisan sessions rather "
            "than watching a staged demonstration.",
            "An artisan guild workshop in {town} running hands-on sessions in weaving, shellcraft, and "
            "instrument-making with {n} resident makers.",
            "A working craft house in {town} that opened its floor to visitors, keeping production running "
            "through the tour rather than pausing for it.",
        ],
        "middle": [
            "Visitors work at a real bench alongside a maker, and whatever they produce goes home with "
            "them regardless of how it turns out.",
            "The studio still fills commercial orders during visiting hours, so guests see the actual pace "
            "and failure rate of the craft.",
            "Sessions run at {n} guests per maker so nobody is watching over three shoulders.",
        ],
        "closer": [
            "The guild has {k} makers on its roster, most trained by the founder's family.",
            "Materials are sourced from suppliers the workshop has used for decades.",
            "Roughly {pct} percent of visitors commission a piece after the session.",
        ],
        "uvp": [
            "A working production floor rather than a demonstration set, so guests see the real pace and "
            "the real rejects, which is the part staged craft tours edit out.",
            "One maker per {n} guests, so the workshop is genuinely hands-on instead of a viewing gallery.",
            "The only {town} craft studio where visitors work a real bench and keep what they make.",
        ],
    },
    # -- Theme Parks / Entertainment ----------------------------------------
    {
        "category": "Theme Parks / Entertainment",
        "secondary": "Cultural & Heritage",
        "towns": ["Cebu City", "Lapu-Lapu", "Mandaue", "Talisay", "Minglanilla"],
        "names": ["{town} Fiesta Cultural Show", "Sinulog {town} Dance Theatre",
                  "{town} Festival Pavilion", "Rhythm of {town}"],
        "services": [
            "Nightly cultural dance shows", "Dinner and performance packages",
            "Festival costume experiences", "Group and tour operator bookings",
            "Backstage workshop sessions", "Live percussion performances",
            "Private event performances", "Photo sessions with performers",
        ],
        "opener": [
            "A cultural performance venue in {town} staging nightly festival dance shows with a resident "
            "company of {n} dancers and live percussion.",
            "A dinner-theatre operation in {town} built around Sinulog choreography, running two shows a "
            "night through the peak season.",
            "A festival performance house in {town} pairing a full costume and drum ensemble with a "
            "regional dinner menu.",
        ],
        "middle": [
            "The company drums live rather than to a backing track, which means the tempo follows the "
            "dancers instead of the other way around.",
            "Guests can join a short costume and basic-step session before the show, and many do.",
            "Performers are drawn from competing Sinulog contingents in the off-season.",
        ],
        "closer": [
            "The resident company has placed in the city festival competition {k} times.",
            "Shows run {n} nights a week year-round, not only during festival season.",
            "About {pct} percent of seats are booked by inbound tour operators.",
        ],
        "uvp": [
            "Live percussion rather than a backing track, so the show breathes with the dancers, and the "
            "difference is obvious the moment you hear it.",
            "A resident company of competition-level Sinulog dancers performing year-round, not a "
            "seasonal tourist troupe assembled in January.",
            "A pre-show costume and step session that turns a passive dinner show into something guests "
            "actually take part in.",
        ],
    },
    {
        "category": "Theme Parks / Entertainment",
        "secondary": "Adventure & Nature",
        "towns": ["Cebu City", "Danao", "Balamban", "Toledo", "Compostela"],
        "names": ["{town} Adventure Park", "Skyline {town} Rides",
                  "{town} Zipline and Ropes Park", "Highland Fun {town}"],
        "services": [
            "Zipline rides", "Sky bike and edge coaster", "Ropes course circuits",
            "Bungee and free-fall jumps", "ATV trail rentals",
            "Group day-pass packages", "On-site photography service",
            "Children's low-ropes area",
        ],
        "opener": [
            "An adventure park above {town} running {n} ride attractions across a ridge site, from "
            "ziplines to a cantilevered edge coaster.",
            "A ropes and zipline park on the {town} highlands, built on a slope with a working view "
            "across the strait.",
            "A multi-attraction adventure park in {town} combining aerial rides with an ATV trail network.",
        ],
        "middle": [
            "All harnesses and cable systems are inspected daily and load-tested on a published schedule.",
            "Day passes bundle every attraction, and a lower-height children's circuit runs alongside the "
            "main course.",
            "The park runs a fixed staff-to-rider ratio at every launch platform rather than a queue marshal.",
        ],
        "closer": [
            "The site has run {k} thousand rider descents since opening without a harness failure.",
            "Ride staff are re-certified annually by an external inspector.",
            "Around {pct} percent of visitors buy the full day pass over single-ride tickets.",
        ],
        "uvp": [
            "A published daily inspection and load-test schedule that guests can actually read, unusual "
            "transparency for a {town} adventure park.",
            "A parallel children's circuit at full safety spec, so families ride together instead of "
            "taking turns waiting below.",
            "One bundled day pass covering every attraction, rather than the per-ride ticketing that makes "
            "these parks quietly expensive.",
        ],
    },
    # -- Urban & City -------------------------------------------------------
    {
        "category": "Urban & City",
        "secondary": "Culinary & Gastronomy",
        "towns": ["IT Park", "Cebu City", "Mandaue", "Lahug", "Banilad"],
        "names": ["{town} Nightlife Collective", "After Hours {town}",
                  "{town} City Crawl Co.", "Neon {town} Tours"],
        "services": [
            "Guided bar and nightlife crawls", "Craft beer tasting routes",
            "Late-night street food walks", "Rooftop bar access packages",
            "Live music venue circuits", "Safe transport coordination",
            "Corporate social event planning", "Small-group private crawls",
        ],
        "opener": [
            "A nightlife tour operator working the {town} strip, running curated crawls across {n} venues "
            "with pre-arranged entry and a reserved table at each.",
            "A city-night guiding outfit in {town} that pairs bar routes with late-night food stops and "
            "coordinated transport home.",
            "A {town}-based social tour company running craft beer and live music circuits for visitors "
            "who would otherwise not know which doors to try.",
        ],
        "middle": [
            "Every crawl ends with arranged transport to the guest's accommodation, which is included "
            "rather than an upsell.",
            "Venues are pre-booked with a held table, so the group never queues or gets turned away at "
            "the door on a busy night.",
            "Guides stay sober on shift and cap group size at {n} to keep the night manageable.",
        ],
        "closer": [
            "The company has running arrangements with {k} venues across the district.",
            "Routes are re-cut every quarter as venues open and close.",
            "About {pct} percent of guests are solo travellers joining a shared crawl.",
        ],
        "uvp": [
            "Included transport home at the end of the night, the single detail that separates a "
            "responsible {town} nightlife tour from a liability.",
            "Pre-booked held tables at every stop, so a group of ten is never turned away at the third "
            "door on a Friday.",
            "Sober guides and a hard group cap, built for solo travellers who want a night out without "
            "the risk of an unmanaged crowd.",
        ],
    },
    {
        "category": "Urban & City",
        "secondary": None,
        "towns": ["Cebu City", "Mandaue", "Lapu-Lapu", "Talisay", "Consolacion"],
        "names": ["{town} City Transfers", "Sugbo {town} Day Tours",
                  "{town} Metro Guides", "Uptown {town} Tour Co."],
        "services": [
            "Airport and port transfers", "Half-day city sightseeing tours",
            "Shopping district circuits", "Multilingual guide provision",
            "Corporate visitor programmes", "Cruise passenger shore tours",
            "Hourly private car hire", "Custom itinerary planning",
        ],
        "opener": [
            "A city tour and transfer company in {town} operating a fleet of {n} vans with guides who "
            "work in English, Korean, and Japanese.",
            "A ground-handling and sightseeing operator serving {town}, focused on cruise call days and "
            "corporate visitor programmes.",
            "A {town} day-tour company running fixed half-day city circuits alongside fully custom "
            "private itineraries.",
        ],
        "middle": [
            "Drivers and guides are separate roles, so the person explaining the city is not the person "
            "watching the traffic.",
            "Vehicles are tracked and the company publishes a fixed transfer price list with no "
            "surge or holiday loading.",
            "Cruise shore tours are timed against the ship's all-aboard with a built-in buffer.",
        ],
        "closer": [
            "The fleet covers around {k} dozen transfers a month in peak season.",
            "Guides hold tourism department accreditation and are re-tested on the city route annually.",
            "About {pct} percent of business comes from repeat corporate accounts.",
        ],
        "uvp": [
            "Separate driver and guide on every tour, so the commentary never competes with {town} "
            "traffic for the same person's attention.",
            "A published flat transfer price list with no holiday surge, in a market where quoted "
            "airport fares move with demand.",
            "Cruise shore tours built backwards from the all-aboard time with a real buffer, not an "
            "optimistic one.",
        ],
    },
    # -- Culinary & Gastronomy ----------------------------------------------
    {
        "category": "Culinary & Gastronomy",
        "secondary": None,
        "towns": ["Talisay", "Carcar", "Cebu City", "Minglanilla", "Naga"],
        "names": ["{town} Lechon House", "Lechon ni {town}",
                  "{town} Roasting Yard", "Original {town} Lechon"],
        "services": [
            "Whole roast lechon orders", "By-the-kilo counter service",
            "Dine-in family sets", "Nationwide chilled shipping",
            "Event and fiesta catering", "Roasting yard viewing",
            "Vacuum-packed pasalubong packs", "Corporate bulk orders",
        ],
        "opener": [
            "A {town} lechon house roasting {n} pigs a day over charcoal, seasoned with the family's "
            "own lemongrass and spice blend.",
            "A third-generation roasting yard in {town} supplying both a dine-in counter and a "
            "chilled nationwide shipping line.",
            "A family lechon operation in {town} that still turns every pig by hand rather than on a "
            "motorised spit.",
        ],
        "middle": [
            "Pigs are sourced from the same {town} backyard growers the family has bought from for "
            "decades, at a fixed weight range.",
            "Roasting is done over coconut charcoal and turned by hand, which is slower but keeps the "
            "skin from blistering unevenly.",
            "The counter sells by the kilo from mid-morning until the day's roast is gone, which is "
            "usually well before closing.",
        ],
        "closer": [
            "The recipe has been unchanged for {k} years.",
            "Fiesta season orders are taken up to two months ahead.",
            "About {pct} percent of weekday sales are pasalubong packs for departing travellers.",
        ],
        "uvp": [
            "Hand-turned over coconut charcoal rather than a motorised spit, slower, and the reason "
            "the skin comes off in unbroken sheets.",
            "A fixed roster of {town} backyard growers supplying every pig, so the flavour does not "
            "move with the wholesale market.",
            "Vacuum-packed pasalubong packs cut for airline carry-on, aimed squarely at travellers "
            "leaving from Mactan that same day.",
        ],
    },
    {
        "category": "Culinary & Gastronomy",
        "secondary": "Urban & City",
        "towns": ["Carbon Market", "Cebu City", "Mandaue", "Pasil", "Taboan"],
        "names": ["{town} Street Food Crawl", "Taste of {town}",
                  "{town} Market Food Tours", "Hungry {town} Walks"],
        "services": [
            "Guided street food walking tours", "Public market sourcing walks",
            "Dried fish and delicacy tastings", "Cooking demonstration sessions",
            "Vendor introduction access", "Dietary-adapted tasting routes",
            "Evening night-market crawls", "Home-kitchen dining experiences",
        ],
        "opener": [
            "A street food walking tour through the {town} stalls, stopping at {n} vendors the guide "
            "has bought from personally for years.",
            "A market food tour operator in {town} combining a sourcing walk with a cooking session "
            "using what the group just bought.",
            "A {town} food crawl built around vendors who do not have signage, English menus, or any "
            "way for a visitor to find them alone.",
        ],
        "middle": [
            "Vendors are paid a standing arrangement rather than a commission, so the route reflects "
            "what is actually good on the day.",
            "Guides adapt the route on the spot for dietary restrictions without dropping guests to a "
            "single safe stall.",
            "Groups are capped at {n} so the walk can fit down the market's interior aisles.",
        ],
        "closer": [
            "The guide has been buying from these {k} stalls since before the tour existed.",
            "Tours run early morning and again in the evening, when the market changes character entirely.",
            "Around {pct} percent of guests say a stall on the route was their trip highlight.",
        ],
        "uvp": [
            "Vendors on a standing payment rather than commission, so the route is picked on what is "
            "good that morning instead of who pays the guide most.",
            "Access to unsigned {town} stalls with no English menu, the ones a visitor genuinely "
            "cannot find or order from alone.",
            "Dietary routes that stay a real food tour instead of collapsing to one safe stall.",
        ],
    },
    {
        "category": "Culinary & Gastronomy",
        "secondary": "Coastal & Island",
        "towns": ["Mactan", "Cordova", "Liloan", "Danao", "Bantayan"],
        "names": ["{town} Seafood Grill", "Dampa {town} Kitchen",
                  "{town} Pier Seafood House", "Catch of {town}"],
        "services": [
            "Fresh catch dine-in service", "Pick-and-cook seafood counter",
            "Beachfront dining decks", "Group and family set menus",
            "Live crustacean tanks", "Sunset dinner seatings",
            "Function and event catering", "Boat-to-table sourcing tours",
        ],
        "opener": [
            "A pick-and-cook seafood house on the {town} waterfront, buying its entire day's stock off "
            "the boats at the adjacent pier each morning.",
            "A beachfront seafood grill in {town} with an open counter where guests choose their catch "
            "by weight before it goes on the fire.",
            "A family seafood restaurant on the {town} shoreline running {n} covered dining decks over "
            "the water.",
        ],
        "middle": [
            "Everything on the counter came off a boat that morning; the kitchen does not carry frozen "
            "stock and closes the counter when the day's buy runs out.",
            "Guests choose the cooking method per item, and the kitchen prices by weight at the counter "
            "in front of them.",
            "Sunset seatings are booked in two sittings so the deck tables are not turned mid-meal.",
        ],
        "closer": [
            "The family has bought from the same {k} boat crews for years.",
            "The counter closes when the morning's buy is gone rather than restocking frozen.",
            "About {pct} percent of covers are walk-ins from the neighbouring resorts.",
        ],
        "uvp": [
            "No frozen stock at all, so the counter simply closes when the morning's buy is gone, which "
            "is the opposite of how {town} tourist seafood usually works.",
            "Transparent weigh-and-price at the counter in front of the guest, in a district where "
            "seafood billing surprises are the standing complaint.",
            "Direct daily buying from named {town} boat crews rather than a wholesale consolidator.",
        ],
    },
    # -- Accommodation & Staycation -----------------------------------------
    {
        "category": "Accommodation & Staycation",
        "secondary": "Coastal & Island",
        "towns": ["Mactan", "Cordova", "Moalboal", "Bantayan", "Malapascua"],
        "names": ["{town} Sunset Beachfront Resort", "Casa {town} Beach Villas",
                  "{town} Shoreline Suites", "Blue Sands {town}"],
        "services": [
            "Beachfront room accommodation", "Private villa rentals",
            "Airport transfer service", "In-house dive centre coordination",
            "Beachside restaurant and bar", "Event and wedding hosting",
            "Day-use pool passes", "Island tour desk booking",
        ],
        "opener": [
            "A {n}-room beachfront resort on the {town} shoreline with direct beach access and an "
            "in-house tour desk.",
            "A small beach resort in {town} built around low-rise villas rather than a tower block, "
            "with a restaurant deck on the sand.",
            "A family-owned shoreline property in {town} offering rooms and private villas with an "
            "on-site dive coordination desk.",
        ],
        "middle": [
            "Rooms open directly onto the sand rather than onto an interior corridor, and the property "
            "keeps its beach frontage unfenced.",
            "The tour desk books island trips at operator prices without a markup, treating it as a "
            "guest service rather than a revenue line.",
            "Day-use passes are sold to non-staying guests only outside peak occupancy.",
        ],
        "closer": [
            "The property has been under the same family for {k} years.",
            "Staff are hired almost entirely from the surrounding {town} barangay.",
            "About {pct} percent of bookings are direct rather than through an online travel agency.",
        ],
        "uvp": [
            "Island tours booked at operator price with no desk markup, a deliberate choice to treat "
            "the tour desk as service rather than margin.",
            "Low-rise villas opening straight onto unfenced sand, on a {town} coast increasingly walled "
            "off by tower resorts.",
            "A staff hired almost entirely from the surrounding barangay, which is why the local "
            "knowledge at the front desk is real.",
        ],
    },
    {
        "category": "Accommodation & Staycation",
        "secondary": "Urban & City",
        "towns": ["IT Park", "Cebu City", "Mandaue", "Lahug", "Banilad"],
        "names": ["{town} Serviced Residences", "Urban Stay {town}",
                  "{town} Loft Apartments", "The {town} Residency"],
        "services": [
            "Nightly and monthly serviced stays", "Fully fitted kitchenettes",
            "High-speed fibre workspaces", "Weekly housekeeping service",
            "Airport transfer arrangement", "Rooftop lounge and gym access",
            "Long-stay corporate contracts", "Pet-friendly unit options",
        ],
        "opener": [
            "A serviced apartment building in {town} with {n} dozen units aimed at long-stay remote workers "
            "and relocating corporate tenants.",
            "An urban staycation property in {town} offering nightly through monthly terms with fitted "
            "kitchens and dedicated desks.",
            "A loft-style serviced residence in the {town} district built for guests who need to "
            "actually work from the room.",
        ],
        "middle": [
            "Every unit has a wired fibre connection and a real desk, and the building publishes its "
            "measured speeds rather than advertising a plan tier.",
            "Monthly terms include weekly housekeeping and utilities, with no lock-in beyond the month.",
            "The rooftop lounge stays open around the clock for guests working across time zones.",
        ],
        "closer": [
            "Around {pct} percent of guests stay longer than a month.",
            "The building has held corporate accounts with {k} companies in the district.",
            "Occupancy runs steady year-round rather than following the leisure season.",
        ],
        "uvp": [
            "Published measured connection speeds instead of an advertised plan tier, the one thing "
            "remote workers actually need verified before booking.",
            "Month-to-month serviced terms with no lock-in, in a {town} market that pushes annual leases.",
            "A real desk and wired fibre in every unit, built for working stays rather than a leisure "
            "room with a chair pulled up to a dresser.",
        ],
    },
]


def _slugify(text: str) -> str:
    keep = [c.lower() if c.isalnum() else "-" for c in text]
    slug = "".join(keep)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")


def build_corpus(count: int) -> list[dict]:
    """Build *count* deterministic synthetic business records."""
    businesses: list[dict] = []
    used_names: set[str] = set()
    used_emails: set[str] = set()

    for i in range(count):
        arch = ARCHETYPES[i % len(ARCHETYPES)]
        r = random.Random(SEED + i * 7919)

        town = arch["towns"][(i // len(ARCHETYPES)) % len(arch["towns"])]
        n = r.randint(4, 14)
        k = r.randint(6, 40)
        pct = r.choice([35, 40, 45, 55, 60, 65, 70, 75, 80])
        fmt = {"town": town, "n": n, "k": k, "pct": pct}

        name = arch["names"][r.randrange(len(arch["names"]))].format(**fmt)
        base_name = name
        suffix = 2
        while name in used_names:
            name = f"{base_name} {suffix}"
            suffix += 1
        used_names.add(name)

        description = " ".join([
            r.choice(arch["opener"]).format(**fmt),
            r.choice(arch["middle"]).format(**fmt),
            r.choice(arch["closer"]).format(**fmt),
        ])
        uvp = r.choice(arch["uvp"]).format(**fmt)

        services = r.sample(arch["services"], r.randint(3, 5))

        primary = arch["category"]
        categories = [primary]
        if arch["secondary"] and r.random() < 0.55:
            categories.append(arch["secondary"])

        first = r.choice(FIRST_NAMES)
        last = r.choice(LAST_NAMES)
        email_base = f"{_slugify(first)}.{_slugify(last)}"
        email = f"{email_base}{i + 1:03d}@ceview.mock"
        while email in used_emails:
            email = f"{email_base}{i + 1:03d}x@ceview.mock"
        used_emails.add(email)

        # Category confidence distribution: primary dominant, secondary present,
        # remainder spread thin.  Stored as percentages summing to 100.
        scores = {c: round(r.uniform(1.0, 6.0), 1) for c in CATEGORIES}
        scores[primary] = round(r.uniform(38.0, 62.0), 1)
        if len(categories) > 1:
            scores[categories[1]] = round(r.uniform(18.0, 30.0), 1)
        total = sum(scores.values())
        scores = {c: round(v / total * 100.0, 2) for c, v in scores.items()}

        businesses.append({
            "index": i,
            "archetype": ARCHETYPES.index(arch),
            "business_name": name,
            "description": description,
            "uvp": uvp,
            "core_services": services,
            "categories": categories,
            "category_scores": scores,
            "confidence_score": round(max(scores.values()) / 100.0, 4),
            "town": town,
            "first_name": first,
            "last_name": last,
            "email": email,
            "contact_number": f"+639{r.randint(100000000, 999999999)}",
            "target_market": MARKETS[i % len(MARKETS)],
            "trend": r.choice(["up", "flat", "down"]),
            "image_url": f"https://picsum.photos/seed/{_slugify(name)}/800/600",
        })

    return businesses


if __name__ == "__main__":
    corpus = build_corpus(120)
    names = {b["business_name"] for b in corpus}
    emails = {b["email"] for b in corpus}
    print(f"{len(corpus)} businesses | {len(names)} unique names | {len(emails)} unique emails")
    print(f"archetypes covered: {len({b['archetype'] for b in corpus})}/{len(ARCHETYPES)}")
    for b in corpus[:2]:
        print("\n---", b["business_name"], "|", ", ".join(b["categories"]))
        print("  ", b["description"][:200], "...")
