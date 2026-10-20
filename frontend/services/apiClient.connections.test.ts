/**
 * Covers the publishing `connections` endpoint group (/api/social-connections): paths, methods,
 * bodies and the DTO -> PlatformConnection mapping. The fetch layer itself is covered by
 * apiClient.auth.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';

const fetchMock = vi.fn();

const DTOS = [
  { platform: 'facebook', configured: true, status: 'ACTIVE', handle: 'Cebu Dive Co.', connectedAt: '2026-05-01T00:00:00Z' },
  { platform: 'instagram', configured: true, status: 'NEEDS_PAGE', handle: null, connectedAt: null },
  { platform: 'tiktok', configured: false, status: 'DISCONNECTED', handle: null, connectedAt: null },
];

const MAPPED = [
  { platform: 'facebook', connected: true, handle: 'Cebu Dive Co.', connectedAt: '2026-05-01T00:00:00Z', status: 'ACTIVE', configured: true },
  { platform: 'instagram', connected: false, handle: null, connectedAt: null, status: 'NEEDS_PAGE', configured: true },
  { platform: 'tiktok', connected: false, handle: null, connectedAt: null, status: 'DISCONNECTED', configured: false },
];

function respondWith(body: unknown) {
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => body });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  respondWith({});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calledPath(): string {
  return String(fetchMock.mock.calls[0][0]);
}

function calledInit(): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

describe('apiClient.connections', () => {
  it('lists /api/social-connections and maps each DTO to a PlatformConnection', async () => {
    respondWith(DTOS);
    const result = await apiClient.connections.list();
    expect(calledPath()).toContain('/api/social-connections');
    expect(result).toEqual(MAPPED);
  });

  it('posts to the TikTok authorize endpoint and returns the body', async () => {
    respondWith({ authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/?x=1' });
    const result = await apiClient.connections.tiktokAuthorize();
    expect(calledPath()).toContain('/api/social-connections/tiktok/authorize');
    expect(calledInit().method).toBe('POST');
    expect(result).toEqual({ authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/?x=1' });
  });

  it('posts {code,state} to the TikTok complete endpoint and maps the returned list', async () => {
    respondWith(DTOS);
    const result = await apiClient.connections.tiktokComplete('the-code', 'the-state');
    expect(calledPath()).toContain('/api/social-connections/tiktok/complete');
    expect(calledInit().method).toBe('POST');
    expect(JSON.parse(String(calledInit().body))).toEqual({ code: 'the-code', state: 'the-state' });
    expect(result).toEqual(MAPPED);
  });

  it('lists the Facebook Pages the Meta login administers', async () => {
    const pages = [{ id: '111', name: 'Cebu Dive Co.', instagramUsername: 'cebu.dive' }];
    respondWith(pages);
    const result = await apiClient.connections.metaPages();
    expect(calledPath()).toContain('/api/social-connections/meta/pages');
    expect(result).toEqual(pages);
  });

  it('PUTs the chosen page id and maps the returned list', async () => {
    respondWith(DTOS);
    const result = await apiClient.connections.selectMetaPage('111');
    expect(calledPath()).toContain('/api/social-connections/meta/page');
    expect(calledInit().method).toBe('PUT');
    expect(String(calledInit().body)).toBe(JSON.stringify({ pageId: '111' }));
    expect(result).toEqual(MAPPED);
  });

  it('DELETEs a platform connection', async () => {
    await apiClient.connections.disconnect('facebook');
    expect(calledPath()).toContain('/api/social-connections/facebook');
    expect(calledInit().method).toBe('DELETE');
  });
});
