import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../../services/auth';

vi.mock('../../services/firebase', () => ({
  signInWithGooglePopup: vi.fn(),
}));

import { signInWithGooglePopup } from '../../services/firebase';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status }));
}

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function requestBody(callIndex = 0): Record<string, unknown> {
  const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[callIndex];
  return JSON.parse((init as RequestInit).body as string);
}

describe('LoginPage — Continue with Google', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('signs in via the Firebase popup and navigates on success', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(signInWithGooglePopup).toHaveBeenCalledTimes(1);
  });

  it('shows an error message when the Google popup sign-in fails', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('popup-closed-by-user'));
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends intent "login" from the Sign in tab', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(requestBody().intent).toBe('login');
  });

  it('sends intent "register" from the Create account tab', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true }),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(requestBody().intent).toBe('register');
  });

  it('shows the "already registered" message when Create account rejects with 409', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse(
        { error: 'google_account_already_registered', message: 'This Google account is already registered. Please sign in instead.' },
        409,
      ),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByText('This Google account is already registered. Please sign in instead.')).toBeInTheDocument(),
    );
  });

  it('shows the "no account found" message when Sign in rejects with 404', async () => {
    (signInWithGooglePopup as ReturnType<typeof vi.fn>).mockResolvedValue('the-id-token');
    (fetch as ReturnType<typeof vi.fn>).mockReturnValue(
      jsonResponse(
        { error: 'google_account_not_registered', message: 'No account found for this Google account. Please create an account first.' },
        404,
      ),
    );
    renderLoginPage();

    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));

    await waitFor(() =>
      expect(screen.getByText('No account found for this Google account. Please create an account first.')).toBeInTheDocument(),
    );
  });
});
