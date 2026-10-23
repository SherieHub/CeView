/**
 * Public landing page — the single source of every piece of copy, list,
 * sample number and configurable link. Sections import from here; nothing
 * product-facing is written inline in JSX.
 *
 * CLAIMS
 * FACTS (bottom of this file) is the only allowed source of product claims.
 * Every other block must stay consistent with it:
 *   - CeView forecasts online search interest, not bookings, arrivals or revenue
 *   - any dashboard, chart, score or alert shown is labelled "Sample data"
 *   - no customer logos, testimonials, ratings or user counts
 *   - pilot goals are targets; prices are proposed
 *
 * CONFIG (SITE)
 * Unconfirmed links come from env vars (see .env.example). A blank value hides
 * the element or falls back to something truthful — never a visible
 * placeholder, a dead link, or a fake "request sent" message.
 */

const env = import.meta.env;
const read = (value: string | undefined) => (value ?? '').trim();

export const SITE = {
  walkthroughUrl: read(env.VITE_WALKTHROUGH_URL),
  leadFormEndpoint: read(env.VITE_LEAD_FORM_ENDPOINT),
  contactEmail: read(env.VITE_CONTACT_EMAIL),
} as const;

export const DEMO_ANCHOR = '#demo';
export const TOUR_ANCHOR = '#product';

/**
 * The secondary CTA. With a walkthrough video configured it opens it; without
 * one it becomes an in-page product tour rather than a button that goes
 * nowhere — and is labelled for what it actually does.
 */
export function walkthroughCta(): { label: string; href: string; external: boolean } {
  return SITE.walkthroughUrl
    ? { label: 'Watch Product Walkthrough', href: SITE.walkthroughUrl, external: true }
    : { label: 'Take the Product Tour', href: TOUR_ANCHOR, external: false };
}

/** Header navigation, in page order. */
export const NAV_LINKS = [
  { label: 'Why CeView', href: '#why' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Who It’s For', href: '#who' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const HEADER = {
  signIn: { label: 'Sign In', to: '/login' },
  cta: 'Request a Demo',
  menuOpen: 'Open menu',
  menuClose: 'Close menu',
  homeLabel: 'CeView — back to top',
} as const;

export const HERO = {
  eyebrow: 'Tourism demand intelligence for Cebu businesses',
  /**
   * "See traveler demand before the opportunity passes." Set as fixed lines
   * so the headline's height doesn't change when the display font loads.
   * `accent` (coral italic) comes before `text` on its line.
   */
  titleLines: [
    { text: 'See traveler demand' },
    { accent: 'before', text: ' the opportunity' },
    { text: 'passes.' },
  ],
  lede:
    'CeView forecasts traveler search interest up to 12 weeks ahead across the Philippines, South Korea, Japan, and the United States, helping you target the right markets, create relevant content, and improve future campaigns.',
  primaryCta: 'Request a Demo',
  secondaryCta: 'Take the Product Tour',
  trust: [
    'Built for Cebu tourism MSMEs',
    'Local, domestic & 3 international markets',
    'Plain-language guidance, no analysts needed',
  ],
  /**
   * Illustrative dashboard card, drawn in HTML from the real dashboard's
   * layout. Sample business and numbers only — the card carries a "Sample
   * data" badge. Values that also appear in the real screenshot match it:
   * South Korea +24% above baseline, 2 active surges, South Korea 87 and
   * Japan 79 for Accommodation & Staycation. Everything is search interest.
   */
  dashboard: {
    label:
      'Illustrative CeView dashboard with sample data: search interest from South Korea is forecast 24% above its recent baseline, and South Korea ranks first for Accommodation & Staycation.',
    nav: ['Dashboard', 'Market Radar', 'Trend Explorer', 'Content Studio', 'Calendar', 'Performance', 'Settings'],
    greeting: 'Good morning, Sunset Cove Beach Resort',
    sub: 'Here’s what’s happening with traveler search interest.',
    location: 'Cebu, Philippines',
    range: 'Next 12 weeks',
    stats: [
      { tone: 'teal', value: '+24%', label: 'Search interest', note: 'South Korea vs. baseline' },
      { tone: 'teal', value: '2', label: 'Active surge alerts', note: 'Across your themes' },
      { tone: 'coral', value: '3', label: 'Markets rising', note: 'South Korea, Japan, Domestic' },
    ],
    chart: {
      title: 'Search interest forecast',
      series: 'South Korea · Accommodation & Staycation',
      legendForecast: 'Forecast',
      legendBaseline: 'Recent baseline',
      /** Weekly index, 0–100: this week, then 12 weeks ahead. */
      forecast: [44, 46, 45, 50, 55, 61, 58, 66, 72, 70, 67, 64, 62],
      baseline: [52, 53, 54, 55, 56, 57, 57, 58, 58, 58, 59, 59, 59],
      /** Index of the labelled point: 72 vs 58 → +24%. */
      peak: 8,
      peakLabel: '+24%',
      xLabels: ['Now', '+3w', '+6w', '+9w', '+12w'],
    },
    markets: {
      title: 'Market potential',
      theme: 'Accommodation & Staycation',
      rows: [
        { key: 'KR', name: 'South Korea', score: 87 },
        { key: 'JP', name: 'Japan', score: 79 },
        { key: 'domestic', name: 'Domestic', score: 74 },
        { key: 'US', name: 'United States', score: 68 },
        { key: 'local', name: 'Local', score: 61 },
      ],
    },
  },
} as const;

/**
 * Market coverage strip — stands in for a customer-logo row, with facts.
 * `title` is the visible name; `label` the market type underneath.
 */
export const MARKET_STRIP = {
  eyebrow: 'Tracking traveler search interest from',
  items: [
    { key: 'local', title: 'Cebu & nearby provinces', label: 'Local' },
    { key: 'domestic', title: 'Other Philippine regions', label: 'Domestic' },
    { key: 'KR', title: 'South Korea', label: 'International' },
    { key: 'JP', title: 'Japan', label: 'International' },
    { key: 'US', title: 'United States', label: 'International' },
  ],
  facts: ['Updated weekly', '12-week look-ahead', '7 tourism themes'],
  /** Figure as supplied in the landing brief; source is `noteSource`. */
  note: 'Why these three? They bring about 60% of Central Visayas’ foreign arrivals.',
  noteSource: 'DEPDev Regional Office VII, Central Visayas Regional Development Report 2024',
} as const;

export const CHALLENGE = {
  eyebrow: 'The challenge',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'Tourism demand keeps shifting. Small businesses are usually ',
  titleAccent: 'last',
  titleTail: ' to know.',
  intro:
    'Interest from a market can rise or fade long before it shows up as a booking. Most small tourism businesses don’t have the time or analysts to track it.',
  statsEyebrow: 'What’s at stake',
  /** Figures exactly as published; see `sources`. */
  stats: [
    { value: '₱2.27T', label: 'Tourism’s direct contribution to the economy in 2025, 8.1% of GDP' },
    { value: '7.70M', label: 'Jobs supported by tourism, 15.7% of total employment' },
    { value: '−6.4%', label: 'Change in inbound tourism spending in 2025', negative: true },
    { value: '7.5M', label: 'Central Visayas arrivals in 2024: 5.0M domestic, 2.5M foreign' },
  ],
  sources:
    'Sources: Philippine Statistics Authority (May 2026); DEPDev Regional Office VII, Central Visayas Regional Development Report 2024.',
  problems: [
    {
      tone: 'coral',
      title: 'Market information arrives late',
      body: 'Search interest, exchange rates and flight access shift on their own. Free tools show past searches, but you still have to choose, translate and interpret the terms.',
    },
    {
      tone: 'teal',
      title: 'Hard to turn it into action',
      body: 'Even with the right market in mind, you still need content that fits it, and a way to see whether the campaign worked, on top of daily operations.',
    },
  ],
  closing: 'Slow seasons shouldn’t be a waiting game.',
} as const;

/** Value pillars (#why): what changes for the business, one card each. */
export const WHY = {
  eyebrow: 'Turn traveler interest into smarter decisions',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'Spend less time guessing and more time ',
  titleAccent: 'growing',
  titleTail: '.',
  intro:
    'CeView brings the signal, the market and the marketing decision into one connected workflow, so a slow season becomes something you plan for instead of wait out.',
  pillars: [
    {
      tone: 'teal',
      title: 'See opportunities earlier',
      body: 'Get an alert when forecast search interest for your tourism themes rises above its usual level, weeks before it turns into inquiries.',
      outcome: 'More time to prepare',
    },
    {
      tone: 'coral',
      title: 'Know where to focus',
      body: 'Markets ranked for your business using the forecast plus seasonality, exchange rates, economic conditions and flight access.',
      outcome: 'A clearer target',
    },
    {
      tone: 'teal',
      title: 'Move from insight to content',
      body: 'Caption and visual directions drafted for the market you chose and its cultural context, then checked before you use them.',
      outcome: 'Less time drafting',
    },
    {
      tone: 'coral',
      title: 'Make the next decision better',
      body: 'Meta and TikTok results turned into one effectiveness score and a plain-language report with next steps.',
      outcome: 'Every campaign informs the next',
    },
  ],
} as const;

/**
 * Product section (#product), part A: the split with the Market Explorer
 * card and the photo collage. Every Market Explorer number is sample data
 * (the card carries the "Sample data" badge); the flight detail matches the
 * sample on the real dashboard screenshot.
 */
export const PRODUCT = {
  eyebrow: 'AI-assisted insights built for Cebu tourism',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'From traveler interest to a clearer marketing ',
  titleAccent: 'decision',
  titleTail: '.',
  body: 'See which market is warming up for your kind of experience, why it ranks where it does, and what to prepare, all in one place.',
  cta: 'Explore all features',
  ctaHref: '#features',
  explorer: {
    title: 'Market Explorer',
    subtitle: 'Accommodation & Staycation · ranked for a sample beach resort',
    rows: [
      { key: 'KR', name: 'South Korea', status: 'Surge active', tone: 'coral', score: 87 },
      { key: 'JP', name: 'Japan', status: 'Rising', tone: 'teal', score: 79 },
      { key: 'domestic', name: 'Other PH regions', note: 'Domestic', status: 'Steady', tone: 'neutral', score: 72 },
      { key: 'US', name: 'United States', status: 'Steady', tone: 'neutral', score: 64 },
      { key: 'local', name: 'Cebu & nearby', note: 'Local', status: 'Steady', tone: 'neutral', score: 61 },
    ],
    flight: 'South Korea · direct flights 14×/week · 3h 45m to Cebu',
    factors: ['Forecast', 'Seasonality', 'Exchange rate', 'Economy', 'Flight access'],
  },
  /** Handwritten note beside the collage, one line per entry. */
  note: ['Spot it early.', 'Plan it well.', 'Grow Cebu together.'],
} as const;

export type TourId = 'radar' | 'studio' | 'review' | 'performance';

/**
 * Product section part B: the real screens. A dark stage shows the selected
 * screenshot in a browser frame; four cards below act as the tabs. `status`
 * is the pill over each screen and describes what that screenshot shows.
 */
export const SCREENS = {
  eyebrow: 'See CeView in action',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'Four tools, one ',
  titleAccent: 'workflow',
  titleTail: '.',
  intro: 'Demand signals, market priorities, content guidance and performance context, inside one workflow.',
  realBadge: 'Real CeView screen · sample data',
  shownLabel: 'Showing now',
  caption: 'Real CeView screens, shown with a sample business and sample data.',
  ctaLead: 'Want to see the complete workflow?',
  ctaLink: 'Request a demo',
  tabs: [
    {
      id: 'radar',
      label: 'Demand Intelligence',
      tone: 'teal',
      body: 'See when interest may be rising, and which market deserves attention.',
      status: 'Surge alert · South Korea · +24% vs baseline',
      alt: 'CeView dashboard showing a surge alert for South Korea and the markets ranked by potential for that alert’s category.',
    },
    {
      id: 'studio',
      label: 'Content Studio',
      tone: 'coral',
      body: 'Turn the opportunity into posts written for the market you’re targeting.',
      status: 'Three caption options · written for South Korea',
      alt: 'CeView Content Studio showing three caption options for Instagram written for travelers from South Korea.',
    },
    {
      id: 'review',
      label: 'Content Review',
      tone: 'teal',
      body: 'Check a caption and image against your campaign direction first.',
      status: 'Review score 84 · passes the mark of 70',
      alt: 'CeView content review showing an overall score of 84, a pass result, sub-scores and a written explanation.',
    },
    {
      id: 'performance',
      label: 'Performance',
      tone: 'coral',
      body: 'Bring results back into the workflow, so the next decision has context.',
      status: 'Effectiveness score 0.63 · good performance',
      alt: 'CeView performance screen showing an overall performance score and the ad metrics that drove it.',
    },
  ] as const,
};

/** How it works (#how-it-works): the one place the workflow is explained. */
export const HOW = {
  eyebrow: 'How CeView works',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'One connected path from your business to your next ',
  titleAccent: 'campaign',
  titleTail: '.',
  intro:
    'Five phases in one workspace. Each step builds on the last, so you never re-explain your business to a new tool.',
  phases: [
    {
      title: 'Understand',
      does: 'Reads your own description of what you offer, assigns up to three of seven tourism themes, and measures how distinct you are locally.',
      youGet: 'A clear profile',
    },
    {
      title: 'Predict & prioritize',
      does: 'Forecasts 12 weeks of search interest for your themes in each market, ranks the markets, and alerts you when interest climbs.',
      youGet: 'Where and when to focus',
    },
    {
      title: 'Create',
      does: 'Drafts social captions and visual direction from your profile, the forecast and the market’s cultural context.',
      youGet: 'Content for that market',
    },
    {
      title: 'Check & improve',
      does: 'A second AI scores each draft against a fixed rubric and explains what to improve. You approve the final version.',
      youGet: 'Strategy-aligned content',
    },
    {
      title: 'Learn & optimize',
      does: 'Turns Meta and TikTok results, or numbers you enter, into one effectiveness score and a plain-language report.',
      youGet: 'A better next plan',
    },
  ],
  youGetLabel: 'You get',
  /** Marks phase 04: nothing is published without your approval. */
  approve: 'You approve here',
  approveLabel: 'You approve each draft here. CeView never posts on your behalf.',
  /** The loop from phase 05 back to phase 02. */
  loop: 'each campaign sharpens the next forecast',
  /** Handwritten note over the photo. */
  note: ['Spot it early.', 'Plan it well.', 'Grow Cebu together.'],
  resultLead: 'The result:',
  result: 'fewer disconnected decisions, and a clear path from “there may be an opportunity” to “here’s what we’ll do about it.”',
  primaryCta: 'Request a Demo',
  secondaryCta: 'Product Tour',
  finePrint:
    'Forecasts describe online search interest, an early indicator of traveler attention, not bookings or arrivals.',
} as const;

/**
 * Features bento (#features). Eight capabilities, each with a live mini-visual
 * labelled sample or illustrative. Claims follow FACTS: search interest, not
 * bookings; nothing is posted automatically.
 */
export const FEATURES = {
  eyebrow: 'Features',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'The tools behind a better-timed tourism ',
  titleAccent: 'campaign',
  titleTail: '.',
  intro:
    'Each tool works on its own, but they’re built to hand off to each other, from your profile to the forecast to the content to the results.',
  forecasts: {
    title: 'Demand forecasts',
    body: 'A trained forecasting model reads the last 52 weeks of weekly search interest and projects the next 12, for every market and every tourism theme you match.',
    note: 'Search interest is an early signal of traveler attention, not a booking forecast.',
    tag: 'Illustrative · 52 weeks in, 12 weeks out',
    now: 'Now',
    window: 'Window opens',
    chartTitle: 'Illustrative forecast of search interest',
    chartDesc:
      'A line shows 52 weeks of past search interest up to now, then a dashed 12-week forecast inside a widening confidence band. A shaded window marks where the forecast rises above its usual level, with its peak highlighted.',
  },
  ranking: {
    title: 'Market ranking',
    kicker: 'Sample · Accommodation & Staycation',
    rows: [
      { name: 'South Korea', score: 87 },
      { name: 'Japan', score: 79 },
      { name: 'Other PH regions', score: 72 },
    ],
    body: 'Know which market shows the strongest potential for your type of business right now, weighed by forecast, seasonality, exchange rates, economic conditions and flight access.',
  },
  surge: {
    title: 'Surge alerts',
    chip: 'Surge',
    alertTitle: 'Demand window opening: South Korea',
    alertNote: 'Forecast 24% above the recent baseline · prepare within 4 weeks',
    kicker: 'Sample alert',
    body: 'Get a clear signal when forecast interest rises above its usual level, early enough to prepare.',
  },
  profile: {
    title: 'Business-aware guidance',
    kicker: 'Sample',
    /** Highlighted themes and their confidence scores (sample). */
    matched: [
      { theme: 'Accommodation & Staycation', confidence: '0.94' },
      { theme: 'Coastal & Island', confidence: '0.81' },
      { theme: 'Culinary & Gastronomy', confidence: '0.62' },
    ],
    uniqueness: { label: 'Uniqueness', value: 82, max: 100 },
    body: 'Describe your business in your own words. CeView assigns up to three of seven tourism themes with a confidence score, and compares you with similar local businesses to show what makes your offer distinct. Every recommendation starts from that profile.',
  },
  direction: {
    title: 'Content direction',
    options: ['Witty & trend-conscious', 'Formal & value-driven', 'Storytelling & immersive'],
    kicker: 'Sample',
    body: 'Caption directions, hashtags and visual guidance drafted for the market you’re targeting, shaped by its cultural context.',
  },
  review: {
    title: 'Content review',
    score: 84,
    pass: 'Pass · mark 70',
    bars: [
      { label: 'Fits your business', score: 88 },
      { label: 'Fits the target audience', score: 86 },
      { label: 'Fits the platform', score: 84 },
    ],
    kicker: 'Sample review',
    body: 'A second AI checks each draft against a fixed rubric and explains, in plain language, where it follows or drifts from the campaign direction. You decide what to use.',
  },
  performance: {
    title: 'Performance guidance',
    metrics: ['Return on ad spend', 'Conversion rate', 'Cost per customer', 'Click-through rate', 'Cost per click'],
    score: 'Effectiveness score',
    report: 'Weekly report with next steps',
    sources: ['Meta', 'TikTok'],
    manual: 'or enter results manually',
    body: 'Bring campaign results from Meta and TikTok, or type them in, and get one effectiveness score plus a plain-language report on what to try next. An automated quality check rewrites any report that falls short.',
  },
  keywords: {
    title: 'Local-language keyword sets',
    kicker: 'Sample keywords',
    /** Standard dictionary terms for "beach resort"; have a native speaker confirm before launch. */
    rows: [
      { lang: 'EN', term: 'beach resort', langName: 'English', htmlLang: 'en' },
      { lang: 'KO', term: '해변 리조트', langName: 'Korean', htmlLang: 'ko' },
      { lang: 'JA', term: 'ビーチリゾート', langName: 'Japanese', htmlLang: 'ja' },
    ],
    body: 'CeView prepares the search terms travelers actually use in each market’s language, so you don’t have to guess, translate or interpret them yourself.',
  },
} as const;

/**
 * Who it's for (#who). Eight kinds of tourism business, each with a real,
 * credited stock photo and the tourism themes it usually maps to (spelled as
 * in FACTS.themes). The photos are illustrative, not customers; the footnote
 * says so. Partner Plan pricing is proposed, like all pricing.
 */
export const WHO = {
  eyebrow: 'Built for Cebu tourism businesses',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'Useful market intelligence shouldn’t need a full ',
  titleAccent: 'analytics team',
  titleTail: '.',
  intro:
    'CeView is for tourism MSME owners, managers and marketing staff who depend on visitors but don’t have analysts or a revenue-management team.',
  explainer: {
    text: 'CeView doesn’t forecast by business type. It matches you to the tourism themes travelers search for. A dive shop and a beachfront resort can share the same Coastal & Island forecast.',
    from: ['Dive shop', 'Beachfront resort'],
    to: 'Coastal & Island',
  },
  cards: [
    {
      key: 'resort',
      title: 'Resorts, hotels & homestays',
      body: 'Plan destination promotions around the weeks interest from a target market starts to rise.',
      themes: ['Accommodation & Staycation', 'Coastal & Island'],
    },
    {
      key: 'dive',
      title: 'Dive shops & marine tours',
      body: 'Spot growing interest in coastal and island travel and reach divers before they finalize plans.',
      themes: ['Coastal & Island'],
    },
    {
      key: 'adventure',
      title: 'Tour & adventure operators',
      body: 'Time outdoor and eco-tour campaigns for when travelers start looking.',
      themes: ['Adventure & Nature'],
    },
    {
      key: 'heritage',
      title: 'Heritage, culture & events',
      body: 'See which market is warming to heritage travel and shape tours and events for it.',
      themes: ['Cultural & Heritage'],
    },
    {
      key: 'attraction',
      title: 'Attractions & recreation',
      body: 'Shift your promotional focus when family and entertainment travel starts to pick up.',
      themes: ['Theme Parks & Entertainment'],
    },
    {
      key: 'food',
      title: 'Restaurants & food businesses',
      body: 'Line up seasonal highlights for visitors who travel for food.',
      themes: ['Culinary & Gastronomy'],
    },
    {
      key: 'transport',
      title: 'Travel agencies & tourist transport',
      body: 'Package and promote the routes and trips that each market is searching for.',
      themes: ['Urban & City', 'Coastal & Island'],
    },
    {
      key: 'souvenir',
      title: 'Souvenir & local-product shops',
      body: 'Put Cebu-made products in front of visitors when their interest peaks.',
      themes: ['Cultural & Heritage', 'Culinary & Gastronomy'],
    },
  ],
  partner: {
    eyebrow: 'For LGU tourism offices & tourism associations',
    title: 'Help many small operators at once.',
    body: 'The proposed Partner Plan gives every member business the Growth plan at about 35% below the regular price, with group onboarding and training and one consolidated invoice.',
    cta: 'See the Partner Plan',
    ctaHref: '#pricing',
  },
  footnote: 'Illustrative photos of Cebu and Philippine tourism. These are not CeView customers.',
} as const;

/**
 * Why CeView (#compare): what each common option usually gives a tourism
 * MSME, and what CeView adds. Claims follow FACTS.
 */
export const COMPARE = {
  eyebrow: 'From fragmented to connected',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'Your market research shouldn’t end where your marketing ',
  titleAccent: 'starts',
  titleTail: '.',
  headers: { option: 'Option', usually: 'What it usually gives you', adds: 'What CeView adds' },
  usuallyLabel: 'Usually:',
  addsLabel: 'CeView adds:',
  rows: [
    {
      icon: 'calendar',
      option: 'Social media tools',
      usually: 'Scheduling, captions and basic analytics',
      adds: 'Demand-based market targeting before you create content, and a side-by-side view of how each platform performs',
    },
    {
      icon: 'briefcase',
      option: 'Marketing agencies',
      usually: 'Campaign planning and execution, at agency prices',
      adds: 'An affordable self-service option for MSMEs, or a faster workflow for your own marketing staff',
    },
    {
      icon: 'globe',
      option: 'Tourism intelligence platforms',
      usually: 'Broad destination or visitor insights',
      adds: 'Signals turned into actions specific to your business',
    },
    {
      icon: 'search',
      option: 'Google Trends and free tools',
      usually: 'Past search interest; you choose, translate and interpret the terms',
      adds: 'Keyword sets in each market’s language, 12-week forecasts and markets ranked for you',
    },
    {
      icon: 'user',
      option: 'Deciding from experience',
      usually: 'The owner’s judgment, based on last season',
      adds: 'Data, AI guidance and campaign feedback in one workflow, with your judgment still in charge',
    },
  ],
  statementLead: 'CeView’s advantage isn’t another forecast or another AI writer.',
  statementHighlight: 'It connects market intelligence with the marketing decisions that follow.',
  workflowLabel: 'The connected workflow',
  workflow: ['Spot the signal', 'Pick the market', 'Draft the content', 'Check it', 'Learn from results'],
} as const;

/**
 * Trust & transparency (#trust): only things the product actually does, plus
 * the Cebu pilot's targets, labelled as targets (not results).
 */
export const TRUST = {
  eyebrow: 'Built for informed decisions',
  title: 'Useful guidance, with your business still in control.',
  intro: 'We’re clear about what CeView knows, what it estimates and what stays your call.',
  items: [
    {
      icon: 'hand',
      title: 'You approve everything',
      body: 'CeView supports your decisions; it doesn’t make them. Every draft waits for your approval, and nothing is posted to your accounts on your behalf.',
    },
    {
      icon: 'gauge',
      title: 'Search interest, not bookings',
      body: 'Forecasts show how strongly travelers are searching for experiences like yours. They don’t guarantee bookings, arrivals or revenue. Results still depend on your offer, pricing and execution.',
    },
    {
      icon: 'badge',
      title: 'Every forecast shows its status',
      body: 'Each forecast lists its data source and whether the model behind it is provisional or validated, so you know how much weight to give it.',
      statuses: ['Provisional', 'Validated'],
    },
    {
      icon: 'database',
      title: 'Public data, explained',
      body: 'Search interest comes from Google Trends, and economic indicators come from public sources. CeView’s value is in what it does with them: forecasting, ranking and connecting them to your marketing.',
    },
    {
      icon: 'lock',
      title: 'Your account stays yours',
      body: 'Your business profile, content and results stay in your own account. Other businesses using CeView can’t see them.',
    },
    {
      icon: 'message',
      title: 'Reasons, not just scores',
      body: 'Recommendations come with a plain-language reason you can check, not an unexplained number.',
    },
  ],
  pilot: {
    eyebrow: 'What we’re measuring in the Cebu pilot',
    pill: 'Targets, not results yet',
    targets: [
      { value: '≤ 15%', label: 'Target forecast error (MAPE) on a held-out test period, measured against simple baselines' },
      { value: '70+', label: 'Target usability score (SUS, out of 100) with at least 15 Cebu operators' },
      { value: '40%', label: 'Target reduction in marketing prep time vs. your current manual workflow' },
      { value: '50', label: 'Cebu tourism MSMEs we plan to onboard during the pilot' },
    ],
    caption: 'Forecasting results stay provisional until the reserved test-period evaluation is complete.',
  },
} as const;


/**
 * Pricing (#pricing). Every price is PROPOSED: it will be tested with pilot
 * businesses before launch. Annual = 10× monthly (2 months free). The Partner
 * Plan is Growth at about 35% off (₱649 vs ₱999).
 */
export const PRICING = {
  eyebrow: 'Plans',
  /** Rendered as: {titleLead}<Accent>{titleAccent}</Accent>{titleTail} */
  titleLead: 'Start free. Upgrade when the forecasts start ',
  titleAccent: 'paying off',
  titleTail: '.',
  intro: 'Proposed plans for launch. Prices will be tested with pilot businesses in Cebu before they’re final.',
  billingLabel: 'Billing period',
  billing: { monthly: 'Monthly', annual: 'Annually · 2 months free' },
  bestForLabel: 'Best for:',
  recommended: 'Recommended',
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      monthly: { price: '₱0', period: '/month' },
      annual: { price: '₱0', period: '/year' },
      bestFor: 'Businesses exploring CeView',
      includes: [
        'One business profile',
        'Monthly market snapshot',
        'Preview of which markets are gaining interest',
        '5 AI content drafts a month',
        'Self-service access',
      ],
      cta: 'Start with Starter',
    },
    {
      id: 'insights',
      name: 'Insights',
      monthly: { price: '₱499', period: '/month' },
      annual: { price: '₱4,990', period: '/year', note: '≈ ₱416/month' },
      bestFor: 'Businesses planning their own promotions',
      includes: [
        'Everything in Starter',
        'Weekly 12-week forecasts for all supported markets: local, domestic and international',
        'Markets ranked for your business',
        'Opportunity alerts',
      ],
      cta: 'Choose Insights',
    },
    {
      id: 'growth',
      name: 'Growth',
      recommended: true,
      monthly: { price: '₱999', period: '/month' },
      annual: { price: '₱9,990', period: '/year', note: '≈ ₱833/month' },
      bestFor: 'Businesses doing active marketing',
      includes: [
        'Everything in Insights',
        '40 AI content drafts a month, with review',
        'Meta and TikTok campaign tracking',
        'Weekly AI reports with next steps',
        'Email support',
      ],
      cta: 'Choose Growth',
    },
    {
      id: 'scale',
      name: 'Scale',
      monthly: { price: 'From ₱2,499', period: '/month' },
      annual: { price: 'From ₱24,990', period: '/year' },
      bestFor: 'Businesses with multiple branches',
      includes: [
        'Growth features for up to 3 branches',
        'Branch-level reporting',
        'Up to 5 team members',
        '120 shared AI content drafts a month',
        'Priority support',
      ],
      cta: 'Talk to us',
    },
  ],
  addOnsLabel: 'Add-ons',
  addOns: ['+20 AI content drafts: ₱149', 'Additional branch: ₱699/month', 'Assisted onboarding: ₱1,500 one-time'],
  partner: {
    eyebrow: 'Partner Plan',
    title: 'For LGU tourism offices, tourism associations and MSME support programs',
    body: 'Give every member business the Growth plan at about 35% below the regular price, with group onboarding and training and one consolidated invoice.',
    price: '₱649',
    period: 'per business / month',
    terms: 'Minimum 20 businesses · billed annually',
    cta: 'Ask about the Partner Plan',
  },
  finePrint: 'All prices in PHP and proposed. They will be tested with pilot customers before launch and may change.',
} as const;

/** Help option pre-selected when someone comes from the Partner Plan. */
export const PARTNER_HELP = 'The Partner Plan';

export const DEMO = {
  eyebrow: 'See CeView for your business',
  title: 'Want to see how CeView could fit your tourism business?',
  lede: 'Book a walkthrough and see how CeView moves from your business profile to a ranked market, a reviewed draft and a campaign report.',
  seeTitle: 'What you’ll see',
  see: [
    'How your business maps to tourism themes',
    'How markets are forecast and ranked for you',
    'How insights become reviewed content',
    'How campaign results shape the next plan',
  ],
  pilot: {
    eyebrow: 'Cebu pilot',
    body: 'We’re onboarding up to 50 Cebu tourism MSMEs for a guided pilot, with help setting up your profile, reading the recommendations and preparing your first promotion.',
  },
  form: {
    title: 'Request your demo',
    sub: 'Takes about a minute. Every field is required unless marked optional.',
    planNote: 'Plan you’re interested in:',
    submit: 'Request My Demo',
    sending: 'Sending…',
    doneTitle: 'Thanks — we’ll be in touch soon.',
    doneBody: 'We’ll reach out to arrange a walkthrough that fits your business.',
    doneLink: 'Explore the FAQ',
  },
  /** Values are the labels themselves; the endpoint stores free text. */
  businessTypes: [
    'Resort, hotel or homestay',
    'Dive shop or marine tour',
    'Tour or adventure operator',
    'Heritage, cultural or events',
    'Attraction or recreation',
    'Restaurant or food business',
    'Travel agency or tourist transport',
    'Souvenir or local-product shop',
    'LGU tourism office or tourism association',
    'Other',
  ],
  /** The first option is the empty "no preference" choice. */
  helpOptions: [
    'Finding the right market',
    'Timing promotions for the off-peak season',
    'Creating content for a market',
    'Reviewing content before posting',
    'Tracking campaign results',
    'The Partner Plan',
  ],
  noPreference: 'No preference',
  consent: 'No commitment. We’ll only use your details to respond to your CeView request.',
} as const;

/**
 * FAQ (#faq). Exact copy; also emitted as FAQPage JSON-LD. `links` turns a
 * phrase inside an answer into an in-page link (display only; the JSON-LD
 * keeps the plain text).
 */
export const FAQ = {
  eyebrow: 'FAQ',
  /** One line each on wider screens; the last ends with <Accent>{titleAccent}</Accent>{titleTail}. */
  titleLines: ['Questions', 'before you', 'explore '],
  titleAccent: 'CeView',
  titleTail: '?',
  introLead: 'Something else on your mind? ',
  introLink: 'Request a demo',
  introTail: ' and ask us directly.',
  cardCaption: 'Built in Cebu, for Cebu tourism businesses first.',
  items: [
    {
      q: 'What exactly does CeView do?',
      a: 'CeView forecasts how strongly travelers are searching online for the kinds of tourism you offer, up to 12 weeks ahead. It ranks which market to focus on, helps you draft and review marketing content for that market, and turns your campaign results into next steps, all in one workflow.',
    },
    {
      q: 'Who is CeView for?',
      a: 'Cebu tourism MSME owners, managers and marketing staff: resorts and homestays, dive shops, tour and activity operators, attractions, food businesses, travel agencies, tourist transport, souvenir shops, and cultural, heritage and event operators. It suits businesses that want to reach new visitor markets without their own analytics team.',
    },
    {
      q: 'Which markets does CeView cover?',
      a: 'Local travelers (Cebu and nearby provinces), domestic travelers (other Philippine regions), and three international markets: South Korea, Japan and the United States. Those three bring about 60% of Central Visayas’ foreign arrivals. More international markets will be added as the platform grows.',
    },
    {
      q: 'Does CeView predict actual bookings?',
      a: 'No. It forecasts online search interest, an early sign of traveler attention, not bookings, arrivals or revenue. It helps you prepare earlier; actual results still depend on your offer, pricing and execution.',
    },
    {
      q: 'Where does the demand information come from?',
      a: 'Weekly search interest from Google Trends, using keyword sets CeView prepares in each market’s language, plus public data on seasonality, exchange rates, economic conditions and flight access. Each forecast shows its data source.',
    },
    {
      q: 'How accurate are the forecasts?',
      a: 'The forecasting model is being evaluated on a reserved test period it never saw during development, against simple baselines like last week’s value, a moving average and the same week last year. The target is an average error of 15% or less. Until that evaluation is complete, forecasts are marked as provisional.',
    },
    {
      q: 'Does CeView create marketing content for me?',
      a: 'It drafts social media captions and visual direction for the market you choose, using your business profile and that market’s cultural context. A second AI reviews each draft against a quality checklist and explains what to improve. You edit and approve the final version.',
    },
    {
      q: 'Does CeView publish content automatically?',
      a: 'No. Nothing is posted to your accounts on your behalf. You decide what to use and where.',
    },
    {
      q: 'Which ad platforms can I connect?',
      a: 'Meta and TikTok. You can also type in results manually. CeView turns them into return on ad spend, conversion rate, cost per customer, click-through rate and cost per click, plus one overall effectiveness score.',
    },
    {
      q: 'How much will CeView cost?',
      a: 'There’s a free Starter plan. Proposed paid plans start at ₱499 a month, and there’s a Partner Plan for LGU tourism offices and tourism associations. Prices will be tested with pilot businesses before launch. See Plans.',
      link: { text: 'Plans', href: '#pricing' },
    },
    {
      q: 'Is my business data private?',
      a: 'Yes. Your business profile, content and results stay in your own account, and other businesses using CeView can’t see them.',
    },
    {
      q: 'How do I try CeView?',
      a: 'Request a demo. We’re onboarding Cebu tourism businesses into a guided pilot, and we’ll walk you through setup, recommendations and your first promotion.',
      link: { text: 'Request a demo', href: '#demo' },
    },
  ],
} as const;

export const FINAL_CTA = {
  eyebrow: 'Be part of a stronger Cebu tourism industry',
  /** Rendered as: {titleLead}<Accent>{titleAccent}{titleTail}</Accent> */
  titleLead: 'Your next tourism opportunity may start before the bookings ',
  titleAccent: 'do',
  titleTail: '.',
  lede: 'Spot rising traveler interest, focus on the right market and prepare your marketing earlier.',
  primaryCta: 'Request a Demo',
  secondaryCta: 'Take the Product Tour',
  pillars: ['Spot demand earlier', 'Reach the right travelers', 'Grow a stronger Cebu together'],
} as const;

export const FOOTER = {
  blurb: 'Tourism demand intelligence and AI-assisted marketing guidance for Cebu tourism businesses.',
  product: [
    { label: 'Why CeView', href: '#why' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Features', href: '#features' },
    { label: 'Plans', href: '#pricing' },
  ],
  company: [
    { label: 'FAQ', href: '#faq' },
    { label: 'Request a Demo', href: '#demo' },
  ],
  signIn: 'Sign In',
  supportsTitle: 'Supports',
  /** Text only; no UN logos. */
  supports: ['UN SDG 8 · Decent work & economic growth', 'SDG 9 · Industry & innovation', 'SDG 11 · Sustainable communities'],
  copyright: '© 2026 CeView. All rights reserved.',
  termsLink: 'Terms of Use',
  privacyLink: 'Privacy Notice',
  creditsLink: 'Photo credits',
  creditsTitle: 'Photo credits',
  creditsIntro: 'Every photo on this page is a real photograph, used under the licence shown.',
} as const;


/* ============================================================
   FACTS — the only allowed source of product claims.
   Later sections draw their wording from here.
   ============================================================ */

export type MarketKey = 'local' | 'domestic' | 'KR' | 'JP' | 'US';

export const FACTS = {
  forecastTarget: {
    what: 'Online search interest',
    meaning: 'An early indicator of traveler attention',
    notWhat: 'Not bookings, arrivals or revenue',
  },
  model: {
    name: 'BiLSTM–Transformer',
    lookbackWeeks: 52,
    horizonWeeks: 12,
    granularity: 'Per market and per tourism theme',
    summary:
      'A trained BiLSTM–Transformer model reads the last 52 weeks of weekly search interest and forecasts the next 12 weeks, per market and per tourism theme.',
  },
  markets: [
    { key: 'local', name: 'Local', detail: 'Cebu & nearby provinces', group: 'local' },
    { key: 'domestic', name: 'Domestic', detail: 'Other Philippine regions', group: 'domestic' },
    { key: 'KR', name: 'South Korea', detail: 'International', group: 'international' },
    { key: 'JP', name: 'Japan', detail: 'International', group: 'international' },
    { key: 'US', name: 'United States', detail: 'International', group: 'international' },
  ] as { key: MarketKey; name: string; detail: string; group: 'local' | 'domestic' | 'international' }[],
  marketsNote: 'More international markets will be added as the platform scales.',
  themes: [
    'Coastal & Island',
    'Adventure & Nature',
    'Cultural & Heritage',
    'Theme Parks & Entertainment',
    'Urban & City',
    'Culinary & Gastronomy',
    'Accommodation & Staycation',
  ],
  profiling: {
    maxThemes: 3,
    summary:
      'A text-classification model reads the business’s own description and assigns up to 3 of the 7 themes, each with a confidence score. An embedding model compares the business with other local businesses to measure how distinct its offer is.',
  },
  ranking: {
    inputs: ['Forecast search interest', 'Seasonality', 'Exchange rates', 'Economic conditions', 'Flight access'],
    alertRule: 'An alert is raised when forecast interest rises above its recent baseline.',
  },
  keywords:
    'Keyword sets are prepared in each market’s language — unlike Google Trends, where you must choose, translate and interpret the terms yourself.',
  content: {
    draft: 'Generative AI drafts social captions and visual direction using the business profile, the forecast and the market’s cultural context.',
    review: 'A second AI scores each draft against a fixed rubric and explains what to improve.',
    control: 'You approve before anything is used. Nothing is posted automatically.',
  },
  performance: {
    sources: 'Campaign data from Meta and TikTok, or entered manually',
    metrics: ['Return on ad spend', 'Conversion rate', 'Cost per customer', 'Click-through rate', 'Cost per click'],
    score: 'Combined into one effectiveness score',
    report:
      'Generative AI turns the results into a plain-language report with next actions; an automated quality check rewrites any report below standard.',
  },
  transparency: {
    summary: 'Each forecast is shown with its data source and whether the model is provisional or validated.',
    sources: { search: 'Google Trends', economic: 'Public sources' },
  },
  status: {
    mvp: ['Business profiling', 'Market radar', 'Content studio', 'Campaign performance reporting'],
    forecastNote: 'Forecasting results are provisional until the reserved test-period evaluation is done.',
    pilotTarget: 'Cebu pilot target: 50 tourism MSMEs',
  },
} as const;

/** Labels for anything that shows numbers which are not a real customer's. */
export const SAMPLE_LABELS = {
  sample: 'Sample data',
  illustrative: 'Illustrative',
} as const;
