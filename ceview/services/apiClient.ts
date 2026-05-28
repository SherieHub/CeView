/**
 * Thin fetch wrapper for the CeView backend. Errors thrown by `req<T>()` are
 * always instances of {@link ApiError} so callers can read `code` and
 * `traceId` for log correlation with the Spring Boot / FastAPI backends.
 */

import type {
  Market, Notification, ContentResponseDTO, ComplianceResultDTO, CreativeDirectionDTO,
  MetricsResponse, PesResponse, PrescriptiveReport, ManualIngestResponse,
} from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
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
  loadProfile: (operatorId: string) =>
    req<BusinessProfileDTO>(`/api/v1/business-profile?operatorId=${encodeURIComponent(operatorId)}`),

  saveProfile: (operatorId: string, body: BusinessProfileDTO) =>
    req<BusinessProfileDTO>(`/api/v1/business-profile?operatorId=${encodeURIComponent(operatorId)}`, {
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

  evaluateCompliance: (body: {
    caption: string; market: string; mediaName?: string; mediaSize?: number;
  }) => req<ComplianceResultDTO>('/api/v1/compliance/evaluate-json', {
    method: 'POST', body: JSON.stringify(body),
  }),

  /** Full multimodal compliance pipeline — FR3.20-FR3.30 (Submodule 3.3).
   *  Pass profileId to auto-inject approved captions (3.1) and creative context (3.2).
   *  Returns sub-scores (casScore, vasScore, omcsScore) and explainable AI outputs. */
  evaluateComplianceFull: (body: {
    caption: string; market: string; mediaName?: string; mediaSize?: number;
  }, profileId?: string) =>
    req<ComplianceResultDTO>(
      `/api/v1/compliance/evaluate-full-json${profileId ? `?profileId=${encodeURIComponent(profileId)}` : ''}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

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
   * Generate the prescriptive performance report (exhaustive funnel diagnostics schema).
   * @param weeks  Analysis window forwarded to Spring Boot for metric scaling.
   */
  prescriptiveReport: (weeks: 4 | 8 = 4) =>
    req<PrescriptiveReport>('/api/v1/analytics/report', {
      method: 'POST',
      body: JSON.stringify({ weeks }),
    }),
};
