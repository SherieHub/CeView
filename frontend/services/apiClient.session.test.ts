import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './apiClient';
import { saveTokens } from './authStorage';
import { SESSION_REJECTED_EVENT } from './authEvents';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

describe('API session rejection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['profile', 'media', 'account'] as const)('reports a rejected session for %s requests', async (kind) => {
    saveTokens({ accessToken: 'rejected-token' });
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 401 }));
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    const request = kind === 'profile' ? apiClient.businessProfile.load()
      : kind === 'media' ? apiClient.media.content('media-id') : apiClient.auth.getProfile();
    await expect(request).rejects.toMatchObject({ status: 401 });

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: SESSION_REJECTED_EVENT, detail: 'rejected-token',
    }));
  });

  it('keeps invalid login credentials as a form error', async () => {
    saveTokens({ accessToken: 'existing-session' });
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 401 }));
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    await expect(apiClient.auth.login('operator@example.com', 'wrong')).rejects.toMatchObject({ status: 401 });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not reject a session on a server failure', async () => {
    saveTokens({ accessToken: 'valid-token' });
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 500 }));
    const dispatch = vi.spyOn(window, 'dispatchEvent');

    await expect(apiClient.businessProfile.load()).rejects.toMatchObject({ status: 500 });

    expect(dispatch).not.toHaveBeenCalled();
  });
});
