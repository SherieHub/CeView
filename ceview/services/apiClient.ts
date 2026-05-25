/**
 * Thin fetch wrapper for the CeView backend. Base URL is fixed to localhost
 * during development; production deployment should override via env.
 */

import type { Market, Notification, ContentResponseDTO, ComplianceResultDTO, CreativeDirectionDTO } from '../types';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Module 1 ────────────────────────────────────────────────────────────────
export interface CategoryAllocation { name: string; percentage: number }
export interface UniquenessResultDTO {
  overallScore: number;
  semanticsScore: number;
  categoryScore: number;
  descriptionFeedback: string;
  categoryFeedback: string;
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
    businessName: string; categories: string[]; coreServices: string[]; description: string; uvp: string;
  }) => req<UniquenessResultDTO>('/api/v1/classification/uniqueness', {
    method: 'POST', body: JSON.stringify(body),
  }),

  generateKeywords: (body: { businessName: string; description: string; category: string }) =>
    req<string[]>('/api/v1/business-profile/keywords', {
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

  listNotifications: () =>
    req<{ notifications: Notification[] }>('/api/v1/notifications'),

  // ── Module 3 ──────────────────────────────────────────────────────────────
  generateContent: (body: {
    market: string; businessName: string; description: string;
    categories: string[]; trend: string;
  }) => req<ContentResponseDTO>('/api/v1/content/generate', {
    method: 'POST', body: JSON.stringify(body),
  }),

  generateCreative: (profileId: string, body?: Record<string, unknown>) =>
    req<CreativeDirectionDTO>(`/api/v1/creative-direction/generate/${encodeURIComponent(profileId)}`, {
      method: 'POST', body: JSON.stringify(body ?? {}),
    }),

  evaluateCompliance: (body: {
    caption: string; market: string; mediaName?: string; mediaSize?: number;
  }) => req<ComplianceResultDTO>('/api/v1/compliance/evaluate-json', {
    method: 'POST', body: JSON.stringify(body),
  }),

  // ── Module 4 ──────────────────────────────────────────────────────────────
  analyticsMetrics: () =>
    req<{ metrics: any; funnel: any[] }>('/api/v1/analytics/metrics'),

  analyticsManual: (body: {
    impressions: number; clicks: number; adSpend: number; revenue: number;
    conversions: number; bookings: number; newCustomers: number;
  }) => req<{ metrics: any; funnel: any[] }>('/api/v1/analytics/manual', {
    method: 'POST', body: JSON.stringify(body),
  }),

  prescriptiveReport: () =>
    req<{
      executiveSummary: string;
      lowestMetric: string;
      lowestMetricMeaning: string;
      recommendations: string[];
      otherAreasImprove: string[];
      weakestStage: { name: string; dropoff: string; diagnosis: string };
      secondaryLeaks: { name: string; dropoff: string; diagnosis?: string }[];
    }>('/api/v1/analytics/report', { method: 'POST', body: '{}' }),
};
