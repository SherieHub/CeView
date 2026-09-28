/**
 * Public landing page — every piece of copy and every configurable value in
 * one place, so marketing edits never mean hunting through JSX.
 *
 * CLAIMS
 * Every product statement here describes something the app does today, and
 * was checked against the product before it was written:
 *   - markets: South Korea, Japan, United States (module 2)
 *   - forecasts look 12 weeks ahead and low-confidence ones are flagged
 *     (ForecastResult.confidence; DrawerChartPanel "Unvalidated forecast")
 *   - market ranking is per tourism category and includes flight access
 *   - caption directions per platform + visual guide / shot list (module 3)
 *   - content review: 0–100 score, pass mark 70, plain-language rationale
 *   - CeView does NOT publish to social accounts (PublishingController is
 *     specified, not implemented) — the FAQ says so
 *   - data is private to each operator's account (multi-tenant isolation)
 * Nothing here is a statistic, customer count, testimonial, price or
 * certification. Pricing is not set (SPMP: "[pricing to be defined]"), so the
 * page says so rather than inventing a tier.
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
  privacyUrl: read(env.VITE_PRIVACY_URL),
  termsUrl: read(env.VITE_TERMS_URL),
} as const;

export const DEMO_ANCHOR = '#request-demo';
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

export const NAV_LINKS = [
  { label: 'Why CeView', href: '#why-ceview' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Who It’s For', href: '#who-its-for' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const MARKETS = [
  { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' },
  { code: 'US', name: 'United States' },
] as const;

/** Canonical categories — same list as onboarding's BUSINESS_CATEGORIES. */
export const BUSINESS_CATEGORIES = [
  'Coastal & Island',
  'Adventure & Nature',
  'Cultural & Heritage',
  'Theme Parks / Entertainment',
  'Urban & City',
  'Culinary & Gastronomy',
  'Accommodation & Staycation',
] as const;

export const HERO = {
  eyebrow: 'Tourism demand intelligence for Cebu businesses',
  titleLead: 'See where traveler demand is heading',
  titleAccent: '— before the opportunity passes.',
  lede:
    'CeView helps Cebu tourism businesses spot rising traveler interest, identify the markets worth watching, and prepare their marketing around those opportunities.',
  trust: ['Built for Cebu tourism MSMEs', 'South Korea · Japan · United States', 'No data-science expertise required'],
  shotAlt:
    'The CeView dashboard for a sample Cebu resort: a surge alert for South Korea and the markets ranked for the Accommodation & Staycation category.',
  /**
   * Every value below is read off the screenshot it floats over. Note the
   * screenshot's own "Top market now" tile says United States — that is
   * across all the business's categories. The ranking card here is the
   * panel for the open Accommodation & Staycation alert, so it is labelled
   * as that ranking, not as "top market now".
   */
  floaters: [
    { tone: 'coral', label: 'Demand window opening', value: '+24% above baseline', note: 'South Korea · next 4 weeks' },
    { tone: 'teal', label: 'Ranked #1 for this alert', value: 'South Korea · 87/100', note: 'Accommodation & Staycation' },
    { tone: 'navy', label: 'Recommended timing', value: 'Prepare within 4 weeks', note: 'Before the window peaks' },
  ],
} as const;

export const MARKET_STRIP = {
  label: 'Currently monitoring traveler demand from',
  note: 'Tracked week by week, with a 12-week look-ahead',
} as const;

export const PROBLEM = {
  eyebrow: 'The challenge',
  title: 'By the time demand becomes obvious, your best marketing window may already be closing.',
  lede:
    'Traveler interest can change long before it appears as a booking, inquiry, or walk-in. For many small tourism businesses, spotting those changes early — and knowing what to do next — is difficult.',
  points: [
    {
      title: 'You don’t always know where the next opportunity is coming from.',
      body: 'You may know international travelers matter, without knowing whether interest from Korea, Japan, or the United States is starting to rise.',
    },
    {
      title: 'Marketing becomes reactive.',
      body: 'Once a busy period is obvious, everyone is competing for the same attention — and there’s little time left to prepare.',
    },
    {
      title: 'Too many disconnected tools, too little time.',
      body: 'Research, content, planning and reviewing results often happen in separate places — if they happen at all.',
    },
  ],
  photo: {
    alt: 'Aerial view of outrigger boats moored beside a green island in clear blue water off Moalboal, Cebu.',
    caption: 'Island-hopping boats off Moalboal, Cebu. Demand for trips like these can build weeks before anyone books.',
  },
  bridge: 'CeView brings the signal, the market, and the marketing decision into one connected workflow.',
  bridgeSteps: ['Spot the opportunity', 'Understand the market', 'Prepare your content', 'Review what works'],
} as const;

export const BENEFITS = {
  eyebrow: 'Why CeView',
  title: 'Spend less time guessing what to market — and more time acting on the opportunity.',
  lede: 'Market signals and marketing guidance in one place, so you can make informed decisions without an analytics team.',
  items: [
    {
      title: 'See opportunities earlier',
      body: 'Notice changes in traveler interest before bookings or inquiries are the only way you find out.',
      why: 'More time to prepare',
    },
    {
      title: 'Know where to focus',
      body: 'Compare South Korea, Japan and the United States for your kind of business instead of marketing to everyone at once.',
      why: 'A clearer target',
    },
    {
      title: 'Move from insight to content faster',
      body: 'Start a campaign from a market-ready direction instead of a blank page.',
      why: 'Less time drafting',
    },
    {
      title: 'Make the next decision with more context',
      body: 'Keep demand signals, content and campaign results together, so each campaign informs the next.',
      why: 'Fewer decisions in isolation',
    },
  ],
} as const;

export type TourId = 'demand' | 'studio' | 'review' | 'performance';

export const TOUR = {
  eyebrow: 'See CeView in action',
  title: 'From traveler interest to a clearer marketing decision.',
  lede: 'See how CeView connects demand signals, market priorities, content guidance, and performance context inside one workflow.',
  caption: 'Real CeView screens, shown with a sample business and sample data.',
  tabs: [
    {
      id: 'demand',
      title: 'Demand Intelligence',
      benefit: 'See when traveler interest may be rising, and which market deserves attention.',
      points: ['Surge alerts when a demand window opens', 'Markets ranked for your tourism category', 'Flight access from each market'],
      alt: 'CeView dashboard showing a surge alert for South Korea and the markets ranked by potential for that alert’s category.',
      pins: [
        { x: 30, y: 58, label: 'Surge alert with timing' },
        { x: 80, y: 62, label: 'Markets ranked for you' },
      ],
    },
    {
      id: 'studio',
      title: 'Content Studio',
      benefit: 'Turn the opportunity into posts written for the market you’re targeting.',
      points: ['Three caption directions per platform', 'Instagram, TikTok and Facebook', 'Visual direction and a shot list'],
      alt: 'CeView Content Studio showing three caption options for Instagram written for travelers from South Korea.',
      pins: [
        { x: 33, y: 42, label: 'Pick a caption direction' },
        { x: 40, y: 82, label: 'Edit before you use it' },
      ],
    },
    {
      id: 'review',
      title: 'Content Review',
      benefit: 'Check a caption and image against your campaign direction before it goes anywhere.',
      points: ['A score out of 100, with a pass mark of 70', 'What’s working and what’s drifting', 'You decide what to change'],
      alt: 'CeView content review showing an overall score of 84, a pass result, sub-scores and a written explanation.',
      pins: [
        { x: 28, y: 64, label: 'Overall score and pass mark' },
        { x: 66, y: 82, label: 'Plain-language explanation' },
      ],
    },
    {
      id: 'performance',
      title: 'Performance',
      benefit: 'Bring campaign results back into the same workflow, so the next decision starts with context.',
      points: ['One performance score, explained', 'What moved it most', 'An action plan for next time'],
      alt: 'CeView performance screen showing an overall performance score and the ad metrics that drove it.',
      pins: [
        { x: 36, y: 50, label: 'Overall performance score' },
        { x: 74, y: 44, label: 'What drove the score' },
      ],
    },
  ] as const,
  cta: 'Want to see the complete workflow?',
};

export const HOW = {
  eyebrow: 'How CeView works',
  title: 'One connected path from understanding your business to improving your next campaign.',
  steps: [
    { title: 'Tell CeView about your business', body: 'Describe what you offer and who you serve, so every recommendation stays relevant to you.' },
    { title: 'See where demand may be heading', body: 'CeView follows traveler interest from each market and looks up to 12 weeks ahead.' },
    { title: 'Find the markets worth watching', body: 'See which of South Korea, Japan or the United States shows stronger potential for your category.' },
    { title: 'Turn the opportunity into marketing direction', body: 'Get caption directions and visual guidance written for that market and your business.' },
    { title: 'Review and improve', body: 'Check content against the plan, then use campaign results to shape the next one.' },
  ],
  /** Index of the step drawn in the opportunity (coral) colour. */
  highlight: 1,
  resultLead: 'The result:',
  result: 'fewer disconnected decisions and a clearer path from “there may be an opportunity” to “here’s what we can do about it.”',
} as const;

export const FEATURES = {
  eyebrow: 'Features',
  title: 'The tools behind a better-timed tourism campaign.',
  forecasts: {
    title: 'Demand Forecasts',
    body: 'See how traveler interest in your category may move over the next 12 weeks — not only what already happened.',
    note: 'Illustrative trend',
  },
  ranking: {
    title: 'Market Ranking',
    body: 'Know which international market shows stronger potential for your type of business right now.',
  },
  surge: {
    title: 'Surge Alerts',
    body: 'Get a clear signal when an important demand window may be opening.',
  },
  guidance: {
    title: 'Business-Aware Marketing Guidance',
    body: 'Recommendations take your tourism category and what you offer into account, instead of giving every business the same advice.',
  },
  direction: {
    title: 'Content Direction',
    body: 'Caption directions, hashtags and visual guidance, written for the market you’re targeting.',
    samples: ['Witty & trend-conscious', 'Formal & value-driven', 'Storytelling & immersive'],
  },
  review: {
    title: 'Content Review',
    body: 'See where your post follows — or drifts from — the campaign direction, with suggestions you can understand.',
  },
  performance: {
    title: 'Performance Guidance',
    body: 'Review results in context and turn them into a plan for what to try next.',
    metrics: ['Return on ad spend', 'Conversion rate', 'Cost per click'],
  },
} as const;

export const AUDIENCE = {
  eyebrow: 'Built for Cebu tourism businesses',
  title: 'Useful market intelligence shouldn’t require a full analytics team.',
  lede: 'CeView is built for tourism businesses that depend on traveler demand but may not have dedicated analysts, revenue-management teams, or large marketing departments.',
  /** The photos are stock (see assets/photos/CREDITS.md) — say so, so they never read as customers. */
  photoNote: 'Illustrative photos of Philippine tourism, via Unsplash — not CeView customers.',
  items: [
    {
      key: 'stay', accent: 'teal', title: 'Resorts & Accommodations',
      body: 'Prepare destination-focused promotions around the weeks interest from a target market starts to rise.',
      alt: 'A resort hotel with palm trees and a large blue swimming pool.',
    },
    {
      key: 'dive', accent: 'cyan', title: 'Dive Shops & Marine Experiences',
      body: 'Spot growing interest in coastal and island travel, and reach divers before they finalize plans.',
      alt: 'A scuba diver swimming over a coral reef in the Philippines.',
    },
    {
      key: 'nature', accent: 'mint', title: 'Adventure & Nature Operators',
      body: 'Time outdoor and eco-tour campaigns to when travelers are starting to look.',
      alt: 'A waterfall pouring into a turquoise pool in Badian, Cebu.',
    },
    {
      key: 'culture', accent: 'coral', title: 'Tours & Cultural Experiences',
      body: 'See which market is warming to heritage travel, and shape tours for it.',
      alt: 'Visitors at a historic stone pavilion with a tiled roof.',
    },
    {
      key: 'fun', accent: 'coral', title: 'Attractions & Entertainment',
      body: 'Shift your promotional focus when family and entertainment travel starts to pick up.',
      alt: 'Costumed dancers performing in a festival street parade in Cebu.',
    },
    {
      key: 'food', accent: 'teal', title: 'Restaurants & Food Businesses',
      body: 'Line up seasonal highlights for visitors who travel for food.',
      alt: 'Hands reaching for rice, grilled fish and vegetables served on banana leaves.',
    },
  ],
} as const;

export const COMPARISON = {
  eyebrow: 'From fragmented to connected',
  title: 'Your market research shouldn’t end where your marketing starts.',
  without: {
    title: 'Without a connected workflow',
    items: ['Search trends somewhere else', 'Research markets manually', 'Guess what content to create', 'Use another tool to prepare it', 'Review performance separately'],
  },
  with: {
    title: 'With CeView',
    items: ['Spot demand signals', 'Identify a target market', 'Get marketing direction', 'Review your content', 'Learn from performance'],
  },
  statementLead: 'CeView’s advantage isn’t simply another forecast or another AI writer.',
  statement: 'It connects market intelligence with the marketing decisions that follow.',
} as const;

export const PRINCIPLES = {
  eyebrow: 'Built around a real tourism-marketing problem',
  title: 'Designed for businesses that need useful answers — not more complicated data.',
  items: [
    { title: 'Built for smaller tourism operators', body: 'Made for businesses without large analytics or marketing teams.' },
    { title: 'Recommendations stay understandable', body: 'Guidance comes with a plain-language reason, not an unexplained score.' },
    { title: 'You stay in control', body: 'AI-assisted guidance supports your marketing decisions. You review what you want to use.' },
  ],
} as const;

export const TRUST = {
  eyebrow: 'Built for informed decisions',
  title: 'Useful guidance, with your business still in control.',
  items: [
    { icon: 'review', title: 'Human review', body: 'CeView supports decisions rather than making marketing decisions automatically. Nothing is posted to your accounts on your behalf.' },
    { icon: 'data', title: 'Business-focused data', body: 'CeView works mainly with information about your business and publicly available tourism-market trends.' },
    { icon: 'private', title: 'Your account stays yours', body: 'Your business profile, content and results are kept to your own account — other businesses using CeView can’t see them.' },
    { icon: 'forecast', title: 'Forecast transparency', body: 'Tourism forecasts indicate possible demand patterns. They do not guarantee bookings, arrivals, revenue, or campaign outcomes — and CeView flags forecasts it’s less certain about.' },
  ],
} as const;

/**
 * Real, attributable social proof only. Empty until there is some — the
 * section renders nothing while this is empty, rather than a placeholder quote.
 */
export const SOCIAL_PROOF: { quote: string; name: string; role: string }[] = [];

export const DEMO = {
  eyebrow: 'See CeView for your business',
  title: 'Want to see how CeView could fit your tourism business?',
  lede: 'Request a walkthrough and see how CeView moves from traveler-demand signals to target-market guidance and campaign direction.',
  seeTitle: 'What you’ll see',
  see: ['How CeView spots tourism-demand opportunities', 'How target markets are ranked', 'How insights become marketing direction'],
  accessTitle: 'Access & pricing',
  access: 'CeView is available by request, and pricing hasn’t been announced yet. A walkthrough is the best first step — we’ll show you the product and talk through access for your business.',
  helpOptions: [
    'Understanding traveler demand',
    'Knowing which market to target',
    'Planning marketing content',
    'Reviewing content before it goes out',
    'Improving campaign performance',
    'Exploring CeView generally',
  ],
  consent: 'No commitment. We’ll use your details only to respond to your CeView request.',
} as const;

export const FAQ = {
  eyebrow: 'FAQ',
  title: 'Questions before you explore CeView?',
  items: [
    {
      q: 'What exactly does CeView do?',
      a: 'CeView follows traveler interest from South Korea, Japan and the United States, tells you when demand for your kind of business may be rising, shows which market to focus on, and helps you prepare and review marketing content for it.',
    },
    {
      q: 'Who is CeView for?',
      a: 'Cebu tourism businesses — resorts, dive shops, tour and activity operators, attractions and food businesses — that want to reach international travelers without needing their own analytics team.',
    },
    {
      q: 'Which international markets does CeView currently cover?',
      a: 'South Korea, Japan and the United States. Each is followed separately, because travelers from each market plan and travel differently.',
    },
    {
      q: 'Does CeView predict actual bookings?',
      a: 'No. CeView forecasts traveler interest — for example, how interest in your category may move over the next 12 weeks. That’s a planning signal, not a promise of bookings, arrivals or revenue, and CeView flags forecasts it’s less certain about.',
    },
    {
      q: 'Where does the demand information come from?',
      a: 'Publicly available online travel-interest trends for each market, combined with seasonality, exchange rates and wider economic indicators — plus flight access when markets are ranked. CeView also uses what you tell it about your business.',
    },
    {
      q: 'Does CeView create marketing content for me?',
      a: 'It suggests caption directions for Instagram, TikTok and Facebook, written for the market you’re targeting, along with visual direction such as a shot list. You choose, edit and decide what to use.',
    },
    {
      q: 'Can CeView review content I’ve created?',
      a: 'Yes. Content Review checks a caption and image against your business, the campaign direction and the target audience. It gives a score out of 100 with a pass mark of 70, and explains in plain language what to improve.',
    },
    {
      q: 'Does CeView automatically publish my content?',
      a: 'No. CeView doesn’t post to your social media accounts on its own. You decide what to use, and where and when it goes out.',
    },
    {
      q: 'How do I try CeView?',
      a: 'Request a demo using the form on this page. We’ll walk you through CeView using your type of business.',
    },
    {
      q: 'How much does CeView cost?',
      a: 'Pricing hasn’t been announced yet. Request a demo and we’ll talk through access for your business.',
    },
  ],
} as const;

export const FINAL_CTA = {
  eyebrow: 'From signal to action',
  title: 'Your next tourism opportunity may start before the bookings do.',
  lede: 'See how CeView helps you identify rising traveler interest, focus on the right market, and prepare your marketing earlier.',
} as const;

export const FOOTER = {
  blurb: 'Tourism demand intelligence and AI-assisted marketing guidance for Cebu tourism businesses.',
} as const;
