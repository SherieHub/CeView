/**
 * Typed API client. Every method below resolves from the fixture modules in
 * services/fixtures/ instead of issuing a fetch when — and only when —
 * VITE_USE_FIXTURES is the literal string "true" (see USE_FIXTURES below).
 * There is no other fallback path into fixture mode: an unset or misconfigured
 * backend base URL still issues a real (failing) fetch, it does not silently
 * fall back to fixtures. See 01-foundation.md's "Fixture Data Layer" card.
 * Real endpoints are added as each screen card wires its backend.
 */
import { loadTokens } from './authStorage';
import { EMAIL_NOT_VERIFIED_EVENT } from './authEvents';
import { ApiError } from './apiError';
import { MOCK_MARKETS, marketsForCategory } from './fixtures/markets';
import { MOCK_NOTIFICATIONS } from './fixtures/notifications';
import { MOCK_CONTENT, fixtureTranslation } from './fixtures/content';
import { fixtureDrafts } from './fixtures/contentDrafts';
import { MOCK_OMCS } from './fixtures/omcs';
import { MOCK_CREATIVE_DIRECTION } from './fixtures/creativeDirection';
import { MOCK_HISTORY, MOCK_REPORT } from './fixtures/campaign';
import { MOCK_POSTS } from './fixtures/posts';
import { MOCK_MEMBERS } from './fixtures/members';
import { MOCK_CONNECTIONS } from './fixtures/connections';
import { MOCK_POST_METRICS } from './fixtures/postMetrics';
import {
  MOCK_AD_ACCOUNTS,
  mockCampaignsFor,
  mockConnections,
  mockInsights,
  mockInterests,
  mockLimits,
  mockMinimumBudget,
  mockSaveLimits,
  mockSetCampaign,
} from './fixtures/adConnections';
import { mockCodes, mockLift, mockRedemptions, mockTracked } from './fixtures/attributionCodes';
import {
  mockLinkPerformance,
  mockLinks,
  mockUnconvertedClicks,
} from './fixtures/attributionLinks';
import type {
  AdInterestOption,
  AdMinimumBudget,
  AdObjective,
  AdSpendLimits,
  PublishedPost,
  PublishRequest,
  WorkspaceMemberFixture,
  PlatformConnection,
  SocialConnectionDto,
  MetaPageOption,
  PostMetric,
  AuthSession,
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
  EnsureForecastResult,
  ContentDraft,
  ContentDraftSummary,
  CaptionLanguage,
  CaptionLocalization,
  CaptionTranslation,
  OmcsAuditResult,
  CreativeDirection,
  AdAccountOption,
  AdCampaignOption,
  AdConnection,
  AdInsightSummary,
  AdProvider,
  MarketsResponse,
  AttributionLink,
  LinkPerformance,
  UnconvertedClick,
  MediaUploadSlot,
  MediaAssetDto,
  AttributionVoucher,
  VoucherRedemption,
  AdCostRates,
  AttributionCodeSummary,
  AttributionRedemption,
  LogBookingInput,
  TrackedPeriodSummary,
  AttributionLift,
} from '../types';

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
/** The API origin, for the few callers (media upload) that must build absolute URLs themselves. */
export const API_BASE_URL = BASE_URL;

// Build-time guard (T-01..T-08): import.meta.env.PROD is a compile-time
// constant Vite replaces during a production build, so this branch is dead
// code — and its `throw` unreachable — in dev/preview builds, but fails a
// production bundle immediately on load if VITE_USE_FIXTURES was ever left
// "true" for that build. Fixture data must never be what a real operator sees.
if (USE_FIXTURES && import.meta.env.PROD) {
  throw new Error(
    'VITE_USE_FIXTURES=true in a production build — fixtures must never ship to real operators.',
  );
}

/** Simulated network delay so fixture-backed UI still exercises loading states. */
function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Backend session body shared by login / register / google / password-reset confirm. */
interface SessionDto {
  token: string;
  operatorId: string;
  profileCompleted: boolean;
  /** Absent only from a backend that predates email verification; treated as verified then. */
  emailVerified?: boolean;
}

interface CodeSentDto {
  sentTo: string;
  resendAvailableInSeconds: number;
}

function toPlatformConnections(dtos: SocialConnectionDto[]): PlatformConnection[] {
  return dtos.map((dto) => ({
    platform: dto.platform,
    connected: dto.status === 'ACTIVE',
    handle: dto.handle,
    connectedAt: dto.connectedAt,
    status: dto.status,
    configured: dto.configured,
  }));
}

function toSession(dto: SessionDto, email: string | null): AuthSession {
  return {
    accessToken: dto.token,
    profileCompleted: dto.profileCompleted,
    emailVerified: dto.emailVerified ?? true,
    // No /me endpoint yet — businessName isn't returned, and Google sign-in's
    // email comes back inside the JWT rather than this body (hence null there).
    user: { id: dto.operatorId, email, businessName: null },
  };
}

function fixtureSession(email: string | null): AuthSession {
  return {
    accessToken: 'mock-access-token-123',
    profileCompleted: true,
    emailVerified: true,
    user: { id: 'usr-1', email, businessName: null },
  };
}

/** Evidence accompanying a contact number: a Firebase token, or an explicit "verify later" opt-out. */
export interface PhoneProof {
  phoneIdToken?: string;
  verifyLater?: boolean;
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
    const error = new ApiError({ status: res.status, method, path, body });
    // The backend gates every non-auth route on a verified email. Tell AuthProvider so it can
    // route to /verify-email, which also repairs a session stored before verification shipped.
    if (res.status === 403 && error.code === 'EMAIL_NOT_VERIFIED') {
      window.dispatchEvent(new Event(EMAIL_NOT_VERIFIED_EVENT));
    }
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** A GET whose answer is a file, not JSON — with the same auth and error shape as request(). */
async function requestBlob(path: string): Promise<Blob> {
  const tokens = loadTokens();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {},
  });
  if (!res.ok) throw new ApiError({ status: res.status, method: 'GET', path });
  return res.blob();
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
    // A category is required.  Dashboard owns this read so rank, chart and
    // drawer all operate on one coherent category-scoped Market[] response.
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
     * Persisted keyword-trend alerts. The backend's scheduled producer performs
     * any slow PyTrends refresh, so this read never waits on a rank request.
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
     *
     * T-08: the fixture branch returns the same { markets: Market[] } envelope
     * the live endpoint does — RefreshForecastButton reads markets.length for
     * its toast, so a fixture-shaped response that lacks it would silently lie
     * about how many markets were re-ranked.
     */
    analyze: () =>
      USE_FIXTURES
        ? delay<MarketsResponse>({ markets: MOCK_MARKETS }, 2100)
        : request<MarketsResponse>('/api/forecasting/analyze', { method: 'POST' }),
    /** Drives the dashboard's `ai-down` degraded mode. */
    status: () =>
      USE_FIXTURES
        ? delay({ available: true })
        : request<{ available: boolean }>('/api/forecasting/status'),
    /**
     * Called once on dashboard mount (Step 16, C-07/C-08/C-09) so a new or
     * stale operator sees real alerts without pressing Refresh first. Cheap
     * when data is fresh (a DB read, no pipeline) — the staleness gate lives
     * in ForecastingService.ensureFreshForecast, not here. A 409
     * (MOD22_PROFILE_NOT_READY) means onboarding isn't complete; the caller
     * is expected to route that through isProfileNotReady(), same as any
     * other screen's ApiErrorPanel.
     *
     * Answers `{ refreshed, generatedAt }`: whether the live pipeline just ran,
     * and when the forecast was generated. An older backend sends something
     * else (or nothing), which callers must treat as "unknown".
     */
    ensure: (maxAgeHours = 12) =>
      USE_FIXTURES
        ? delay<EnsureForecastResult>({ refreshed: false, generatedAt: new Date().toISOString() })
        : request<EnsureForecastResult | undefined>(`/api/forecasting/ensure?maxAgeHours=${maxAgeHours}`, {
            method: 'POST',
          }),
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
      /** The surge alert Content Studio was opened for; pins which window's attribution code captions carry. */
      demandAlertId?: string;
    }) =>
      USE_FIXTURES
        ? delay(MOCK_CONTENT)
        : request<ContentResponse>('/api/content/generate', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    /**
     * Meaning-faithful English for a Korean/Japanese caption (the "Show English"
     * toggle). Fixture mode answers from the fixture's own `optionsEn`.
     */
    translate: (input: { caption: string; platform?: string }) =>
      USE_FIXTURES
        ? delay<CaptionTranslation>(fixtureTranslation(input.caption))
        : request<CaptionTranslation>('/api/content/translate', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
    /**
     * Rewrites owner-edited English as a natural Korean/Japanese caption
     * ("Apply to Korean/Japanese"). `originalCaption` keeps the existing voice.
     */
    localize: (input: {
      captionEn: string;
      targetLanguage: CaptionLanguage;
      platform?: string;
      originalCaption?: string;
    }) =>
      USE_FIXTURES
        ? delay<CaptionLocalization>({
            caption: input.originalCaption || input.captionEn,
            captionEn: input.captionEn,
            targetLanguage: input.targetLanguage,
            source: 'groq',
          })
        : request<CaptionLocalization>('/api/content/localize', {
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
  /** Saved Content Studio drafts. The profile is the caller's own, from the JWT — no id is sent. */
  contentDrafts: {
    /** The market's auto-saved working draft, or null when there is none. */
    getAuto: (market: string) =>
      USE_FIXTURES
        ? delay(fixtureDrafts.getAuto(market))
        : request<ContentDraft | undefined>(`/api/content/drafts/auto?market=${encodeURIComponent(market)}`).then(
            (draft) => draft ?? null,
          ),
    saveAuto: (market: string, demandAlertId: string | null, payload: Record<string, unknown>) =>
      USE_FIXTURES
        ? delay(fixtureDrafts.saveAuto(market, demandAlertId, payload))
        : request<ContentDraft>(
            `/api/content/drafts/auto?market=${encodeURIComponent(market)}${
              demandAlertId ? `&demandAlertId=${encodeURIComponent(demandAlertId)}` : ''
            }`,
            { method: 'PUT', body: JSON.stringify({ payload }) },
          ),
    /** Named drafts for a market, newest first. */
    list: (market: string) =>
      USE_FIXTURES
        ? delay(fixtureDrafts.list(market))
        : request<ContentDraftSummary[]>(`/api/content/drafts?market=${encodeURIComponent(market)}`),
    get: (id: string) =>
      USE_FIXTURES ? delay(fixtureDrafts.get(id)) : request<ContentDraft>(`/api/content/drafts/${id}`),
    create: (market: string, demandAlertId: string | null, name: string, payload: Record<string, unknown>) =>
      USE_FIXTURES
        ? delay(fixtureDrafts.create(market, demandAlertId, name, payload))
        : request<ContentDraft>(
            `/api/content/drafts?market=${encodeURIComponent(market)}${
              demandAlertId ? `&demandAlertId=${encodeURIComponent(demandAlertId)}` : ''
            }`,
            { method: 'POST', body: JSON.stringify({ name, payload }) },
          ),
    update: (id: string, changes: { name?: string; payload?: Record<string, unknown> }) =>
      USE_FIXTURES
        ? delay(fixtureDrafts.update(id, changes))
        : request<ContentDraft>(`/api/content/drafts/${id}`, { method: 'PUT', body: JSON.stringify(changes) }),
    remove: (id: string) =>
      USE_FIXTURES
        ? delay(fixtureDrafts.remove(id))
        : request<void>(`/api/content/drafts/${id}`, { method: 'DELETE' }),
  },
  compliance: {
    /**
     * OMCS = 0.35·profile_semantic + 0.45·recommendations_picture + 0.20·pubmat_consistency,
     * Pass/Fail at 70. Caption and image are required — the backend returns 400
     * (MOD3_COMPLIANCE_VALIDATION) if either is blank. `recommendations` is the visual
     * guidance the image is judged against; without it the audit returns 424
     * (MOD33_RECOMMENDATIONS_MISSING), so callers gate the call on all three.
     */
    omcsAnalyze: (input: {
      caption: string;
      /**
       * English translation of `caption`, when it is not English. Used only for the
       * profile-similarity sub-score; the image checks still read `caption`.
       */
      captionEn?: string;
      imageUrl: string;
      recommendations: Record<string, unknown>;
    }) =>
      USE_FIXTURES
        ? delay(MOCK_OMCS)
        : request<OmcsAuditResult>('/api/compliance/omcs-analyze', {
            method: 'POST',
            body: JSON.stringify(input),
          }),
  },
  creativeDirection: {
    /**
     * Shot list, visual and lighting direction for CampaignBriefDrawer.
     *
     * Requires captions for `market` to be approved first (content.approve) —
     * the backend answers 400 missing_dependency otherwise. The market must be
     * sent: omitted, the backend silently defaults to "korea".
     */
    generate: (market: string) =>
      USE_FIXTURES
        ? delay(MOCK_CREATIVE_DIRECTION)
        : request<CreativeDirection>(
            `/api/creative-direction/generate?market=${encodeURIComponent(market)}`,
            { method: 'POST' },
          ),
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
    /**
     * The operator's own past cost per 1,000 views and per click, for the ad
     * planner's budget estimate (CVW-43). Fixture mode returns no history, so
     * the planner's "no estimate" path is what a fresh demo shows.
     */
    costRates: () =>
      USE_FIXTURES
        ? delay<AdCostRates>({
            periods: 0, totalSpend: 0, totalImpressions: 0, totalClicks: 0,
            costPerThousandImpressions: null, costPerClick: null,
          })
        : request<AdCostRates>('/api/analytics/cost-rates'),
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
    list: () => (USE_FIXTURES ? delay(MOCK_POSTS) : request<PublishedPost[]>('/api/posts')),
    publish: (payload: PublishRequest) => request<PublishedPost[]>('/api/posts/publish', { method: 'POST', body: JSON.stringify(payload) }),
    cancel: (id: string) => request<void>(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    metrics: (postId: string) => USE_FIXTURES
      ? delay(MOCK_POSTS.find((post) => post.id === postId) ?? null)
      : request<PublishedPost>(`/api/analytics/posts/${encodeURIComponent(postId)}`),
  },
  /**
   * Publishing connections (Facebook Page, Instagram, TikTok). Meta's login itself is
   * adConnections.authorize('meta') — one Meta login serves ads and publishing.
   */
  connections: {
    list: () =>
      USE_FIXTURES
        ? delay(MOCK_CONNECTIONS)
        : request<SocialConnectionDto[]>('/api/social-connections').then(toPlatformConnections),

    tiktokAuthorize: () =>
      USE_FIXTURES
        ? delay<{ authorizeUrl: string }>({ authorizeUrl: '#fixture-no-oauth' })
        : request<{ authorizeUrl: string }>('/api/social-connections/tiktok/authorize', { method: 'POST' }),

    /** Finishes TikTok's login from the SPA (code + state come from the callback redirect). */
    tiktokComplete: (code: string, state: string) =>
      USE_FIXTURES
        ? delay(MOCK_CONNECTIONS)
        : request<SocialConnectionDto[]>('/api/social-connections/tiktok/complete', {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          }).then(toPlatformConnections),

    metaPages: () =>
      USE_FIXTURES
        ? delay<MetaPageOption[]>([
            { id: 'page-1', name: 'Cebu Dive Co.', instagramUsername: 'cebu.dive' },
            { id: 'page-2', name: 'Mactan Cafe', instagramUsername: null },
          ])
        : request<MetaPageOption[]>('/api/social-connections/meta/pages'),

    /** Returns the fresh connection list. */
    selectMetaPage: (pageId: string) =>
      USE_FIXTURES
        ? delay(MOCK_CONNECTIONS)
        : request<SocialConnectionDto[]>('/api/social-connections/meta/page', {
            method: 'PUT',
            body: JSON.stringify({ pageId }),
          }).then(toPlatformConnections),

    disconnect: (platform: string) =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request<void>(`/api/social-connections/${platform}`, { method: 'DELETE' }),
  },
  /** Media uploads for publishing — see services/mediaUpload.ts for the full flow. */
  media: {
    requestUpload: (contentType: string, sizeBytes: number) =>
      USE_FIXTURES
        ? delay<MediaUploadSlot>({
            mediaId: 'fixture-media',
            uploadUrl: '#fixture-no-upload',
            publicUrl: 'https://example.invalid/fixture-media',
            kind: contentType.startsWith('video/') ? 'video' : 'image',
          })
        : request<MediaUploadSlot>('/api/media/uploads', {
            method: 'POST',
            body: JSON.stringify({ contentType, sizeBytes }),
          }),

    complete: (mediaId: string, dims: { width?: number; height?: number; durationSeconds?: number } = {}) =>
      USE_FIXTURES
        ? delay<MediaAssetDto | null>(null)
        : request<MediaAssetDto>(`/api/media/${mediaId}/complete`, {
            method: 'POST',
            body: JSON.stringify(dims),
          }),

    /**
     * The stored image's bytes, read through the API. A saved draft restores its picture from
     * here: the asset's public URL is for outsiders (the social platforms) and may not be
     * reachable from the browser at all. Images only; fixtures mode has no stored file.
     */
    content: (mediaId: string) =>
      USE_FIXTURES
        ? Promise.reject(new Error('no stored file in fixture mode'))
        : requestBlob(`/api/media/${mediaId}/content`),
  },

  /**
   * Ad-platform (Meta / TikTok) account connections and metric sync.
   *
   * Distinct from `connections` above, which is the publishing-platform
   * scaffolding. An ads grant is a different authorisation — see types.ts's
   * AdProvider doc comment.
   */
  adConnections: {
    list: () =>
      USE_FIXTURES
        ? delay<AdConnection[]>(mockConnections())
        : request<AdConnection[]>('/api/ad-connections'),

    /** Returns the consent-screen URL the browser should navigate to. */
    authorize: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay<{ authorizeUrl: string }>({ authorizeUrl: '#fixture-no-oauth' })
        : request<{ authorizeUrl: string }>(`/api/ad-connections/${provider}/authorize`, {
            method: 'POST',
          }),

    complete: (provider: AdProvider, code: string, state: string) =>
      USE_FIXTURES
        ? delay<void>(undefined)
        : request<void>(`/api/ad-connections/${provider}/complete`, {
            method: 'POST',
            body: JSON.stringify({ code, state }),
          }),

    accounts: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay<AdAccountOption[]>(MOCK_AD_ACCOUNTS)
        : request<AdAccountOption[]>(`/api/ad-connections/${provider}/accounts`),

    selectAccount: (provider: AdProvider, externalAccountId: string) =>
      USE_FIXTURES
        ? delay<AdConnection>(
            mockConnections().find((c) => c.provider === provider) ?? mockConnections()[0],
          )
        : request<AdConnection>(`/api/ad-connections/${provider}/account`, {
            method: 'POST',
            body: JSON.stringify({ externalAccountId }),
          }),

    campaigns: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay<AdCampaignOption[]>(mockCampaignsFor(provider))
        : request<AdCampaignOption[]>(`/api/ad-connections/${provider}/campaigns`),

    selectCampaign: (provider: AdProvider, externalCampaignId: string | null) =>
      USE_FIXTURES
        ? delay<AdConnection>(mockSetCampaign(provider, externalCampaignId))
        : request<AdConnection>(`/api/ad-connections/${provider}/campaign`, {
            method: 'POST',
            body: JSON.stringify({ externalCampaignId }),
          }),

    disconnect: (provider: AdProvider) =>
      USE_FIXTURES
        ? delay({ ok: true })
        : request(`/api/ad-connections/${provider}`, { method: 'DELETE' }),

    /** The business's own daily and total ceilings for CeView-created Meta ads. */
    limits: {
      get: () =>
        USE_FIXTURES
          ? delay<AdSpendLimits>(mockLimits())
          : request<AdSpendLimits>('/api/ad-connections/meta/limits'),
      save: (maxDailyMinor: number, maxTotalMinor: number) =>
        USE_FIXTURES
          ? delay<AdSpendLimits>(mockSaveLimits(maxDailyMinor, maxTotalMinor))
          : request<AdSpendLimits>('/api/ad-connections/meta/limits', {
              method: 'PUT',
              body: JSON.stringify({ maxDailyMinor, maxTotalMinor }),
            }),
    },

    /** Meta's floor for one ad set's daily budget on the connected ad account (null when unknown). */
    minimumBudget: (objective: AdObjective) =>
      USE_FIXTURES
        ? delay<AdMinimumBudget>(mockMinimumBudget(objective))
        : request<AdMinimumBudget>(`/api/ad-connections/meta/minimum-budget?objective=${encodeURIComponent(objective)}`),

    /** Searches Meta's own interest catalogue; the ids are what ad targeting uses. */
    searchInterests: (query: string) =>
      USE_FIXTURES
        ? delay<AdInterestOption[]>(mockInterests(query), 150)
        : request<AdInterestOption[]>(`/api/ad-connections/meta/interests?q=${encodeURIComponent(query)}`),

    /**
     * Pulls the period's metrics from every connected ad account. Synchronous
     * on the backend — this call can take several seconds.
     */
    /**
     * @param providers when given, only these ad accounts are synced (the
     *   operator excluded the others for this analysis). Omit to sync all.
     */
    insights: (periodStart: string, periodEnd: string, providers?: AdProvider[]) => {
      if (USE_FIXTURES) {
        return delay<AdInsightSummary>(mockInsights(providers));
      }
      const qs =
        `periodStart=${periodStart}&periodEnd=${periodEnd}` +
        (providers && providers.length > 0 ? `&providers=${providers.join(',')}` : '');
      return request<AdInsightSummary>(`/api/ad-connections/insights?${qs}`);
    },
  },

  /**
   * Link attribution — spec: docs/superpowers/specs/2026-09-20-link-attribution-design.md
   *
   * Complements the promo-code path rather than replacing it: a link answers
   * "which creative produced this booking" automatically, a code covers the
   * Messenger, phone and walk-in bookings a link can never see.
   *
   * The redirect (`/r/{slug}`) and the public enquiry endpoint are deliberately
   * absent from this client. Both are hit by a traveller's browser with no JWT,
   * and `request()` attaches the operator's token — routing them through here
   * would be wrong and, for the redirect, meaningless.
   */
  attributionLinks: {
    list: () =>
      USE_FIXTURES
        ? delay<AttributionLink[]>(mockLinks())
        : request<AttributionLink[]>('/api/attribution/links'),

    /**
     * Switches a link between tier 1 and tier 2. Passing null (or an empty
     * string) means "use CeView's hosted enquiry page".
     */
    setDestination: (linkId: string, destinationUrl: string | null) =>
      USE_FIXTURES
        ? delay<AttributionLink>({
            ...mockLinks()[0],
            linkId,
            destinationUrl,
            hosted: !destinationUrl,
          })
        : request<AttributionLink>(`/api/attribution/links/${linkId}`, {
            method: 'PATCH',
            body: JSON.stringify({ destinationUrl }),
          }),

    /** Per-creative rollup for the Performance screen's link panel. */
    performance: (linkId: string) =>
      USE_FIXTURES
        ? delay<LinkPerformance>(mockLinkPerformance(linkId))
        : request<LinkPerformance>(`/api/attribution/links/${linkId}/creatives`),

    /**
     * Clicks with no booking attached yet, offered when the operator logs one
     * manually. Windowed on the backend — an unbounded list would be useless
     * to pick from.
     */
    unconvertedClicks: (from: string, to: string) =>
      USE_FIXTURES
        ? delay<UnconvertedClick[]>(mockUnconvertedClicks())
        : request<UnconvertedClick[]>(
            `/api/attribution/clicks/unconverted?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          ),
  },

  /**
   * Conversion capture (CVW-42) — docs/module-4/CONVERSION_CAPTURE_RESEARCH.md.
   * Codes cover the Messenger, phone and walk-in bookings a tracked link can
   * never see: staff log the booking the moment a customer quotes the code,
   * optionally attaching it to a recorded ad click.
   */
  attribution: {
    codes: () =>
      USE_FIXTURES
        ? delay<AttributionCodeSummary[]>(mockCodes())
        : request<AttributionCodeSummary[]>('/api/attribution/codes'),

    logBooking: (input: LogBookingInput) =>
      USE_FIXTURES
        ? delay<AttributionRedemption>({
            ...mockRedemptions()[0],
            redemptionId: `mock-${Date.now()}`,
            attributionCodeId: input.attributionCodeId ?? mockRedemptions()[0].attributionCodeId,
            bookings: input.bookings ?? 1,
            revenue: input.revenue ?? 0,
            eventAt: input.eventAt ?? new Date().toISOString(),
            clickId: input.clickId ?? null,
            source: input.clickId ? 'LINK' : 'MANUAL',
            kind: input.clickId ? 'CLICK_MATCHED' : 'CODE_LOGGED',
          })
        : request<AttributionRedemption>('/api/attribution/redemptions', {
            method: 'POST',
            body: JSON.stringify(input),
          }),

    /** Most recent bookings across every code, newest first. */
    recentRedemptions: () =>
      USE_FIXTURES
        ? delay<AttributionRedemption[]>(mockRedemptions())
        : request<AttributionRedemption[]>('/api/attribution/redemptions'),

    /** Undoes an operator-logged booking. Enquiries and synced rows are refused (409). */
    deleteRedemption: (redemptionId: string) =>
      USE_FIXTURES
        ? delay<void>(undefined)
        : request<void>(`/api/attribution/redemptions/${redemptionId}`, { method: 'DELETE' }),

    /** Bookings tracked in one reporting period (both dates inclusive, YYYY-MM-DD). */
    tracked: (periodStart: string, periodEnd: string) =>
      USE_FIXTURES
        ? delay<TrackedPeriodSummary>(mockTracked(periodStart, periodEnd))
        : request<TrackedPeriodSummary>(
            `/api/attribution/tracked?periodStart=${periodStart}&periodEnd=${periodEnd}`,
          ),

    /** A code's surge window vs. the four weeks before it. */
    lift: (attributionCodeId: string) =>
      USE_FIXTURES
        ? delay<AttributionLift>(mockLift(attributionCodeId))
        : request<AttributionLift>(`/api/attribution/lift/${attributionCodeId}`),
  },

  vouchers: {
    list: () => USE_FIXTURES
      ? delay<AttributionVoucher[]>([])
      : request<AttributionVoucher[]>('/api/attribution/vouchers'),
    redeem: (codeId: string, grossRevenue: number) => USE_FIXTURES
      ? Promise.reject(new Error('No voucher is available in fixture mode.'))
      : request<VoucherRedemption>(`/api/attribution/vouchers/${encodeURIComponent(codeId)}/redeem`, {
          method: 'POST', body: JSON.stringify({ grossRevenue }),
        }),
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
        ? delay(fixtureSession(email))
        : request<SessionDto>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }).then((dto) => toSession(dto, email)),
    register: (email: string, password: string, firstName: string, lastName: string, contactNumber: string, phone?: PhoneProof) =>
      USE_FIXTURES
        ? delay(fixtureSession(email))
        : request<SessionDto>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, firstName, lastName, contactNumber, ...phone }),
          }).then((dto) => toSession(dto, email)),
    /** Verifies a Firebase ID token server-side and mints the same session shape as login/register. */
    google: (idToken: string, intent: 'login' | 'register') =>
      USE_FIXTURES
        ? delay({ ...fixtureSession(null), profileCompleted: false })
        : request<SessionDto>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ idToken, intent }),
          }).then((dto) => toSession(dto, null)),
    /** Emails a fresh 6-digit code to the signed-in operator. Rejects with code RESEND_COOLDOWN / SEND_LIMIT / EMAIL_SEND_FAILED. */
    sendVerificationCode: () =>
      USE_FIXTURES
        ? delay({ sentTo: 'you@example.com', resendAvailableInSeconds: 60 })
        : request<CodeSentDto>('/api/auth/email-verification/send', { method: 'POST' }),
    /** Rejects with code INVALID_CODE (+ attemptsRemaining) / CODE_EXPIRED / CODE_LOCKED / NO_ACTIVE_CODE. */
    verifyEmail: (code: string) =>
      USE_FIXTURES
        ? delay({ emailVerified: true })
        : request<{ emailVerified: boolean }>('/api/auth/email-verification/verify', {
            method: 'POST',
            body: JSON.stringify({ code }),
          }),
    /** Fixes a mistyped address while unverified; the backend mails a new code to it. Rejects with EMAIL_TAKEN / SAME_EMAIL. */
    changeEmail: (email: string) =>
      USE_FIXTURES
        ? delay({ email })
        : request<{ email: string }>('/api/auth/email', { method: 'PATCH', body: JSON.stringify({ email }) }),
    /** Rejects with ACCOUNT_NOT_FOUND / GOOGLE_ACCOUNT / RESEND_COOLDOWN / SEND_LIMIT. */
    requestPasswordReset: (email: string) =>
      USE_FIXTURES
        ? delay({ sentTo: email, resendAvailableInSeconds: 60 })
        : request<CodeSentDto>('/api/auth/password-reset/request', {
            method: 'POST',
            body: JSON.stringify({ email }),
          }),
    /** Completing a reset also verifies the email and signs the user in (same session shape as login). */
    confirmPasswordReset: (email: string, code: string, newPassword: string) =>
      USE_FIXTURES
        ? delay(fixtureSession(email))
        : request<SessionDto>('/api/auth/password-reset/confirm', {
            method: 'POST',
            body: JSON.stringify({ email, code, newPassword }),
          }).then((dto) => toSession(dto, email)),
    /** The caller's contact number and whether it has been SMS-verified (settings "Contact number"). */
    getProfile: () =>
      USE_FIXTURES
        ? delay({ contactNumber: '+63 917 000 0000' as string | null, phoneVerified: false })
        : request<{ contactNumber: string | null; phoneVerified: boolean }>('/api/auth/profile'),
    /** The one-time "complete your profile" step (see ProfileCompletionGate). */
    completeProfile: (contactNumber: string, phone?: PhoneProof) =>
      USE_FIXTURES
        ? delay({ profileCompleted: true })
        : request<{ profileCompleted: boolean }>('/api/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ contactNumber, ...phone }),
          }),
  },
};
