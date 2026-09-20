/**
 * Public landing page — every piece of copy and every unconfirmed value in one
 * place, so marketing edits never mean hunting through JSX.
 *
 * PLACEHOLDERS
 * Anything not yet confirmed is written as a bracketed token, e.g.
 * '[CONTACT EMAIL]'. The page renders those tokens visibly (see
 * <Placeholder/>) instead of hiding them, so an unfilled value can never ship
 * looking like a real one. Replace the string here and the page picks it up;
 * `isPlaceholder()` is what every consumer checks.
 *
 * CLAIMS
 * Every product statement below describes something the app actually does
 * today. Nothing here is a statistic, customer count, rating or quote — those
 * belong in the placeholder slots until they are real.
 */

export const PLACEHOLDER_PREFIX = '[';

export function isPlaceholder(value: string): boolean {
  return value.trim().startsWith(PLACEHOLDER_PREFIX);
}

/** Unconfirmed links and facts. Replace each value once it is known. */
export const LINKS = {
  /** "Watch product walkthrough". Until set, the button scrolls to the in-page product preview. */
  demoVideo: '[DEMO VIDEO URL]',
  /** Where the lead form POSTs (JSON). Until set, the form does not pretend to send. */
  leadFormDestination: '[LEAD FORM DESTINATION]',
  contactEmail: '[CONTACT EMAIL]',
  bookingLink: '[BOOKING LINK]',
  privacyPolicy: '[PRIVACY POLICY URL]',
  terms: '[TERMS URL]',
} as const;

export const ACCESS_STATUS = '[PRICING / ACCESS STATUS]';

export const CTA = {
  primary: 'Request a Demo',
  secondary: 'Watch Product Walkthrough',
} as const;

/** The three source markets the product currently tracks. */
export const MARKETS = ['South Korea', 'Japan', 'United States'] as const;

export const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Who it’s for', href: '#who-its-for' },
  { label: 'FAQ', href: '#faq' },
] as const;

export const HERO = {
  eyebrow: 'Tourism demand intelligence for Cebu',
  title: 'Spot the next wave of visitors before it reaches Cebu.',
  lede:
    'CeView shows your tourism business when interest from South Korea, Japan and the United States is rising, which market to focus on, and what to post — so your marketing is ready before the opportunity passes.',
  reassurance: 'Made for Cebu resorts, tour operators, dive shops, restaurants and experience providers.',
} as const;

/** Product facts, not performance claims — each is a property of the product itself. */
export const VALUE_STRIP = [
  { value: '3', label: 'International markets tracked', detail: 'South Korea · Japan · United States' },
  { value: 'Weekly', label: 'Traveler-interest updates', detail: 'Fresh signals every week' },
  { value: '12 weeks', label: 'Look-ahead window', detail: 'See what’s coming, not just what happened' },
  { value: '7', label: 'Tourism categories', detail: 'From resorts to food tours' },
] as const;

export const PROBLEM = {
  eyebrow: 'The problem',
  title: 'Travel demand changes quietly — then all at once.',
  lede:
    'By the time bookings pick up, the best moment to promote has usually passed. And most small tourism businesses don’t have anyone watching overseas travel interest week to week.',
  points: [
    {
      title: 'You promote on instinct',
      body: 'Campaigns go out when there’s time to make them — not when travelers are actually starting to plan.',
    },
    {
      title: 'Every market gets the same message',
      body: 'A Korean family, a Japanese couple and an American diver want different things. One generic post has to serve them all.',
    },
    {
      title: 'Content gets made in a rush',
      body: 'When a busy season finally becomes obvious, you’re already too busy to prepare for it properly.',
    },
  ],
} as const;

export const PREVIEW = {
  eyebrow: 'Product preview',
  title: 'Everything that matters this week, on one screen.',
  lede:
    'Your dashboard shows where traveler interest is rising, which market leads for your business, and when the window to act opens.',
  caption: 'Sample view with illustrative data.',
  callouts: [
    { title: 'What needs your attention', body: 'New alerts and active demand surges, summarized at a glance.' },
    { title: 'Which market to focus on', body: 'Markets ranked for your category, with flight access from each.' },
    { title: 'When the window opens', body: 'Recent interest and the weeks ahead — with how confident the forecast is.' },
  ],
} as const;

export const OUTCOMES = {
  eyebrow: 'What you get',
  title: 'What changes when you can see demand coming.',
  items: [
    {
      icon: 'clock',
      title: 'Promote at the right time',
      body: 'Get a heads-up when interest from a market starts climbing, so your campaign lands while travelers are still deciding.',
    },
    {
      icon: 'target',
      title: 'Focus where it counts',
      body: 'See which of South Korea, Japan or the United States is most promising for your kind of business right now.',
    },
    {
      icon: 'pen',
      title: 'Prepare before the rush',
      body: 'Draft market-ready posts early, instead of scrambling once peak season has already started.',
    },
    {
      icon: 'trend',
      title: 'Improve with every campaign',
      body: 'Understand how your posts performed and what to adjust next time — in plain language.',
    },
  ],
} as const;

export const HOW_IT_WORKS = {
  eyebrow: 'How it works',
  title: 'From first signal to published post, in four steps.',
  steps: [
    {
      title: 'Tell CeView about your business',
      body: 'Describe what you offer and who you serve. CeView learns your business so its recommendations stay relevant to you.',
    },
    {
      title: 'CeView watches traveler interest',
      body: 'Every week it tracks what travelers in South Korea, Japan and the United States are looking for — and looks ahead at the weeks to come.',
    },
    {
      title: 'Get told when an opportunity opens',
      body: 'When interest in your category is rising, you get an alert showing which market, how strong, and when the window starts.',
    },
    {
      title: 'Prepare, review and learn',
      body: 'Draft posts for that market, check them against your strategy, then see how they performed.',
    },
  ],
} as const;

export const CAPABILITIES = {
  eyebrow: 'Capabilities',
  title: 'One workflow instead of five disconnected tools.',
  foundation: {
    title: 'It starts by understanding your business',
    body: 'CeView learns what your business offers so its recommendations stay relevant to you — and shows how your offer stands out from similar businesses nearby.',
  },
  groups: [
    {
      title: 'Know your market',
      items: [
        { title: 'Demand monitoring', body: 'Spot changes in traveler interest before they become obvious.' },
        { title: 'Market ranking', body: 'See which international market fits your business best right now, including flight access from each.' },
        { title: 'Marketing direction', body: 'Plain-language guidance on what to promote, to whom, and when.' },
      ],
    },
    {
      title: 'Create with confidence',
      items: [
        { title: 'Market-ready content', body: 'Draft captions and creative ideas written for the travelers you’re targeting.' },
        { title: 'Content review', body: 'Check whether your marketing content matches the strategy you intended to follow, with suggestions you can act on.' },
      ],
    },
    {
      title: 'Learn what works',
      items: [
        { title: 'Performance guidance', body: 'Turn campaign results into clear next steps, not just charts.' },
        { title: 'Content calendar', body: 'Keep planned posts organized around the demand windows ahead.' },
      ],
    },
  ],
} as const;

export const AUDIENCE = {
  eyebrow: 'Who it’s for',
  title: 'Made for Cebu tourism businesses like yours.',
  lede: 'CeView covers the kinds of businesses international visitors come to Cebu for.',
  categories: [
    'Resorts, hotels & staycations',
    'Island hopping, diving & beach tours',
    'Restaurants & food experiences',
    'Heritage & cultural tours',
    'Adventure & nature activities',
    'Theme parks & entertainment',
    'City tours & nightlife',
  ],
  fitTitle: 'A good fit if you:',
  fit: [
    'Welcome — or want to welcome — more international visitors',
    'Handle your own marketing, or have a small team',
    'Want to plan promotions around real demand instead of guesswork',
  ],
} as const;

export const DIFFERENTIATORS = {
  eyebrow: 'Why CeView',
  title: 'Built for your market, not for everyone’s.',
  items: [
    {
      title: 'Focused on Cebu',
      body: 'General marketing tools don’t know what’s happening with travel to Cebu. CeView is built around it.',
    },
    {
      title: 'Specific markets, specific guidance',
      body: 'Instead of a global trend feed, you see the three markets that send the visitors you want — ranked for your business.',
    },
    {
      title: 'From signal to post in one place',
      body: 'Demand insight, content preparation, review and results live together, so nothing gets lost between tools.',
    },
    {
      title: 'Honest about uncertainty',
      body: 'When a forecast is early or less certain, CeView says so — you always know whether you’re looking at a strong signal or a first hint.',
    },
  ],
} as const;

export const VALIDATION = {
  eyebrow: 'From businesses and partners',
  title: 'What Cebu businesses are saying.',
  testimonials: ['[TESTIMONIAL]', '[TESTIMONIAL]'],
  logos: ['[BUSINESS LOGO]', '[BUSINESS LOGO]', '[BUSINESS LOGO]', '[PARTNER LOGO]'],
} as const;

export const LEAD = {
  eyebrow: 'Request a demo',
  title: 'See CeView with your business in mind.',
  lede: 'Tell us a little about your business and we’ll show you how CeView would work for you.',
  includesTitle: 'In your demo',
  includes: [
    'A walkthrough using your type of business',
    'How markets are ranked for a business like yours',
    'How content is prepared and reviewed before it goes out',
  ],
  bookingPrompt: 'Prefer to pick a time yourself?',
} as const;

export const TRUST = {
  eyebrow: 'Trust & transparency',
  title: 'Clear about what CeView does — and doesn’t do.',
  items: [
    {
      icon: 'globe',
      title: 'Built on public travel signals',
      body: 'Forecasts come from publicly available travel-interest trends and economic indicators, combined with what you tell CeView about your business.',
    },
    {
      icon: 'gauge',
      title: 'Forecasts are guidance, not guarantees',
      body: 'Every forecast shows how confident it is. Treat them as planning signals rather than promised bookings.',
    },
    {
      icon: 'check',
      title: 'You approve what goes out',
      body: 'CeView helps you prepare and review content. Nothing is published without your go-ahead.',
    },
    {
      icon: 'lock',
      title: 'Your data stays yours',
      body: 'Your profile, content and results are private to your account. Other businesses can’t see them.',
    },
  ],
} as const;

export const FAQ = {
  eyebrow: 'FAQ',
  title: 'Questions business owners ask.',
  items: [
    {
      q: 'Who is CeView for?',
      a: 'Small and medium tourism businesses in Cebu — resorts, tour operators, dive shops, restaurants and experience providers — that want to attract more international visitors.',
    },
    {
      q: 'Which travelers does CeView follow?',
      a: 'Travelers from South Korea, Japan and the United States. CeView tracks interest from each market separately, because they plan and travel differently.',
    },
    {
      q: 'Do I need to be good with data or marketing?',
      a: 'No. CeView explains what it sees in plain language and suggests what to consider doing next. You don’t need to read charts or know any marketing jargon.',
    },
    {
      q: 'How accurate are the forecasts?',
      a: 'Forecasts are planning signals based on real travel-interest trends, not guarantees of bookings. Each one shows how confident it is, and CeView flags when a forecast is still early or uncertain.',
    },
    {
      q: 'Will CeView post on my social media for me?',
      a: 'CeView helps you draft and review content, but you stay in control: you decide what gets published, where, and when.',
    },
    {
      q: 'What does it cost?',
      a: ACCESS_STATUS,
    },
    {
      q: 'How do I get started?',
      a: 'Request a demo. We’ll walk you through CeView using your type of business and answer any questions.',
    },
  ],
} as const;

export const FINAL_CTA = {
  title: 'The next wave of visitors is already planning. Be ready when they arrive.',
  lede: 'See how CeView helps Cebu tourism businesses act on rising demand before it passes.',
} as const;

export const FOOTER = {
  blurb: 'CeView helps Cebu tourism businesses see rising traveler demand early and prepare the right marketing for it.',
} as const;
