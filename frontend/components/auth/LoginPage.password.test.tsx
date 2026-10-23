import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../../services/auth';
import { loadTokens } from '../../services/authStorage';
import { callsTo, json, stubBackend } from './authTestUtils';

vi.mock('../../services/firebase', () => ({
  signInWithGooglePopup: vi.fn(),
  isFirebaseConfigured: () => false,
  isPhoneVerificationEnabled: () => false,
}));

vi.stubEnv('VITE_USE_FIXTURES', 'false');

const REGISTER = 'POST /api/auth/register';
const LOGIN = 'POST /api/auth/login';

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<div>ForgotScreen</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function fillSignUp(password: string) {
  fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
  fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'Cruz' } });
  fireEvent.change(screen.getByLabelText(/contact number/i), { target: { value: '09171234567' } });
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
}

function submit() {
  fireEvent.click(screen.getAllByRole('button', { name: /^create account$/i }).find((b) => b.getAttribute('type') === 'submit')!);
}

describe('LoginPage — password sign-up and sign-in', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the password rule on the sign-up tab', () => {
    renderLoginPage();

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));

    expect(screen.getByText(/at least 8 characters, with a letter and a number/i)).toBeInTheDocument();
  });

  it('offers "Forgot password?" on the sign-in tab and not on sign-up', () => {
    renderLoginPage();

    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute('href', '/forgot-password');

    fireEvent.click(screen.getByRole('tab', { name: /create account/i }));
    expect(screen.queryByRole('link', { name: /forgot password/i })).not.toBeInTheDocument();
  });

  it('blocks a weak password before any request is made', () => {
    const fetchMock = stubBackend({});
    renderLoginPage();

    fillSignUp('weak');
    submit();

    expect(screen.getByRole('alert')).toHaveTextContent(/stronger password/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registers with a valid password and stores an unverified session', async () => {
    const fetchMock = stubBackend({
      [REGISTER]: () => json({ token: 'jwt-1', operatorId: 'op-1', profileCompleted: true, emailVerified: false }),
    });
    renderLoginPage();

    fillSignUp('Passw0rd1');
    submit();

    await vi.waitFor(() => expect(loadTokens()?.accessToken).toBe('jwt-1'));
    expect(callsTo(fetchMock, REGISTER)[0]).toMatchObject({ email: 'a@b.com', password: 'Passw0rd1' });
    expect(loadTokens()?.emailVerified).toBe(false);
  });

  it('explains that the email is already in use', async () => {
    stubBackend({ [REGISTER]: () => json({ error: 'email already registered', code: 'EMAIL_TAKEN' }, 400) });
    renderLoginPage();

    fillSignUp('Passw0rd1');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(/already in use/i);
  });

  it('keeps the generic message for an unrecognised failure', async () => {
    stubBackend({ [LOGIN]: () => json({ error: 'invalid credentials' }, 401) });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'whatever1' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i, hidden: false }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/something went wrong/i);
  });
});
