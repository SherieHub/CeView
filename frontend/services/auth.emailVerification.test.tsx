import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth';
import { EMAIL_NOT_VERIFIED_EVENT } from './authEvents';
import { loadTokens, saveTokens } from './authStorage';
import { callsTo, json, stubBackend } from '../components/auth/authTestUtils';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider — email verification', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('register stores an unverified session along with the email', async () => {
    stubBackend({
      'POST /api/auth/register': () =>
        json({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true, emailVerified: false }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.register('a@b.com', 'Passw0rd1', 'Ana', 'Cruz', '0917');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.emailVerified).toBe(false);
    expect(result.current.user?.email).toBe('a@b.com');
    expect(loadTokens()).toMatchObject({ accessToken: 'jwt-1', emailVerified: false, email: 'a@b.com' });
  });

  it('login of a verified operator reports emailVerified true', async () => {
    stubBackend({
      'POST /api/auth/login': () =>
        json({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true, emailVerified: true }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('a@b.com', 'pw');
    });

    expect(result.current.emailVerified).toBe(true);
  });

  it('a Google session has no email in the response, so none is stored', async () => {
    stubBackend({
      'POST /api/auth/google': () =>
        json({ token: 'jwt-g', operatorId: 'op-g', profileCompleted: false, emailVerified: true }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithGoogle('id-token', 'login');
    });

    expect(loadTokens()?.email).toBeUndefined();
  });

  it('hydrates emailVerified and the email from storage on first render', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false, email: 'a@b.com' });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.emailVerified).toBe(false);
    expect(result.current.user?.email).toBe('a@b.com');
  });

  it('treats a session stored before verification shipped as unknown (null), not unverified', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.emailVerified).toBeNull();
  });

  it('markEmailVerified flips the flag and persists it', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.markEmailVerified());

    expect(result.current.emailVerified).toBe(true);
    expect(loadTokens()?.emailVerified).toBe(true);
  });

  it('updateEmail changes the stored and in-memory address', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false, email: 'typo@b.com' });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.updateEmail('right@b.com'));

    expect(result.current.user?.email).toBe('right@b.com');
    expect(loadTokens()?.email).toBe('right@b.com');
  });

  it('flips to unverified, and persists it, when the backend answers EMAIL_NOT_VERIFIED', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      window.dispatchEvent(new Event(EMAIL_NOT_VERIFIED_EVENT));
    });

    expect(result.current.emailVerified).toBe(false);
    expect(loadTokens()?.emailVerified).toBe(false);
  });

  it('stops listening once unmounted', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true });
    const { result, unmount } = renderHook(() => useAuth(), { wrapper });
    unmount();

    window.dispatchEvent(new Event(EMAIL_NOT_VERIFIED_EVENT));

    expect(result.current.emailVerified).toBeNull();
    expect(loadTokens()?.emailVerified).toBeUndefined();
  });

  it('completePasswordReset signs in with a verified session', async () => {
    const fetchMock = stubBackend({
      'POST /api/auth/password-reset/confirm': () =>
        json({ token: 'jwt-r', operatorId: 'op-r', profileCompleted: true, emailVerified: true }),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.completePasswordReset('a@b.com', '123456', 'NewPass123');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.emailVerified).toBe(true);
    expect(callsTo(fetchMock, 'POST /api/auth/password-reset/confirm')).toEqual([
      { email: 'a@b.com', code: '123456', newPassword: 'NewPass123' },
    ]);
  });

  it('logout clears the verification state too', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: true });
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.emailVerified).toBeNull();
    expect(loadTokens()).toBeNull();
  });
});
