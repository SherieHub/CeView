import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './auth';
import { TOKEN_KEY, OPERATOR_ID_KEY, PROFILE_COMPLETED_KEY } from './authStorage';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

describe('AuthProvider — Google sign-in / profile completion', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loginWithGoogle stores the session and reports profileCompleted from the response', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ operatorId: 'op-1', token: 'jwt-1', profileCompleted: false }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginWithGoogle('firebase-id-token');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.profileCompleted).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('jwt-1');
    expect(localStorage.getItem(OPERATOR_ID_KEY)).toBe('op-1');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/auth/google'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ idToken: 'firebase-id-token' }) }),
    );
  });

  it('markProfileCompleted flips profileCompleted to true and persists it', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ operatorId: 'op-1', token: 'jwt-1', profileCompleted: false }),
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.loginWithGoogle('firebase-id-token');
    });

    act(() => {
      result.current.markProfileCompleted();
    });

    expect(result.current.profileCompleted).toBe(true);
    expect(localStorage.getItem(PROFILE_COMPLETED_KEY)).toBe('true');
  });

  it('login() rejects a response missing profileCompleted as a bad response shape', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ operatorId: 'op-1', token: 'jwt-1' }), // profileCompleted omitted
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      act(async () => {
        await result.current.login('a@b.com', 'pw');
      }),
    ).rejects.toThrow();
    expect(result.current.isAuthenticated).toBe(false);
  });
});
