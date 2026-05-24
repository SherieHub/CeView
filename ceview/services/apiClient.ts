/**
 * Thin fetch wrapper for the CeView backend. Base URL is fixed to localhost
 * during development; production deployment should override via env.
 */

import type { Market, Notification } from '../types';

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

export const api = {
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
  listMarkets: () =>
    req<{ markets: Market[] }>('/api/v1/forecasting/markets'),

  listNotifications: () =>
    req<{ notifications: Notification[] }>('/api/v1/notifications'),

  // ── Module 3 ──────────────────────────────────────────────────────────────
  generateContent: (body: {
    market: string; businessName: string; description: string;
    categories: string[]; trend: string;
  }) => req<any>('/api/v1/content/generate', {
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
