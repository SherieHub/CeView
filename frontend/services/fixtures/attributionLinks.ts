/**
 * Fixture data for the link-attribution endpoints, used when VITE_USE_FIXTURES=true.
 *
 * Spec: docs/superpowers/specs/2026-09-20-link-attribution-design.md
 *
 * The creative rollup deliberately includes an UNTAGGED row and a zero-click
 * creative. Both are states the real UI has to render and both are easy to
 * forget: the untagged bucket is what an operator sees when they pasted the
 * bare link instead of the macro URL, and it is the likeliest real-world
 * outcome of this feature — a fixture set of three tidy creatives would let
 * that case ship broken.
 */
import type {
  AttributionLink,
  CreativePerformance,
  LinkPerformance,
  UnconvertedClick,
} from '../../types';

const BASE = 'http://localhost:8080';

function urlsFor(slug: string) {
  return {
    linkUrl: `${BASE}/r/${slug}`,
    metaAdUrl: `${BASE}/r/${slug}?cmp={{campaign.id}}&set={{adset.id}}&ad={{ad.id}}`,
    tiktokAdUrl: `${BASE}/r/${slug}?cmp=__CAMPAIGN_ID__&set=__AID__&ad=__CID__`,
  };
}

export const MOCK_LINKS: AttributionLink[] = [
  {
    linkId: '8f1c0a42-1f3c-4a1e-9c7d-2b1e4a6d9f01',
    slug: 'k3f9dqmt',
    category: 'Accommodation & Staycation',
    targetMarket: 'korea',
    // Tier 1: pointed at the operator's own booking page.
    destinationUrl: 'https://kasabeach.ph/book',
    hosted: false,
    windowStart: '2026-10-19T00:00:00+08:00',
    windowEnd: '2026-11-02T00:00:00+08:00',
    urls: urlsFor('k3f9dqmt'),
  },
  {
    linkId: '2d7b5e90-6c44-4f02-bb31-9a0c7e5d3312',
    slug: 'v7h2pnzq',
    category: 'Dive Shop',
    targetMarket: 'JP',
    // Tier 2: no site to point at, so CeView hosts the enquiry page.
    destinationUrl: null,
    hosted: true,
    windowStart: '2026-10-05T00:00:00+08:00',
    windowEnd: '2026-10-19T00:00:00+08:00',
    urls: urlsFor('v7h2pnzq'),
  },
];

const MOCK_CREATIVES: CreativePerformance[] = [
  {
    externalAdId: '120214',
    adLabel: 'Sunset villa — KR',
    untagged: false,
    clicks: 212,
    conversions: 7,
    revenue: 131400,
  },
  {
    externalAdId: '120213',
    adLabel: 'Reef shot — KR',
    untagged: false,
    clicks: 168,
    conversions: 3,
    revenue: 52800,
  },
  {
    externalAdId: '120215',
    adLabel: 'Dive package carousel — KR',
    untagged: false,
    clicks: 94,
    conversions: 0,
    revenue: 0,
  },
  {
    // What an operator sees when they pasted the bare link, or when the click
    // came from an organic post. Not an error state.
    externalAdId: null,
    adLabel: null,
    untagged: true,
    clicks: 57,
    conversions: 1,
    revenue: 18400,
  },
];

export function mockLinks(): AttributionLink[] {
  return MOCK_LINKS.map((l) => ({ ...l }));
}

export function mockLinkPerformance(linkId: string): LinkPerformance {
  const link = MOCK_LINKS.find((l) => l.linkId === linkId) ?? MOCK_LINKS[0];
  const creatives = MOCK_CREATIVES.map((c) => ({ ...c }));
  return {
    linkId: link.linkId,
    slug: link.slug,
    totalClicks: creatives.reduce((sum, c) => sum + c.clicks, 0),
    totalConversions: creatives.reduce((sum, c) => sum + c.conversions, 0),
    totalRevenue: creatives.reduce((sum, c) => sum + c.revenue, 0),
    creatives,
  };
}

export function mockUnconvertedClicks(): UnconvertedClick[] {
  return [
    {
      clickId: 'c1a4e8b2-0f77-4b6a-9e21-1d3f5a7c9011',
      linkId: MOCK_LINKS[0].linkId,
      platform: 'META',
      externalAdId: '120214',
      adLabel: 'Sunset villa — KR',
      untagged: false,
      clickedAt: '2026-10-21T09:14:00+08:00',
    },
    {
      clickId: 'e5f2b731-88aa-4c19-b0d4-6c2a9e1f4433',
      linkId: MOCK_LINKS[0].linkId,
      platform: 'UNKNOWN',
      externalAdId: null,
      adLabel: null,
      untagged: true,
      clickedAt: '2026-10-21T08:02:00+08:00',
    },
  ];
}
