import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VerifyEmailPage from './VerifyEmailPage';
import { AuthProvider } from '../../services/auth';
import { ToastProvider } from '../shared/Toast';
import { loadTokens, saveTokens } from '../../services/authStorage';
import { callsTo, json, stubBackend } from './authTestUtils';

vi.stubEnv('VITE_USE_FIXTURES', 'false');

const SEND = 'POST /api/auth/email-verification/send';
const VERIFY = 'POST /api/auth/email-verification/verify';
const CHANGE = 'PATCH /api/auth/email';

function seedSession(over: Record<string, unknown> = {}) {
  saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false, email: 'a@b.com', ...over });
}

function renderPage(strict = false) {
  const tree = (
    <MemoryRouter initialEntries={['/verify-email']}>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/dashboard" element={<div>DashboardScreen</div>} />
            <Route path="/login" element={<div>LoginScreen</div>} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
  return render(strict ? <React.StrictMode>{tree}</React.StrictMode> : tree);
}

const sentOk = () => json({ sentTo: 'a@b.com', resendAvailableInSeconds: 60 }, 202);

function typeCode(value: string) {
  fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value } });
}

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    seedSession();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('emails a code on arrival and says where it went', async () => {
    const fetchMock = stubBackend({ [SEND]: sentOk });
    renderPage();

    expect(await screen.findByText(/we sent a 6-digit code to a@b\.com/i)).toBeInTheDocument();
    expect(callsTo(fetchMock, SEND)).toHaveLength(1);
  });

  it('sends only one code even under React StrictMode double-mounting', async () => {
    const fetchMock = stubBackend({ [SEND]: sentOk });
    renderPage(true);

    await screen.findByText(/we sent a 6-digit code/i);
    expect(callsTo(fetchMock, SEND)).toHaveLength(1);
  });

  it('treats a cooldown rejection on arrival as "already sent", not as an error', async () => {
    stubBackend({ [SEND]: () => json({ code: 'RESEND_COOLDOWN', retryAfterSeconds: 42 }, 429) });
    renderPage();

    expect(await screen.findByText(/already sent you a code/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend code in 42s/i })).toBeDisabled();
  });

  it('keeps Verify disabled until six digits are entered and strips non-digits', async () => {
    stubBackend({ [SEND]: sentOk });
    renderPage();
    await screen.findByText(/we sent a 6-digit code/i);
    const verify = screen.getByRole('button', { name: /^verify email/i });

    typeCode('12ab34');
    expect(screen.getByLabelText(/verification code/i)).toHaveValue('1234');
    expect(verify).toBeDisabled();

    typeCode('123456789');
    expect(screen.getByLabelText(/verification code/i)).toHaveValue('123456');
    expect(verify).toBeEnabled();
  });

  it('verifies the code, persists emailVerified, and continues to the app', async () => {
    const fetchMock = stubBackend({ [SEND]: sentOk, [VERIFY]: () => json({ emailVerified: true }) });
    renderPage();
    await screen.findByText(/we sent a 6-digit code/i);

    typeCode('123456');
    fireEvent.click(screen.getByRole('button', { name: /^verify email/i }));

    await screen.findByText('DashboardScreen');
    expect(callsTo(fetchMock, VERIFY)).toEqual([{ code: '123456' }]);
    expect(loadTokens()?.emailVerified).toBe(true);
  });

  it('shows how many attempts are left after a wrong code and stays on the page', async () => {
    stubBackend({
      [SEND]: sentOk,
      [VERIFY]: () => json({ code: 'INVALID_CODE', attemptsRemaining: 4 }, 400),
    });
    renderPage();
    await screen.findByText(/we sent a 6-digit code/i);

    typeCode('000000');
    fireEvent.click(screen.getByRole('button', { name: /^verify email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not correct. 4 attempts left.');
    expect(screen.queryByText('DashboardScreen')).not.toBeInTheDocument();
    expect(loadTokens()?.emailVerified).toBe(false);
  });

  it('tells the user to request a new code once the code is locked', async () => {
    stubBackend({ [SEND]: sentOk, [VERIFY]: () => json({ code: 'CODE_LOCKED' }, 400) });
    renderPage();
    await screen.findByText(/we sent a 6-digit code/i);

    typeCode('000000');
    fireEvent.click(screen.getByRole('button', { name: /^verify email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/request a new code/i);
  });

  it('counts the resend button down and re-enables it, then sends another code', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const fetchMock = stubBackend({ [SEND]: sentOk });
    renderPage();
    await act(async () => {});
    expect(screen.getByRole('button', { name: /resend code in 60s/i })).toBeDisabled();

    for (let i = 0; i < 60; i++) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    const resend = screen.getByRole('button', { name: /^resend code$/i });
    expect(resend).toBeEnabled();
    fireEvent.click(resend);
    await act(async () => {});
    expect(callsTo(fetchMock, SEND)).toHaveLength(2);
  });

  it('lets the user fix a mistyped email, which sends a code to the new address', async () => {
    const fetchMock = stubBackend({
      [SEND]: sentOk,
      [CHANGE]: (body) => json({ email: body?.email }),
    });
    renderPage();
    await screen.findByText(/we sent a 6-digit code to a@b\.com/i);

    fireEvent.click(screen.getByRole('button', { name: /wrong email\? change it/i }));
    fireEvent.change(screen.getByLabelText(/new email/i), { target: { value: 'right@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send code to this email/i }));

    expect(await screen.findByText(/we sent a 6-digit code to right@b\.com/i)).toBeInTheDocument();
    expect(callsTo(fetchMock, CHANGE)).toEqual([{ email: 'right@b.com' }]);
    expect(loadTokens()?.email).toBe('right@b.com');
    expect(screen.queryByLabelText(/new email/i)).not.toBeInTheDocument();
  });

  it('explains when the new email is already in use', async () => {
    stubBackend({ [SEND]: sentOk, [CHANGE]: () => json({ code: 'EMAIL_TAKEN' }, 400) });
    renderPage();
    await screen.findByText(/we sent a 6-digit code/i);

    fireEvent.click(screen.getByRole('button', { name: /wrong email\? change it/i }));
    fireEvent.change(screen.getByLabelText(/new email/i), { target: { value: 'taken@b.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send code to this email/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already in use/i);
  });

  it('sends an already-verified operator straight to the app without emailing anything', async () => {
    seedSession({ emailVerified: true });
    const fetchMock = stubBackend({ [SEND]: sentOk });
    renderPage();

    expect(await screen.findByText('DashboardScreen')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recovers when the backend says the email is already verified', async () => {
    stubBackend({ [SEND]: () => json({ code: 'ALREADY_VERIFIED' }, 409) });
    renderPage();

    expect(await screen.findByText('DashboardScreen')).toBeInTheDocument();
    expect(loadTokens()?.emailVerified).toBe(true);
  });

  it('reports a failed email send', async () => {
    stubBackend({ [SEND]: () => json({ code: 'EMAIL_SEND_FAILED' }, 503) });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not send the email/i);
  });

  it('signs out from the verify screen', async () => {
    stubBackend({ [SEND]: sentOk });
    renderPage();
    await screen.findByText(/we sent a 6-digit code/i);

    fireEvent.click(screen.getByRole('button', { name: /sign out/i }));

    await waitFor(() => expect(loadTokens()).toBeNull());
  });
});
