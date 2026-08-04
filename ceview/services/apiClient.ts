/**
 * Thin fetch wrapper for the CeView backend. Errors thrown by `req<T>()` are
 * always instances of {@link ApiError} so callers can read `code` and
 * `traceId` for log correlation with the Spring Boot / FastAPI backends.
 */

import type {
  Market, Notification, ContentResponseDTO, CreativeDirectionDTO,
  MetricsResponse, PesResponse, PrescriptiveReport, ManualIngestResponse,
  CampaignHistoryResponse, OmcsAuditResultDTO, PesAnalysisReport,
} from '../types';

import { TOKEN_KEY } from './authStorage';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

let unauthorizedHandler: (() => void) | null = null;

/**
 * Registered once by AuthProvider on mount so that a 401 response from any
 * authenticated request (expired/invalid token) can trigger a logout /
 * redirect back to the login screen, without apiClient.ts needing to import
 * React or call useAuth() directly.
 */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

export class ApiError extends Error {
  readonly code: string;
  readonly traceId: string | null;
  readonly status: number;
  constructor(opts: { code: string; traceId: string | null; status: number; message: string }) {
    super(opts.message);
    this.name = 'ApiError';
    this.code = opts.code;
    this.traceId = opts.traceId;
    this.status = opts.status;
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch (e) {
    throw new ApiError({
      code: 'CLIENT_NETWORK_FAIL',
      traceId: null,
      status: 0,
      message: `Backend unreachable: ${(e as Error).message}`,
    });
  }

  if (!res.ok) {
    if (res.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const traceHeader = res.headers.get('X-Trace-Id');
    const raw = await res.text();
    let parsed: any = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* not JSON */ }
    throw new ApiError({
      code: parsed?.code ?? `HTTP_${res.status}`,
      traceId: parsed?.traceId ?? traceHeader ?? null,
      status: res.status,
      message: parsed?.message ?? parsed?.error ?? `${res.status} ${res.statusText}${raw ? ': ' + raw : ''}`,
    });
  }
  return res.json() as Promise<T>;
}

// ── Module 1 ────────────────────────────────────────────────────────────────
export interface CategoryAllocation { name: string; percentage: number }
export interface UniquenessResultDTO {
  overallScore: number;
  semanticsScore: number;
  categoryScore: number;
}

/** Mirrors backend BusinessProfileDto (com.ceview.module1.dto). */
export interface BusinessProfileDTO {
  businessProfileId: string | null;
  businessName: string;
  categories: string[];
  coreServices: string[];
  description: string;
  uvp: string;
  imagePreview: string | null;
  uniquenessScore: number | null;
}

export const api = {
  loadProfile: () =>
    req<BusinessProfileDTO>('/api/v1/business-profile'),

  saveProfile: (body: BusinessProfileDTO) =>
    req<BusinessProfileDTO>('/api/v1/business-profile', {
      method: 'PUT', body: JSON.stringify(body),
    }),

  classifyAnalyze: (body: {
    businessName: string; coreServices: string[]; description: string; uvp: string;
  }) => req<{ categories: CategoryAllocation[] }>('/api/v1/classification/analyze', {
    method: 'POST', body: JSON.stringify(body),
  }),

  classifyUniqueness: (body: {
    businessProfileId?: string; businessName: string; categories: string[]; coreServices: string[]; description: string; uvp: string;
  }) => req<UniquenessResultDTO>('/api/v1/classification/uniqueness', {
    method: 'POST', body: JSON.stringify(body),
  }),

  // ── Module 2 ──────────────────────────────────────────────────────────────
  listMarkets: (profileId?: string | null) => {
    const qs = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    return req<{ markets: Market[] }>(`/api/v1/forecasting/markets${qs}`);
  },

  analyzeMarkets: (profileId: string) =>
    req<{ markets: Market[] }>(`/api/v1/forecasting/analyze/${encodeURIComponent(profileId)}`, {
      method: 'POST', body: '{}',
    }),

  /**
   * Home-view live forecast. Runs the pipeline only when the profile's newest
   * forecast is missing or older than maxAgeHours; otherwise returns cached rows.
   * Side effect: writes fresh demand-alert rows that listNotifications then reads.
   */
  ensureForecast: (profileId: string, maxAgeHours?: number) =>
    req<{ markets: Market[] }>(
      `/api/v1/forecasting/ensure/${encodeURIComponent(profileId)}${maxAgeHours != null ? `?maxAgeHours=${maxAgeHours}` : ''}`,
      { method: 'POST', body: '{}' },
    ),

  listNotifications: (profileId?: string | null) => {
    const qs = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    return req<{ notifications: Notification[] }>(`/api/v1/notifications${qs}`);
  },

  // ── Module 3.1 — Content Generation ─────────────────────────────────────
  generateContent: (body: {
    market: string; businessName: string; description: string;
    categories: string[]; trend: string;
  }, profileId?: string | null) =>
    req<ContentResponseDTO>(
      `/api/v1/content/generate${profileId ? `?profileId=${encodeURIComponent(profileId)}` : ''}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  /** FR3.10 / UC-3.1 step 14 — approve generated content for a market. */
  approveContent: (profileId: string, market: string) =>
    req<{ approvedIds: string[]; market: string; count: number }>(
      `/api/v1/content/approve?profileId=${encodeURIComponent(profileId)}`,
      { method: 'POST', body: JSON.stringify({ market }) },
    ),

  // ── Module 3.2 — Creative Direction ──────────────────────────────────────
  /** FR3.11-FR3.16, FR3.19 — generate creative direction (requires approved content). */
  generateCreative: (profileId: string, market?: string) =>
    req<CreativeDirectionDTO>(
      `/api/v1/creative-direction/generate/${encodeURIComponent(profileId)}${market ? `?market=${encodeURIComponent(market)}` : ''}`,
      { method: 'POST', body: '{}' },
    ),

  /** FR3.19 / UC-3.2 step 11 — approve the latest creative direction output. */
  approveCreative: (profileId: string, market: string) =>
    req<{ approvedId: string; market: string }>(
      `/api/v1/creative-direction/approve/${encodeURIComponent(profileId)}?market=${encodeURIComponent(market)}`,
      { method: 'POST', body: '{}' },
    ),

  /** Submodule 3.3 — OMCS compliance audit via the LangGraph omcs_agent.
   *  Scores the chosen caption + image against the visual-guide recommendations.
   *  imageUrl is a data: URL (base64) or public http(s) URL. */
  analyzeOmcs: (body: {
    caption: string;
    imageUrl: string;
    businessProfile: Record<string, unknown>;
    recommendations: Record<string, unknown>;
  }) => req<OmcsAuditResultDTO>('/api/v1/compliance/omcs-analyze', {
    method: 'POST', body: JSON.stringify(body),
  }),

  // ── Module 4 ──────────────────────────────────────────────────────────────

  /**
   * Default campaign metrics for the EngagementMetricsBoard.
   * @param weeks Analysis window — 4 (default) or 8. Backend scales demo defaults.
   */
  analyticsMetrics: (weeks: 4 | 8 = 4) =>
    req<MetricsResponse>(`/api/v1/analytics/metrics?weeks=${weeks}`),

  /**
   * Compute metrics from operator-entered raw campaign values.
   */
  analyticsManual: (body: {
    impressions: number; clicks: number; adSpend: number; revenue: number;
    conversions: number; bookings: number; newCustomers: number;
  }) => req<ManualIngestResponse>('/api/v1/analytics/manual', {
    method: 'POST', body: JSON.stringify(body),
  }),

  /**
   * Promotional Effectiveness Score breakdown for a campaign.
   * @param campaignId Any campaign identifier (stub — wired to default metrics).
   * @param weeks      Analysis window passed to metric computation.
   */
  analyticsPes: (campaignId: string = 'default', weeks: 4 | 8 = 4) =>
    req<PesResponse>(`/api/v1/analytics/pes/${encodeURIComponent(campaignId)}?weeks=${weeks}`),

  /**
   * Weekly PES trend — returns the N most recent campaign records in chronological
   * order for the trend line chart. N = weeks (4 or 8).
   */
  analyticsHistory: (weeks: 4 | 8 = 4) =>
    req<CampaignHistoryResponse>(`/api/v1/analytics/history?weeks=${weeks}`),

  /**
   * Generate the prescriptive performance report (exhaustive funnel diagnostics schema).
   * @param weeks  Analysis window forwarded to Spring Boot for metric scaling.
   */
  prescriptiveReport: (weeks: 4 | 8 = 4) =>
    req<PrescriptiveReport>('/api/v1/analytics/report', {
      method: 'POST',
      body: JSON.stringify({ weeks }),
    }),

  /**
   * PES time-series deep-analysis (pes_report_agent).
   * @param weeks       Analysis window (4 or 8).
   * @param metricsData Per-KPI weekly arrays (index 0 = most recent week), keyed
   *                    CTR/CPC/ROAS/CR/CAC. Built by the frontend from campaign
   *                    history. When omitted, Spring Boot synthesizes a series.
   */
  pesAnalysis: (weeks: 4 | 8 = 4, metricsData?: Record<string, number[]>) =>
    req<PesAnalysisReport>('/api/v1/analytics/pes-analysis', {
      method: 'POST',
      body: JSON.stringify(
        metricsData ? { weeks, metrics_data: metricsData } : { weeks },
      ),
    }),
};
