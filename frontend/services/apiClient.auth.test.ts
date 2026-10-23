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
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: false, emailVerified: true }),
    );
    const { apiClient } = await import('./apiClient');

    await apiClient.auth.login('a@b.com', 'pw');

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8080/api/auth/login',
      expect.anything(),
    );
  });

  it('login() maps {token, operatorId, profileCompleted, emailVerified} to {accessToken, profileCompleted, emailVerified, user}', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: false }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.login('a@b.com', 'pw');

    expect(res).toEqual({
      accessToken: 'jwt-1',
      profileCompleted: false,
      emailVerified: true,
      user: { id: 'op-1', email: 'a@b.com', businessName: null },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'pw' }) }),
    );
  });

  it('register() sends contactNumber and maps the response the same way as login', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-2', operatorId: 'op-2', profileCompleted: true, emailVerified: false }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.register('a@b.com', 'pw', 'Ana', 'Cruz', '09171234567');

    expect(res).toEqual({
      accessToken: 'jwt-2',
      profileCompleted: true,
      emailVerified: false,
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
      jsonResponse({ token: 'jwt-3', operatorId: 'op-3', profileCompleted: false, emailVerified: true }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.google('firebase-id-token', 'login');

    expect(res).toEqual({
      accessToken: 'jwt-3',
      profileCompleted: false,
      emailVerified: true,
      user: { id: 'op-3', email: null, businessName: null },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/google'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ idToken: 'firebase-id-token', intent: 'login' }) }),
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

  it('treats a response without emailVerified (an older backend) as verified, so nobody is locked out', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-old', operatorId: 'op-old', profileCompleted: true }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.login('a@b.com', 'pw');

    expect(res.emailVerified).toBe(true);
  });

  it('sendVerificationCode() POSTs with the stored bearer token and resolves {sentTo, resendAvailableInSeconds}', async () => {
    localStorage.setItem('ceview.auth', JSON.stringify({ accessToken: 'jwt-x', profileCompleted: true }));
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ sentTo: 'a@b.com', resendAvailableInSeconds: 60 }, 202),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.sendVerificationCode();

    expect(res).toEqual({ sentTo: 'a@b.com', resendAvailableInSeconds: 60 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/email-verification/send'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt-x' }),
      }),
    );
    localStorage.clear();
  });

  it('verifyEmail() POSTs the code', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(jsonResponse({ emailVerified: true }));
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.verifyEmail('123456');

    expect(res).toEqual({ emailVerified: true });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/email-verification/verify'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ code: '123456' }) }),
    );
  });

  it('changeEmail() PATCHes the new address', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(jsonResponse({ email: 'new@b.com' }));
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.changeEmail('new@b.com');

    expect(res).toEqual({ email: 'new@b.com' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/email'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ email: 'new@b.com' }) }),
    );
  });

  it('requestPasswordReset() POSTs the email', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ sentTo: 'a@b.com', resendAvailableInSeconds: 60 }, 202),
    );
    const { apiClient } = await import('./apiClient');

    await apiClient.auth.requestPasswordReset('a@b.com');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/password-reset/request'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'a@b.com' }) }),
    );
  });

  it('confirmPasswordReset() sends email, code and new password and maps the session like login', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-r', operatorId: 'op-r', profileCompleted: true, emailVerified: true }),
    );
    const { apiClient } = await import('./apiClient');

    const res = await apiClient.auth.confirmPasswordReset('a@b.com', '123456', 'NewPass123');

    expect(res).toEqual({
      accessToken: 'jwt-r',
      profileCompleted: true,
      emailVerified: true,
      user: { id: 'op-r', email: 'a@b.com', businessName: null },
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/password-reset/confirm'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', code: '123456', newPassword: 'NewPass123' }),
      }),
    );
  });

  it('surfaces the backend code and extra fields on an ApiError', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ error: 'That code is not correct.', code: 'INVALID_CODE', attemptsRemaining: 3 }, 400),
    );
    const { apiClient } = await import('./apiClient');

    await expect(apiClient.auth.verifyEmail('000000')).rejects.toMatchObject({
      status: 400,
      code: 'INVALID_CODE',
      body: expect.objectContaining({ attemptsRemaining: 3 }),
    });
  });

  it('dispatches ceview:email-not-verified when the backend answers 403 EMAIL_NOT_VERIFIED', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ error: 'email not verified', code: 'EMAIL_NOT_VERIFIED' }, 403),
    );
    const { apiClient } = await import('./apiClient');
    const { EMAIL_NOT_VERIFIED_EVENT } = await import('./authEvents');
    const listener = vi.fn();
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, listener);

    await expect(apiClient.auth.completeProfile('0917')).rejects.toMatchObject({ status: 403 });

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, listener);
  });

  it('does not dispatch the event for other 403s', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ error: 'profile incomplete', code: 'PROFILE_INCOMPLETE' }, 403),
    );
    const { apiClient } = await import('./apiClient');
    const { EMAIL_NOT_VERIFIED_EVENT } = await import('./authEvents');
    const listener = vi.fn();
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, listener);

    await expect(apiClient.auth.completeProfile('0917')).rejects.toMatchObject({ status: 403 });

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, listener);
  });
});
