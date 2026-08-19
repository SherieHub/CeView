/**
 * Typed API client. When VITE_USE_FIXTURES=true (or the backend base URL is
 * unset), every method below resolves from the fixture modules in
 * services/fixtures/ instead of issuing a fetch — see
 * 01-foundation.md's "Fixture Data Layer" card. Real endpoints are added as
 * each screen card wires its backend.
 */
import { loadTokens } from './authStorage';
import { MOCK_MARKETS, CATEGORY_MARKET_SCORES, marketsForCategory } from './fixtures/markets';
import { MOCK_NOTIFICATIONS } from './fixtures/notifications';
import { MOCK_CONTENT } from './fixtures/content';
import { OMCS_RUBRIC_LABELS, MOCK_OMCS } from './fixtures/omcs';
import { DEFAULT_CAMPAIGN_INPUT, MOCK_HISTORY, MOCK_REPORT } from './fixtures/campaign';
import { MOCK_POSTS } from './fixtures/posts';
import { MOCK_MEMBERS } from './fixtures/members';
import type { WorkspaceMemberFixture } from './fixtures/members';
import type { PlatformConnection, PostMetric, BusinessProfileDto } from '../types';

const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

/** Simulated network delay so fixture-backed UI still exercises loading states. */
function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const tokens = loadTokens();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Request to ${path} failed with ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const MOCK_CONNECTIONS: PlatformConnection[] = [
  { platform: 'instagram', connected: true, handle: '@cebu.dive', connectedAt: '2026-05-01T00:00:00Z' },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null },
  { platform: 'facebook', connected: true, handle: 'Cebu Dive Co.', connectedAt: '2026-04-12T00:00:00Z' },
  { platform: 'naver', connected: false, handle: null, connectedAt: null },
];

const MOCK_POST_METRICS: PostMetric[] = MOCK_POSTS.map((p, i) => ({
  postId: p.id,
  impressions: 1200 + i * 340,
  engagements: 80 + i * 21,
  clicks: 14 + i * 3,
  engagementRate: Number((0.04 + i * 0.006).toFixed(3)),
}));

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
        : request<BusinessProfileDto>('/api/v1/business-profile'),
  },

  markets: {
    list: () => (USE_FIXTURES ? delay(MOCK_MARKETS) : request('/api/markets')),
    chartData: (marketId: string) =>
      USE_FIXTURES
        ? delay(MOCK_MARKETS.find((m) => m.id === marketId)?.chartData ?? [])
        : request(`/api/markets/${marketId}/chart`),
    categoryScores: () => (USE_FIXTURES ? delay(CATEGORY_MARKET_SCORES) : request('/api/markets/category-scores')),
    forCategory: (category: string) => (USE_FIXTURES ? delay(marketsForCategory(category)) : request(`/api/markets?category=${encodeURIComponent(category)}`)),
  },
  notifications: {
    list: () => (USE_FIXTURES ? delay(MOCK_NOTIFICATIONS) : request('/api/notifications')),
  },
  content: {
    list: () => (USE_FIXTURES ? delay(MOCK_CONTENT) : request('/api/content')),
  },
  omcs: {
    rubric: () => (USE_FIXTURES ? delay(OMCS_RUBRIC_LABELS) : request('/api/omcs/rubric')),
    evaluate: () => (USE_FIXTURES ? delay(MOCK_OMCS) : request('/api/omcs/evaluate', { method: 'POST' })),
  },
  campaign: {
    defaultInput: () => (USE_FIXTURES ? delay(DEFAULT_CAMPAIGN_INPUT) : request('/api/campaigns/default-input')),
    history: () => (USE_FIXTURES ? delay(MOCK_HISTORY) : request('/api/campaigns/history')),
    report: () => (USE_FIXTURES ? delay(MOCK_REPORT) : request('/api/campaigns/report')),
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
    invite: (email: string) =>
      USE_FIXTURES ? delay({ ok: true }) : request('/api/workspace/invite', { method: 'POST', body: JSON.stringify({ email }) }),
  },
  auth: {
    login: (email: string, password: string) =>
      USE_FIXTURES
        ? delay({ accessToken: 'mock-access-token-123', profileCompleted: true, user: { id: 'usr-1', email, businessName: null } })
        : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/v1/auth/login', {
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
        : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/v1/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, firstName, lastName, contactNumber }),
          }).then(({ token, operatorId, profileCompleted }) => ({
            accessToken: token,
            profileCompleted,
            user: { id: operatorId, email, businessName: null },
          })),
    /** Verifies a Firebase ID token server-side and mints the same session shape as login/register. */
    google: (idToken: string) =>
      USE_FIXTURES
        ? delay({ accessToken: 'mock-access-token-123', profileCompleted: false, user: { id: 'usr-1', email: null, businessName: null } })
        : request<{ token: string; operatorId: string; profileCompleted: boolean }>('/api/v1/auth/google', {
            method: 'POST',
            body: JSON.stringify({ idToken }),
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
        : request<{ profileCompleted: boolean }>('/api/v1/auth/profile', {
            method: 'PATCH',
            body: JSON.stringify({ contactNumber }),
          }),
  },
};
