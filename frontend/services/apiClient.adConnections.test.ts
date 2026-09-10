/**
 * Covers the adConnections endpoint group: paths, methods, and the fixture
 * branch. The fetch layer itself (auth header, error mapping) is already
 * covered by apiClient.auth.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({}),
  });
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

describe('apiClient.adConnections', () => {
  it('lists connections', async () => {
    await apiClient.adConnections.list();
    expect(calledPath()).toContain('/api/ad-connections');
  });

  it('posts to authorize for a provider', async () => {
    await apiClient.adConnections.authorize('meta');
    expect(calledPath()).toContain('/api/ad-connections/meta/authorize');
    expect(calledInit().method).toBe('POST');
  });

  it('lists the ad accounts a grant can see', async () => {
    await apiClient.adConnections.accounts('tiktok');
    expect(calledPath()).toContain('/api/ad-connections/tiktok/accounts');
  });

  it('posts the chosen account id', async () => {
    await apiClient.adConnections.selectAccount('meta', 'act_111111111');
    expect(calledPath()).toContain('/api/ad-connections/meta/account');
    expect(calledInit().method).toBe('POST');
    expect(String(calledInit().body)).toContain('act_111111111');
  });

  it('deletes a connection to disconnect it', async () => {
    await apiClient.adConnections.disconnect('meta');
    expect(calledPath()).toContain('/api/ad-connections/meta');
    expect(calledInit().method).toBe('DELETE');
  });

  it('requests insights for an explicit period', async () => {
    await apiClient.adConnections.insights('2026-08-31', '2026-09-06');
    expect(calledPath()).toContain('/api/ad-connections/insights');
    expect(calledPath()).toContain('periodStart=2026-08-31');
    expect(calledPath()).toContain('periodEnd=2026-09-06');
  });
});
