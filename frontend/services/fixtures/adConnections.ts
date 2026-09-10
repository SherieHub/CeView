/**
 * Fixture data for the ad-connection endpoints, used when VITE_USE_FIXTURES=true.
 *
 * Meta is connected and active; TikTok is configured on the server but not yet
 * connected by this operator — the two states the Settings UI most needs to
 * render side by side.
 */
import type { AdAccountOption, AdConnection, AdInsightSummary } from '../../types';

export const MOCK_AD_CONNECTIONS: AdConnection[] = [
  {
    provider: 'meta',
    configured: true,
    status: 'ACTIVE',
    accountName: 'Cebu Dive Co. Ads',
    currency: 'PHP',
    connectedAt: '2026-08-20T02:14:00Z',
    lastSyncedAt: '2026-09-06T01:00:00Z',
  },
  {
    provider: 'tiktok',
    configured: true,
    status: 'DISCONNECTED',
    accountName: null,
    currency: null,
    connectedAt: null,
    lastSyncedAt: null,
  },
];

export const MOCK_AD_ACCOUNTS: AdAccountOption[] = [
  { id: 'act_111111111', name: 'Cebu Dive Co. Ads', currency: 'PHP' },
  { id: 'act_222222222', name: 'Personal Test Account', currency: 'PHP' },
];

export const MOCK_AD_INSIGHTS: AdInsightSummary = {
  periodStart: '2026-08-31',
  periodEnd: '2026-09-06',
  impressions: 48210,
  clicks: 1327,
  spend: 4820.55,
  conversions: 45,
  currency: 'PHP',
  sources: [
    {
      provider: 'meta',
      accountName: 'Cebu Dive Co. Ads',
      impressions: 48210,
      clicks: 1327,
      spend: 4820.55,
      conversions: 45,
      currency: 'PHP',
    },
  ],
  warnings: [],
};
