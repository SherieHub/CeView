/**
 * The public demo's safety boundary: while it is active, apiClient answers
 * from the demo API or refuses — it never calls fetch, and so never sends a
 * signed-in visitor's token. Outside the demo nothing changes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';
import { activateDemo, deactivateDemo, isDemoActive } from './demoMode';
import type { DemoApi } from './demoMode';
import { attributionEnquiries } from './attributionEnquiries';
import { ApiError } from './apiError';

const fetchSpy = vi.fn(() => Promise.resolve(new Response(JSON.stringify([]), { status: 200 })));

beforeEach(() => {
  fetchSpy.mockClear();
  vi.stubGlobal('fetch', fetchSpy);
  localStorage.setItem('ceview.auth', JSON.stringify({ accessToken: 'real-operator-token' }));
});

afterEach(() => {
  deactivateDemo();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('demo mode', () => {
  it('answers from the demo API and never touches the network', async () => {
    const api = { posts: { list: () => Promise.resolve(['sample']) } } as unknown as DemoApi;
    activateDemo(api);

    await expect(apiClient.posts.list()).resolves.toEqual(['sample']);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses anything the demo does not provide — sign-in calls included', async () => {
    activateDemo({} as DemoApi);

    for (const call of [
      () => apiClient.businessProfile.load(),
      () => apiClient.workspace.invite('a@b.c', 'Editor'),
      () => apiClient.adConnections.authorize('meta'),
      () => apiClient.auth.getProfile(),
    ]) {
      const error = await call().then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe('DEMO_UNAVAILABLE');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps a signed-in visitor’s own enquiries out of the demo', async () => {
    activateDemo({} as DemoApi);
    await expect(attributionEnquiries.list()).resolves.toEqual([]);
    await expect(attributionEnquiries.submit({} as never)).rejects.toBeInstanceOf(ApiError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('only the activation that is ending can switch the demo off', () => {
    const first = {} as DemoApi;
    const second = {} as DemoApi;
    activateDemo(first);
    activateDemo(second);
    deactivateDemo(first);
    expect(isDemoActive()).toBe(true);
    deactivateDemo(second);
    expect(isDemoActive()).toBe(false);
  });

  it('outside the demo, calls go to the backend as before', async () => {
    // (The test env runs apiClient on fixtures, so check a call that always
    // reaches the network.)
    await attributionEnquiries.submit({} as never).catch(() => undefined);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
