import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthGate, { RedirectIfAuthenticated } from './AuthGate';
import { AuthProvider } from '../../services/auth';
import { loadTokens, saveTokens } from '../../services/authStorage';
import { ProfileGate, ProfileProvider } from '../../services/profileContext';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

function renderAt(path: string) {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/" element={<RedirectIfAuthenticated><div>Landing page</div></RedirectIfAuthenticated>} />
            <Route path="/login" element={<RedirectIfAuthenticated><div>Login page</div></RedirectIfAuthenticated>} />
            <Route element={<AuthGate />}>
              <Route element={<ProfileGate />}>
                <Route path="/dashboard" element={<div>Dashboard</div>} />
                <Route path="/onboarding" element={<div>Onboarding</div>} />
              </Route>
            </Route>
          </Routes>
        </MemoryRouter>
      </ProfileProvider>
    </AuthProvider>,
  );
}

describe('AuthGate', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each(['/', '/dashboard', '/onboarding'])('shows the landing page at %s without a session', (path) => {
    renderAt(path);
    expect(screen.getByText('Landing page')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['{}', 'null', '{"accessToken":""}', '{"accessToken":123}', 'invalid-json'])(
    'treats unusable stored session %s as signed out', (stored) => {
      localStorage.setItem('ceview.auth', stored);
      renderAt('/onboarding');
      expect(screen.getByText('Landing page')).toBeInTheDocument();
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it('keeps login accessible to signed-out visitors', () => {
    renderAt('/login');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('returns a backend-rejected session to the landing page and clears its storage', async () => {
    saveTokens({ accessToken: 'expired-token', profileCompleted: true, emailVerified: true });
    localStorage.setItem('ceview.forecast.old-profile', '{}');
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 401 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderAt('/dashboard');

    expect(await screen.findByText('Landing page')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding')).not.toBeInTheDocument();
    expect(loadTokens()).toBeNull();
    expect(localStorage.getItem('ceview.forecast.old-profile')).toBeNull();
  });

  it.each([
    { uniquenessScore: null, destination: 'Onboarding' },
    { uniquenessScore: 80, destination: 'Dashboard' },
  ])('preserves signed-in routing to $destination', async ({ uniquenessScore, destination }) => {
    saveTokens({ accessToken: 'valid-token', profileCompleted: true, emailVerified: true });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ uniquenessScore }), { status: 200 }));

    renderAt('/');

    expect(await screen.findByText(destination)).toBeInTheDocument();
    expect(loadTokens()?.accessToken).toBe('valid-token');
  });
});
