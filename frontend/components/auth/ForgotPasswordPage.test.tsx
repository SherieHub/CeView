import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ForgotPasswordPage from './ForgotPasswordPage';
import { RedirectIfAuthenticated } from './AuthGate';
import { AuthProvider } from '../../services/auth';
import { ToastProvider } from '../shared/Toast';
import { loadTokens } from '../../services/authStorage';
import { callsTo, json, stubBackend } from './authTestUtils';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

const REQUEST = 'POST /api/auth/password-reset/request';
const CONFIRM = 'POST /api/auth/password-reset/confirm';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route
              path="/forgot-password"
              element={
                <RedirectIfAuthenticated>
                  <ForgotPasswordPage />
                </RedirectIfAuthenticated>
              }
            />
            <Route path="/dashboard" element={<div>DashboardScreen</div>} />
            <Route path="/login" element={<div>LoginScreen</div>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const sentOk = () => json({ sentTo: 'a@b.com', resendAvailableInSeconds: 60 }, 202);

async function reachConfirmStep() {
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'a@b.com' } });
  fireEvent.click(screen.getByRole('button', { name: /send code/i }));
  await screen.findByLabelText(/verification code/i);
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for the email first, then moves to the code and new-password step', async () => {
    const fetchMock = stubBackend({ [REQUEST]: sentOk });
    renderPage();
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();

    await reachConfirmStep();

    expect(callsTo(fetchMock, REQUEST)).toEqual([{ email: 'a@b.com' }]);
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
  });

  it('says so when no account has that email', async () => {
    stubBackend({ [REQUEST]: () => json({ code: 'ACCOUNT_NOT_FOUND' }, 404) });
    renderPage();

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'nobody@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no account found/i);
    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
  });

  it('points a Google-only account back to Continue with Google', async () => {
    stubBackend({ [REQUEST]: () => json({ code: 'GOOGLE_ACCOUNT' }, 409) });
    renderPage();

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'g@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send code/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/uses google sign-in/i);
  });

  it('rejects a weak new password locally without calling the backend', async () => {
    const fetchMock = stubBackend({ [REQUEST]: sentOk });
    renderPage();
    await reachConfirmStep();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'weak' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/stronger password/i);
    expect(callsTo(fetchMock, CONFIRM)).toHaveLength(0);
  });

  it('resets the password, stores a verified session and carries on into the app', async () => {
    const fetchMock = stubBackend({
      [REQUEST]: sentOk,
      [CONFIRM]: () => json({ token: 'jwt-r', operatorId: 'op-1', profileCompleted: true, emailVerified: true }),
    });
    renderPage();
    await reachConfirmStep();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '123456' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Brand9NewPass' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await screen.findByText('DashboardScreen');
    expect(callsTo(fetchMock, CONFIRM)).toEqual([{ email: 'a@b.com', code: '123456', newPassword: 'Brand9NewPass' }]);
    expect(loadTokens()).toMatchObject({ accessToken: 'jwt-r', emailVerified: true, email: 'a@b.com' });
  });

  it('shows attempts left on a wrong code and keeps the form', async () => {
    stubBackend({
      [REQUEST]: sentOk,
      [CONFIRM]: () => json({ code: 'INVALID_CODE', attemptsRemaining: 1 }, 400),
    });
    renderPage();
    await reachConfirmStep();

    fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: '000000' } });
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'Brand9NewPass' } });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('1 attempt left');
    expect(loadTokens()).toBeNull();
  });

  it('goes back to the email step via "Use a different email"', async () => {
    stubBackend({ [REQUEST]: sentOk });
    renderPage();
    await reachConfirmStep();

    fireEvent.click(screen.getByRole('button', { name: /use a different email/i }));

    expect(screen.queryByLabelText(/verification code/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send code/i })).toBeInTheDocument();
  });

  it('links back to sign in', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/login');
  });
});
