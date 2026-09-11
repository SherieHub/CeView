/**
 * Fixture data for the ad-connection endpoints, used when VITE_USE_FIXTURES=true.
 *
 * This layer is deliberately STATEFUL: `mockSetCampaign` mutates an in-memory
 * scope per provider, and `mockConnections` / `mockInsights` read it back — so
 * the preview behaves like the real backend (pick a campaign, sync, and the
 * result reflects that campaign) instead of always echoing one hardcoded name.
 */
import type {
  AdAccountOption,
  AdCampaignOption,
  AdConnection,
  AdInsightSource,
  AdInsightSummary,
  AdProvider,
} from '../../types';

export const MOCK_AD_ACCOUNTS: AdAccountOption[] = [
  { id: 'act_111111111', name: 'Sunset Cove Beach Resort Ads', currency: 'PHP' },
  { id: 'act_222222222', name: 'Personal Test Account', currency: 'PHP' },
];

const MOCK_CAMPAIGNS_BY_PROVIDER: Record<AdProvider, AdCampaignOption[]> = {
  meta: [
    { id: 'meta_cmp_1', name: 'Dry-Season Promo', status: 'ACTIVE' },
    { id: 'meta_cmp_2', name: 'Always-On Brand', status: 'PAUSED' },
  ],
  tiktok: [
    { id: 'tt_cmp_1', name: 'Sardine Run Reels', status: 'ENABLE' },
    { id: 'tt_cmp_2', name: 'Certification Courses', status: 'DISABLE' },
  ],
};

export function mockCampaignsFor(provider: AdProvider): AdCampaignOption[] {
  return MOCK_CAMPAIGNS_BY_PROVIDER[provider];
}

// ── in-memory state ──────────────────────────────────────────────────────────

type Metrics = { impressions: number; clicks: number; spend: number; conversions: number };

type ProviderBase = {
  accountName: string;
  currency: string;
  connectedAt: string;
  /** Whole-account metrics for the period, before any campaign scoping. */
  whole: Metrics & { currency: string };
  /** Per-campaign metrics, keyed by campaign id. */
  byCampaign: Record<string, Metrics>;
};

const BASE: Record<AdProvider, ProviderBase> = {
  meta: {
    accountName: 'Sunset Cove Beach Resort Ads',
    currency: 'PHP',
    connectedAt: '2026-08-20T02:14:00Z',
    whole: { impressions: 48210, clicks: 1327, spend: 4820.55, conversions: 45, currency: 'PHP' },
    byCampaign: {
      meta_cmp_1: { impressions: 29800, clicks: 910, spend: 3120.4, conversions: 31 },
      meta_cmp_2: { impressions: 18410, clicks: 417, spend: 1700.15, conversions: 14 },
    },
  },
  tiktok: {
    accountName: 'Sunset Cove Beach Resort (TikTok)',
    currency: 'PHP',
    connectedAt: '2026-08-24T05:30:00Z',
    whole: { impressions: 13680, clicks: 385, spend: 1570.0, conversions: 13, currency: 'PHP' },
    byCampaign: {
      tt_cmp_1: { impressions: 9120, clicks: 268, spend: 1010.0, conversions: 9 },
      tt_cmp_2: { impressions: 4560, clicks: 117, spend: 560.0, conversions: 4 },
    },
  },
};

/** campaign id per provider, or null for "whole account". Persisted across calls. */
const scopeState: Record<AdProvider, string | null> = {
  meta: 'meta_cmp_1',
  tiktok: null,
};

function campaignNameFor(provider: AdProvider, campaignId: string | null): string | null {
  if (!campaignId) return null;
  return mockCampaignsFor(provider).find((c) => c.id === campaignId)?.name ?? campaignId;
}

function connectionFor(provider: AdProvider): AdConnection {
  const b = BASE[provider];
  const campaignId = scopeState[provider];
  return {
    provider,
    configured: true,
    status: 'ACTIVE',
    accountName: b.accountName,
    currency: b.currency,
    campaignId,
    campaignName: campaignNameFor(provider, campaignId),
    connectedAt: b.connectedAt,
    lastSyncedAt: '2026-09-06T01:00:00Z',
  };
}

// ── public fixture API (read by apiClient's USE_FIXTURES branches) ────────────

export function mockConnections(): AdConnection[] {
  return [connectionFor('meta'), connectionFor('tiktok')];
}

export function mockSetCampaign(provider: AdProvider, campaignId: string | null): AdConnection {
  scopeState[provider] = campaignId;
  return connectionFor(provider);
}

export function mockInsights(providers?: AdProvider[]): AdInsightSummary {
  const wanted: AdProvider[] = providers ?? ['meta', 'tiktok'];
  const sources: AdInsightSource[] = wanted.map((provider) => {
    const b = BASE[provider];
    const campaignId = scopeState[provider];
    const m = campaignId ? b.byCampaign[campaignId] ?? b.whole : b.whole;
    return {
      provider,
      accountName: b.accountName,
      impressions: m.impressions,
      clicks: m.clicks,
      spend: m.spend,
      conversions: m.conversions,
      currency: b.currency,
      campaignName: campaignNameFor(provider, campaignId),
    };
  });
  return {
    periodStart: '2026-08-31',
    periodEnd: '2026-09-06',
    impressions: sources.reduce((n, s) => n + s.impressions, 0),
    clicks: sources.reduce((n, s) => n + s.clicks, 0),
    spend: Number(sources.reduce((n, s) => n + s.spend, 0).toFixed(2)),
    conversions: sources.reduce((n, s) => n + s.conversions, 0),
    currency: 'PHP',
    sources,
    warnings: [],
  };
}
