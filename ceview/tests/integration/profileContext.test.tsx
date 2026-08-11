import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../../services/auth';
import { ProfileProvider, useProfile } from '../../services/profileContext';
import { api } from '../../services/apiClient';

// Regression test for the ProfileProvider request-ordering race: since
// ProfileProvider lives above RouterProvider and persists across
// login/logout, a stale in-flight loadProfile() response from a previous
// operator must not be applied after a newer load() (triggered by a
// subsequent auth-state change) has already superseded it — otherwise a
// slow logout-then-login-as-someone-else sequence could resurrect the
// previous operator's profile data, breaking multi-tenant isolation.
vi.mock('../../services/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/apiClient')>();
  return { ...actual, api: { ...actual.api, loadProfile: vi.fn() } };
});

const mockedLoadProfile = api.loadProfile as unknown as ReturnType<typeof vi.fn>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

/** Exposes ProfileProvider + AuthProvider state/actions for the test to drive directly. */
const Probe: React.FC = () => {
  const { profile, isLoading } = useProfile();
  const { login, logout, isAuthenticated } = useAuth();
  (window as any).__auth = { login, logout, isAuthenticated };
  return (
    <div>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="profile-name">{profile?.businessName ?? '(none)'}</span>
    </div>
  );
};

describe('ProfileProvider request-ordering race guard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    mockedLoadProfile.mockReset();
  });

  it('discards a stale loadProfile() response from before a logout, instead of resurrecting the previous operator', async () => {
    const firstCall = deferred<any>();
    const secondCallProfile = { businessProfileId: 'bp-2', businessName: 'Operator B', categories: [], coreServices: [], description: '', uvp: '', imagePreview: null, uniquenessScore: null };

    let callCount = 0;
    mockedLoadProfile.mockImplementation(() => {
      callCount += 1;
      // First call (operator A, pre-logout) hangs until the test resolves it below.
      return callCount === 1 ? firstCall.promise : Promise.resolve(secondCallProfile);
    });

    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({ operatorId: 'op-A', token: 'tok-A' }),
      headers: { get: () => null },
    });

    render(
      <AuthProvider>
        <ProfileProvider>
          <Probe />
        </ProfileProvider>
      </AuthProvider>,
    );

    // Log in as operator A -> ProfileProvider fires loadProfile() call #1,
    // which is now hanging on firstCall.promise.
    await act(async () => {
      await (window as any).__auth.login('a@a.com', 'pw');
    });
    await waitFor(() => expect(screen.getByTestId('authed')).toHaveTextContent('true'));
    expect(callCount).toBe(1);

    // Log out while call #1 is still in flight — ProfileProvider's effect
    // re-runs synchronously and clears profile to null.
    await act(async () => {
      (window as any).__auth.logout();
    });
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
    expect(screen.getByTestId('profile-name')).toHaveTextContent('(none)');

    // Now let the stale call #1 response resolve, with operator A's data.
    await act(async () => {
      firstCall.resolve({ businessProfileId: 'bp-1', businessName: 'Operator A', categories: [], coreServices: [], description: '', uvp: '', imagePreview: null, uniquenessScore: 0.5 });
      await Promise.resolve();
    });

    // The bug: without the request-ordering guard, this stale response would
    // overwrite the just-cleared profile with Operator A's data even though
    // we're logged out. The fix: it must be discarded.
    expect(screen.getByTestId('profile-name')).toHaveTextContent('(none)');
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });
});
