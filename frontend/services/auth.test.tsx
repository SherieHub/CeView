import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth';
import { loadTokens } from './authStorage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

vi.stubEnv('VITE_USE_FIXTURES', 'false');

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

describe('AuthProvider — Google sign-in / profile completion', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loginWithGoogle stores the session and exposes profileCompleted from the response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: false }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithGoogle('firebase-id-token');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.profileCompleted).toBe(false);
    expect(loadTokens()?.accessToken).toBe('jwt-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/google'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ idToken: 'firebase-id-token' }) }),
    );
  });

  it('markProfileCompleted flips profileCompleted to true and persists it', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: false }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.loginWithGoogle('firebase-id-token');
    });

    act(() => {
      result.current.markProfileCompleted();
    });

    expect(result.current.profileCompleted).toBe(true);
    expect(loadTokens()?.profileCompleted).toBe(true);
  });

  it('login() carries profileCompleted from the response into context state', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-2', operatorId: 'op-2', profileCompleted: true }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('a@b.com', 'pw');
    });

    expect(result.current.profileCompleted).toBe(true);
  });
});
