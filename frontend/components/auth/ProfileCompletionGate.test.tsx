import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProfileCompletionGate from './ProfileCompletionGate';
import { AuthProvider } from '../../services/auth';
import { saveTokens } from '../../services/authStorage';

function seedSession(profileCompleted: boolean) {
  saveTokens({ accessToken: 'jwt-1', profileCompleted });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route element={<ProfileCompletionGate />}>
            <Route path="/complete-profile" element={<div>CompleteProfileScreen</div>} />
            <Route path="/dashboard" element={<div>DashboardScreen</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProfileCompletionGate', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('redirects an incomplete-profile operator from another route to /complete-profile', () => {
    seedSession(false);
    renderAt('/dashboard');

    expect(screen.getByText('CompleteProfileScreen')).toBeInTheDocument();
  });

  it('redirects a complete-profile operator away from /complete-profile to /dashboard', () => {
    seedSession(true);
    renderAt('/complete-profile');

    expect(screen.getByText('DashboardScreen')).toBeInTheDocument();
  });

  it('renders the nested route when an incomplete-profile operator is already on /complete-profile', () => {
    seedSession(false);
    renderAt('/complete-profile');

    expect(screen.getByText('CompleteProfileScreen')).toBeInTheDocument();
  });

  it('renders the nested route as-is when the operator profile is already complete', () => {
    seedSession(true);
    renderAt('/dashboard');

    expect(screen.getByText('DashboardScreen')).toBeInTheDocument();
  });
});
