/**
 * The public demo's data layer: the apiClient calls the demo screens make,
 * answered in the browser from the sample fixtures (services/fixtures). It is
 * installed by DemoRoot through services/demoMode.ts and loads only with the
 * /demo chunk. Anything not listed here — sign-up, connecting accounts,
 * workspace, onboarding — is refused by the guard as "not in the demo".
 *
 * Nothing here persists: writes are echoed back (a saved profile, an
 * ingested week) so the screen behaves, and are gone on reload or Reset.
 */
import type { DemoApi } from '../../services/demoMode';
import type {
  AdProvider,
  AttributionLink,
  BusinessProfileDto,
  CaptionLanguage,
  CaptionLocalization,
  MarketsResponse,
} from '../../types';
import { MOCK_MARKETS, marketsForCategory } from '../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../services/fixtures/notifications';
import { MOCK_CONTENT, fixtureTranslation } from '../../services/fixtures/content';
import { MOCK_OMCS } from '../../services/fixtures/omcs';
import { MOCK_CREATIVE_DIRECTION } from '../../services/fixtures/creativeDirection';
import { MOCK_HISTORY, MOCK_REPORT } from '../../services/fixtures/campaign';
import { MOCK_POSTS } from '../../services/fixtures/posts';
import { MOCK_CONNECTIONS } from '../../services/fixtures/connections';
import { MOCK_POST_METRICS } from '../../services/fixtures/postMetrics';
import {
  mockCampaignsFor,
  mockConnections,
  mockInsights,
  mockSetCampaign,
} from '../../services/fixtures/adConnections';
import { mockLinkPerformance, mockLinks, mockUnconvertedClicks } from '../../services/fixtures/attributionLinks';

/** A short pause, so loading states read the way they do in the real app. */
function later<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** The ad-campaign picks the demo starts with (see fixtures/adConnections). */
export function resetDemoAdScope(): void {
  mockSetCampaign('meta', 'meta_cmp_1');
  mockSetCampaign('tiktok', null);
}

export function createDemoApi(): DemoApi {
  return {
    notifications: {
      list: () => later(MOCK_NOTIFICATIONS),
      markRead: () => later({ ok: true }, 50),
      keywordTrends: () => later([]),
    },
    markets: {
      forCategory: (category: string) => later(marketsForCategory(category)),
    },
    forecast: {
      status: () => later({ available: true }, 100),
      ensure: () => later(undefined, 100),
      // Re-ranks the same sample markets; the forecast itself does not re-run.
      analyze: () => later<MarketsResponse>({ markets: MOCK_MARKETS }, 1500),
    },
    content: {
      // Sample captions written in advance for the demo business — the demo
      // never calls the AI model.
      generate: () => later(MOCK_CONTENT, 900),
      translate: (input: { caption: string }) => later(fixtureTranslation(input.caption)),
      localize: (input: { captionEn: string; targetLanguage: CaptionLanguage; originalCaption?: string }) =>
        later<CaptionLocalization>({
          caption: input.originalCaption || input.captionEn,
          captionEn: input.captionEn,
          targetLanguage: input.targetLanguage,
          source: 'groq',
        }),
    },
    compliance: {
      omcsAnalyze: () => later(MOCK_OMCS, 600),
    },
    creativeDirection: {
      generate: () => later(MOCK_CREATIVE_DIRECTION),
    },
    campaign: {
      history: () => later(MOCK_HISTORY),
      report: () => later(MOCK_REPORT, 700),
      metrics: () => later({ metrics: {}, funnel: [] }),
      // Nothing is stored; the results screen scores the week in the browser.
      ingest: () => later({}, 500),
    },
    posts: {
      list: () => later(MOCK_POSTS),
      metrics: (postId: string) => later(MOCK_POST_METRICS.find((m) => m.postId === postId) ?? null),
    },
    connections: {
      list: () => later(MOCK_CONNECTIONS),
    },
    adConnections: {
      list: () => later(mockConnections()),
      campaigns: (provider: AdProvider) => later(mockCampaignsFor(provider)),
      selectCampaign: (provider: AdProvider, campaignId: string | null) => later(mockSetCampaign(provider, campaignId)),
      insights: (_start: string, _end: string, providers?: AdProvider[]) => later(mockInsights(providers), 700),
    },
    attributionLinks: {
      list: () => later(mockLinks()),
      performance: (linkId: string) => later(mockLinkPerformance(linkId)),
      unconvertedClicks: () => later(mockUnconvertedClicks()),
      setDestination: (linkId: string, destinationUrl: string | null) =>
        later<AttributionLink>({ ...mockLinks()[0], linkId, destinationUrl, hosted: !destinationUrl }),
    },
    businessProfile: {
      // Echoed back so the screen confirms the edit; it lasts until reload or Reset.
      save: (profile: BusinessProfileDto) => later(profile),
    },
  } as unknown as DemoApi;
}
