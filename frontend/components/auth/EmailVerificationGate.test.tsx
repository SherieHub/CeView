import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import EmailVerificationGate from './EmailVerificationGate';
import { AuthProvider } from '../../services/auth';
import { EMAIL_NOT_VERIFIED_EVENT } from '../../services/authEvents';
import { loadTokens, saveTokens } from '../../services/authStorage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/verify-email" element={<div>VerifyScreen</div>} />
          <Route element={<EmailVerificationGate />}>
            <Route path="/dashboard" element={<div>DashboardScreen</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('EmailVerificationGate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sends an unverified operator to /verify-email', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false });
    renderAt('/dashboard');

    expect(screen.getByText('VerifyScreen')).toBeInTheDocument();
  });

  it('lets a verified operator through', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: true });
    renderAt('/dashboard');

    expect(screen.getByText('DashboardScreen')).toBeInTheDocument();
  });

  it('lets a session stored before verification shipped through (unknown is not unverified)', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true });
    renderAt('/dashboard');

    expect(screen.getByText('DashboardScreen')).toBeInTheDocument();
  });

  it('redirects that legacy session as soon as the backend answers EMAIL_NOT_VERIFIED, and remembers it', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true });
    renderAt('/dashboard');
    expect(screen.getByText('DashboardScreen')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event(EMAIL_NOT_VERIFIED_EVENT));
    });

    expect(screen.getByText('VerifyScreen')).toBeInTheDocument();
    expect(loadTokens()?.emailVerified).toBe(false);
  });
});
