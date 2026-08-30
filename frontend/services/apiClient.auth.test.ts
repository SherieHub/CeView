import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

// Real-fetch mode (not fixtures) — covers apiClient.auth.* against the
// actual Spring Boot response shape ({ token, operatorId, profileCompleted }),
// including the newer Google sign-in and complete-profile endpoints.
vi.stubEnv('VITE_USE_FIXTURES', 'false');

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('apiClient.auth (real-fetch mode)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to the backend origin when VITE_API_BASE_URL is set but blank (e.g. an empty .env line)', async () => {
    // A .env line like "VITE_API_BASE_URL=" gives import.meta.env.VITE_API_BASE_URL
    // the value "" (present, not undefined) — `??` doesn't fall back on that, so this
    // regression-tests the real bug: requests silently going relative to the frontend's
    // own origin (http://localhost:3001/api/...) instead of the backend (:8080).
    vi.stubEnv('VITE_API_BASE_URL', '');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: false }),
    );
    const { apiClient } = await import('./apiClient');

    await apiClient.auth.login('a@b.com', 'pw');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/login',
      expect.anything(),
    );
  });

  it('login() maps {token, operatorId, profileCompleted} to {accessToken, profileCompleted, user}', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: false }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.login('a@b.com', 'pw');

    expect(res).toEqual({
      accessToken: 'jwt-1',
      profileCompleted: false,
      user: { id: 'op-1', email: 'a@b.com', businessName: null },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'pw' }) }),
    );
  });

  it('register() sends contactNumber and maps the response the same way as login', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-2', operatorId: 'op-2', profileCompleted: true }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.register('a@b.com', 'pw', 'Ana', 'Cruz', '09171234567');

    expect(res).toEqual({
      accessToken: 'jwt-2',
      profileCompleted: true,
      user: { id: 'op-2', email: 'a@b.com', businessName: null },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'pw', firstName: 'Ana', lastName: 'Cruz', contactNumber: '09171234567' }),
      }),
    );
  });

  it('google() posts the Firebase ID token and maps the response like login/register', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-3', operatorId: 'op-3', profileCompleted: false }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.google('firebase-id-token');

    expect(res).toEqual({
      accessToken: 'jwt-3',
      profileCompleted: false,
      user: { id: 'op-3', email: null, businessName: null },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/google'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ idToken: 'firebase-id-token' }) }),
    );
  });

  it('completeProfile() PATCHes the contact number and resolves profileCompleted: true', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(jsonResponse({ profileCompleted: true }));
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.completeProfile('09171234567');

    expect(res).toEqual({ profileCompleted: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/profile'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ contactNumber: '09171234567' }) }),
    );
  });
});
