/**
 * Typed API client. When VITE_USE_FIXTURES=true (or the backend base URL is
 * unset), every method below resolves from the fixture modules in
 * services/fixtures/ instead of issuing a fetch — see
 * 01-foundation.md's "Fixture Data Layer" card. Real endpoints are added as
 * each screen card wires its backend.
 */
import { loadTokens } from './authStorage';
import { ApiError } from './apiError';
import { MOCK_MARKETS, marketsForCategory } from './fixtures/markets';
import { MOCK_NOTIFICATIONS } from './fixtures/notifications';
import { MOCK_CONTENT } from './fixtures/content';
import { MOCK_OMCS } from './fixtures/omcs';
import { MOCK_HISTORY, MOCK_REPORT } from './fixtures/campaign';
import { MOCK_POSTS } from './fixtures/posts';
import { MOCK_MEMBERS } from './fixtures/members';
import { MOCK_CONNECTIONS } from './fixtures/connections';
import { MOCK_POST_METRICS } from './fixtures/postMetrics';
import type {
  WorkspaceMemberFixture,
  PlatformConnection,
  PostMetric,
  BusinessProfileDto,
  CategoryAllocation,
  UniquenessResult,
  DemandAlert,
  Market,
  CampaignHistoryEntry,
  CampaignInput,
  ManualIngestResponse,
  PrescriptiveReport,
  ContentResponse,
  OmcsAuditResult,
  CreativeDirection,
} from '../types';

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** Simulated network delay so fixture-backed UI still exercises loading states. */
function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = loadTokens();
  const method = init?.method ?? 'GET';
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    // Parse the body for Spring's { code, message }; a non-JSON error body
    // (proxy HTML, empty 502) must not mask the real status.
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    throw new ApiError({ status: res.status, method, path, body });
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const EMPTY_BUSINESS_PROFILE_DTO: BusinessProfileDto = {
  businessProfileId: null,
  businessName: '',
  categories: [],
  coreServices: [],
  description: '',
  uvp: '',
  imagePreview: null,
  uniquenessScore: null,
};

export const apiClient = {
  /** The operator's real, persisted business profile — see ProfileProvider. */
  businessProfile: {
    load: () =>
      USE_FIXTURES
        ? delay(EMPTY_BUSINESS_PROFILE_DTO)
        : request<BusinessProfileDto>('/api/business-profile'),
    /** Persists the profile. Returns the saved DTO so callers refresh from the server's view. */
    save: (profile: BusinessProfileDto) =>
      USE_FIXTURES
        ? delay(profile)
        : request<BusinessProfileDto>('/api/business-profile', {
            method: 'PUT',
            body: JSON.stringify(profile),
          }),
  },

  classification: {
    /** SBERT classification of the operator's free-text profile. All fields required. */
    analyze: (input: {
      businessName: string;
      description: string;
      coreServices: string[];
      uvp: string;
    }) =>
      USE_FIXTURES
        ? delay([{ name: 'Coastal & Island', percentage: 100 }] as CategoryAllocation[])
        : request<{ categories: CategoryAllocation[] }>('/api/classification/analyze', {
            method: 'POST',
            body: JSON.stringify(input),
          }).then((r) => r.categories),
    /** Scores differentiation against the local cohort. Requires the categories from analyze(). */
    uniqueness: (input: {
      businessName: string;
      description: string;
      coreServices: string[];
      uvp: string;
      categories: string[];
    }) =>
      USE_FIXTURES
        ? // Dev-only USE_FIXTURES branch. Deliberately NOT a plausible score:
          // an obviously-empty cohort cannot be mistaken for a real reading if
          // this ever renders outside dev. Real scores come from the seeded
          // reference corpus (V26 + db/dump/uniqueness-corpus.sql).
          delay({
            overallScore: 0,
            semanticsScore: 0,
            categoryScore: 0,
            semanticPercentile: 0,
            cohortSize: 0,
            cohortMedianScore: 0,
            cohortCategories: [],
            categoryDensity: '',
            sufficientCohort: false,
            descriptionFeedback: '',
            categoryFeedback: '',
          } as UniquenessResult)
        : request<UniquenessResult>('/api/classification/uniqueness', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
  },

  markets: {
    list: () =>
      USE_FIXTURES
        ? delay(MOCK_MARKETS)
        : request<{ markets: Market[] }>('/api/forecasting/markets')
            .then((r) => r.markets),
    chartData: (marketId: string) =>
      USE_FIXTURES
        ? delay(MOCK_MARKETS.find((m) => m.id === marketId)?.chartData ?? [])
        // chartData ships inside each MarketDto — no separate round-trip exists.
        : request<{ markets: Market[] }>('/api/forecasting/markets')
            .then((r) => r.markets.find((m) => m.id === marketId)?.chartData ?? []),
    forCategory: (category: string) =>
      USE_FIXTURES
        ? delay(marketsForCategory(category))
        : request<{ markets: Market[] }>(
            `/api/forecasting/markets?category=${encodeURIComponent(category)}`,
          ).then((r) => r.markets),
  },
  notifications: {
    list: () =>
      USE_FIXTURES
        ? delay(MOCK_NOTIFICATIONS)
        : request<{ notifications: DemandAlert[] }>('/api/notifications').then(
            (r) => r.notifications,
          ),
    /**
     * Marks one alert read. Called optimistically and fire-and-forget by the
     * dashboard — read state is already reflected locally, and a failed
     * read-mark is not worth an error surface.
     *
     * The fixture branch deliberately does NOT mutate MOCK_NOTIFICATIONS. The
     * prototype set `n.isRead = true` on its module-level array; doing that
     * here would leak read state between tests and make the suite
     * order-dependent. The dashboard tracks read ids in its own state.
     */
    markRead: (id: string) =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request<void>(`/api/notifications/${id}/read`, { method: 'PATCH' }),
    /**
     * Keyword-trend alerts. Separate from list() because each category
     * round-trips to PyTrends and can take tens of seconds — the dashboard
     * renders demand alerts first and merges these in when they arrive.
     */
    keywordTrends: () =>
      USE_FIXTURES
        ? delay([] as DemandAlert[])
        : request<{ notifications: DemandAlert[] }>('/api/notifications/keyword-trends')
            .then((r) => r.notifications),
  },
  forecast: {
    /**
     * Re-runs the forecasting pipeline. The 2100ms fixture delay is the
     * prototype's own `refreshForecast` timing (ui-ux-prototype.html:2523),
     * moved here so the button owns no timer and tests can await it instead of
     * driving fake timers.
     */
    analyze: () =>
      USE_FIXTURES
        ? delay({ rerankedMarkets: 3 }, 2100)
        : request('/api/forecasting/analyze', { method: 'POST' }),
    /** Drives the dashboard's `ai-down` degraded mode. */
    status: () =>
      USE_FIXTURES
        ? delay({ available: true })
        : request<{ available: boolean }>('/api/forecasting/status'),
  },
  content: {
    /**
     * Generates market-localized captions. The request body is assembled by the
     * caller from ProfileContext plus the selected market — there is no
     * bodyless "list all content" endpoint, and never was.
     */
    generate: (input: {
      market: string;
      businessName: string;
      description: string;
      categories: string[];
      trend: string;
    }) =>
      USE_FIXTURES
        ? delay(MOCK_CONTENT)
        : request<ContentResponse>('/api/content/generate', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    /** Operator approves the generated set for a market. */
    approve: (market: string) =>
      USE_FIXTURES
        ? delay({ approvedIds: [], market, count: 0 })
        : request<{ approvedIds: string[]; market: string; count: number }>(
            '/api/content/approve',
            { method: 'POST', body: JSON.stringify({ market }) },
          ),
  },
  compliance: {
    /**
     * OMCS = 0.35·profile_semantic + 0.45·recommendations_picture + 0.20·pubmat_consistency,
     * Pass/Fail at 70. Both arguments are required — the backend returns 400
     * (MOD3_COMPLIANCE_VALIDATION) if either is blank, so callers must gate the
     * call until the operator has both a caption and an image.
     */
    omcsAnalyze: (input: { caption: string; imageUrl: string }) =>
      USE_FIXTURES
        ? delay(MOCK_OMCS)
        : request<OmcsAuditResult>('/api/compliance/omcs-analyze', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
  },
  creativeDirection: {
    /** Shot list, visual and lighting direction for the VisualDirectionBoard. */
    generate: () =>
      USE_FIXTURES
        ? delay({
            visualGuide: [],
            shots: [],
            moodboard: { palette: '', references: [] },
          } as CreativeDirection)
        : request<CreativeDirection>('/api/creative-direction/generate', { method: 'POST' }),
  },
  campaign: {
    /**
     * Chronological campaign snapshots for the trend charts. The backend's
     * CampaignSnapshot fields match CampaignHistoryEntry exactly, so unwrapping
     * the envelope is the whole mapping.
     */
    history: (weeks: 4 | 8 = 4) =>
      USE_FIXTURES
        ? delay(MOCK_HISTORY)
        : request<{ snapshots: CampaignHistoryEntry[] }>(
            `/api/analytics/history?weeks=${weeks}`,
          ).then((r) => r.snapshots),
    /** AI-generated prescriptive report. POST, not GET — it computes on demand. */
    report: () =>
      USE_FIXTURES
        ? delay(MOCK_REPORT)
        : request<PrescriptiveReport>('/api/analytics/report', {
            method: 'POST',
            body: JSON.stringify({}),
          }),
    /**
     * Server-side KPI computation over the operator's own campaign records
     * (profile-scoped as of Task 13). The board currently derives its KPI cards
     * client-side from the ingestion form via campaignMetrics.ts, so this is
     * the server's second opinion rather than the board's source today.
     */
    metrics: (weeks: 4 | 8 = 4) =>
      USE_FIXTURES
        ? delay({ metrics: {}, funnel: [] })
        : request<{ metrics: Record<string, { value: number }>; funnel: unknown[] }>(
            `/api/analytics/metrics?weeks=${weeks}`,
          ),
    /**
     * Persists operator-entered campaign values and returns server-computed
     * KPIs/funnel/PES. Task 17: the `pes` field is now consumed by
     * CampaignAnalyticsView/PesGauge as the authoritative score — see
     * ManualIngestResponse's doc comment in types.ts. The fixture branch
     * returns no `pes`, which is intentional: PesGauge falls back to its
     * client-side computation (campaignMetrics.ts's computePes()) when one
     * isn't supplied, which is what keeps `VITE_USE_FIXTURES=true` working.
     */
    ingest: (input: CampaignInput) =>
      USE_FIXTURES
        ? delay<ManualIngestResponse>({})
        : request<ManualIngestResponse>('/api/analytics/manual', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
  },
  posts: {
    list: () => (USE_FIXTURES ? delay(MOCK_POSTS) : request('/api/posts')),
    metrics: (postId: string) =>
      USE_FIXTURES
        ? delay(MOCK_POST_METRICS.find((m) => m.postId === postId) ?? null)
        : request(`/api/posts/${postId}/metrics`),
  },
  connections: {
    list: () => (USE_FIXTURES ? delay(MOCK_CONNECTIONS) : request<PlatformConnection[]>('/api/connections')),
    connect: (platform: string) =>
      USE_FIXTURES ? delay({ ok: true }) : request(`/api/connections/${platform}/connect`, { method: 'POST' }),
    disconnect: (platform: string) =>
      USE_FIXTURES ? delay({ ok: true }) : request(`/api/connections/${platform}/disconnect`, { method: 'POST' }),
  },
  workspace: {
    // Returns WorkspaceMemberFixture (fixtures/members.ts), not types.ts's WorkspaceMember —
    // that type models a future real-backend member shape (id/status/lowercase role) that
    // doesn't exist yet. Reconcile the two once a real /api/workspace/members lands.
    members: () => (USE_FIXTURES ? delay(MOCK_MEMBERS) : request<WorkspaceMemberFixture[]>('/api/workspace/members')),
    /**
     * Sends an invite. Backend endpoint is proposed, not yet implemented
     * (docs/shared/workspace.md) — the caller treats this as fire-and-forget
     * (see WorkspaceSettings' optimistic pending row) rather than blocking the
     * UI on it.
     */
    invite: (email: string, role: 'Editor' | 'Viewer') =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request('/api/workspace/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
  },
  auth: {
    login: (email: string, password: string) =>
      USE_FIXTURES
        ? delay({ accessToken: 'mock-access-token-123', profileCompleted: true, user: { id: 'usr-1', email, businessName: null } })
        : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }).then(({ token, operatorId, profileCompleted }) => ({
            accessToken: token,
            profileCompleted,
            // No /me endpoint yet — businessName isn't returned by login, only
            // populated once one exists (see AuthProvider's mount comment).
            user: { id: operatorId, email, businessName: null },
          })),
    register: (email: string, password: string, firstName: string, lastName: string, contactNumber: string) =>
      USE_FIXTURES
        ? delay({ accessToken: 'mock-access-token-123', profileCompleted: true, user: { id: 'usr-1', email, businessName: null } })
        : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, firstName, lastName, contactNumber }),
          }).then(({ token, operatorId, profileCompleted }) => ({
            accessToken: token,
            profileCompleted,
            user: { id: operatorId, email, businessName: null },
          })),
    /** Verifies a Firebase ID token server-side and mints the same session shape as login/register. */
    google: (idToken: string, intent: 'login' | 'register') =>
      USE_FIXTURES
        ? delay({ accessToken: 'mock-access-token-123', profileCompleted: false, user: { id: 'usr-1', email: null, businessName: null } })
        : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ idToken, intent }),
          }).then(({ token, operatorId, profileCompleted }) => ({
            accessToken: token,
            profileCompleted,
            // Google sign-in's email comes back inside the JWT, not this
            // response body — callers that need it read it off the token.
            user: { id: operatorId, email: null, businessName: null },
          })),
    /** The one-time "complete your profile" step (see ProfileCompletionGate). */
    completeProfile: (contactNumber: string) =>
      USE_FIXTURES
        ? delay({ profileCompleted: true })
        : request<{ profileCompleted: boolean }>('/api/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ contactNumber }),
          }),
  },
};
