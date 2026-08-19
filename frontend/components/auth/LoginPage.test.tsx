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
});
