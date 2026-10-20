/**
 * The demo's guided tour: one opportunity followed through the product —
 * spot the demand, look into it, write for it, check it, see the results.
 * Each stop opens a demo screen and points at a real element on it.
 *
 * `target` is a CSS selector list; the first match in the page is outlined.
 * A stop without one (or whose element hasn't rendered) just shows its card.
 */
export interface TourStep {
  id: string;
  /** Short label for the stage of the journey. */
  stage: string;
  /** Demo route, including any query string. */
  route: string;
  target?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    stage: 'Welcome',
    route: '/demo',
    title: 'Meet Sunset Cove Beach Resort',
    body: 'A fictional beach resort in Moalboal, Cebu, with sample data throughout. This tour follows one opportunity from the first signal to the results — about two minutes.',
  },
  {
    id: 'discover',
    stage: 'Discover demand',
    route: '/demo',
    target: '.alert-card',
    title: 'A surge alert',
    body: 'CeView watches online search interest from each market. When it rises well above its usual level, an alert like this appears — here, South Korea, for accommodation and staycation.',
  },
  {
    id: 'investigate',
    stage: 'Investigate',
    route: '/demo',
    target: '.stat-tile--action',
    title: 'Which market deserves attention',
    body: 'Markets are ranked for each of the business’s categories, using the forecast, the season, flight access and more. Open a tile — or an alert’s “View target markets” — to see why a market ranks where it does.',
  },
  {
    id: 'prepare',
    stage: 'Prepare content',
    route: '/demo/content',
    target: '#studio-step-draft',
    title: 'Captions written for that market',
    body: 'Content Studio drafts captions for the market and platform you chose. In this demo they are sample captions written in advance — pick one and edit it freely.',
  },
  {
    id: 'review',
    stage: 'Review',
    route: '/demo/content?step=validate',
    target: '.audit-start, .audit-summary',
    title: 'Check it before it goes live',
    body: 'Run the audit to score the caption and image against the campaign direction, with what to fix if anything falls short. Try it — the result here is a sample.',
  },
  {
    id: 'results',
    stage: 'Understand results',
    route: '/demo/performance',
    target: '.ov-score-row',
    title: 'How the campaign did',
    body: 'Ad results and your own bookings become one Performance score, with the five numbers behind it in plain words. This is a sample week.',
  },
  {
    id: 'next',
    stage: 'Plan the next move',
    route: '/demo/performance',
    target: '.ov-next',
    title: 'What to do next',
    body: 'Each report ends with the change most likely to help — here, matching the landing page to the ad. The other tabs hold the full plan, the customer journey and trends.',
  },
  {
    id: 'finish',
    stage: 'That’s the loop',
    route: '/demo/performance',
    title: 'Signal, content, results — and round again',
    body: 'Keep exploring on your own, or ask us to walk you through CeView with your own business in mind.',
  },
];
