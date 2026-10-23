import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { ProfileProvider, ProfileGate, useProfile } from './profileContext';
import { saveTokens } from './authStorage';

// ProfileProvider must fetch the operator's real profile from the backend
// (apiClient.businessProfile.load, GET /api/business-profile) once
// authenticated, instead of staying permanently on the local EMPTY_PROFILE
// default — otherwise every operator looks brand-new forever and ProfileGate
// always sends them to /onboarding regardless of their real data.
vi.mock('./apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./apiClient')>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, businessProfile: { load: vi.fn() } },
  };
});

import { apiClient } from './apiClient';

const mockLoad = apiClient.businessProfile.load as unknown as ReturnType<typeof vi.fn>;

function Probe() {
  const { profile, isLoading } = useProfile();
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="score">{String(profile.uniquenessScore)}</span>
      <span data-testid="name">{profile.businessName}</span>
    </div>
  );
}

function seedSession() {
  saveTokens({ accessToken: 'jwt-1', profileCompleted: true });
}

describe('ProfileProvider — real backend fetch', () => {
  beforeEach(() => {
    localStorage.clear();
    mockLoad.mockReset();
  });

  // REGRESSION: the dev preview routes bypass AuthGate, not the persisted
  // token, so a seeded provider was mounting WITH a live session. The fetch
  // ran and overwrote the seed — and under VITE_USE_FIXTURES it answers an
  // empty DTO, so /preview/content and /preview/dashboard both reset to a
  // blank operator a moment after mounting. Every existing test here runs
  // unauthenticated, which is why none of them caught it.
  it('treats a supplied seed as authoritative and skips the fetch, even with a session', async () => {
    seedSession();
    mockLoad.mockResolvedValue({
      businessProfileId: null, businessName: '', categories: [], coreServices: [],
      description: '', uvp: '', imagePreview: null, uniquenessScore: null,
    });

    render(
      <AuthProvider>
        <ProfileProvider initial={{
          businessProfileId: 'bp-demo', businessName: 'Sunset Cove', categories: ['Coastal & Island'],
          coreServices: [], description: '', uvp: '', imagePreview: null, uniquenessScore: 0.82,
          slogan: '', industry: '', vibes: [], website: '', logo: null, socials: {},
        }}>
          <Probe />
        </ProfileProvider>
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('name')).toHaveTextContent('Sunset Cove');
    expect(mockLoad).not.toHaveBeenCalled();

    // Still seeded after the load would have resolved and overwritten it.
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Sunset Cove'));
    expect(screen.getByTestId('score')).toHaveTextContent('0.82');
  });

  it('stays at the empty profile and never calls the backend when unauthenticated', () => {
    render(
      <AuthProvider>
        <ProfileProvider>
          <Probe />
        </ProfileProvider>
      </AuthProvider>,
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('score')).toHaveTextContent('null');
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('fetches the real profile once authenticated and applies it', async () => {
    seedSession();
    mockLoad.mockResolvedValue({
      businessProfileId: 'bp-1',
      businessName: 'Moalboal FreeDive Cebu',
      categories: ['Coastal & Island'],
      coreServices: [],
      description: '',
      uvp: '',
      imagePreview: null,
      uniquenessScore: 0.82,
    });

    render(
      <AuthProvider>
        <ProfileProvider>
          <Probe />
        </ProfileProvider>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('score')).toHaveTextContent('0.82');
    expect(screen.getByTestId('name')).toHaveTextContent('Moalboal FreeDive Cebu');
    expect(mockLoad).toHaveBeenCalledTimes(1);
  });

  it('resets to the empty profile on a failed fetch, without crashing', async () => {
    seedSession();
    mockLoad.mockRejectedValue(new Error('boom'));

    render(
      <AuthProvider>
        <ProfileProvider>
          <Probe />
        </ProfileProvider>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('score')).toHaveTextContent('null');
  });

  it('ProfileGate waits for the fetch to settle before redirecting, instead of flashing to /onboarding', async () => {
    seedSession();
    let resolveLoad!: (v: unknown) => void;
    mockLoad.mockReturnValue(new Promise((res) => { resolveLoad = res; }));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <ProfileProvider>
            <Routes>
              <Route element={<ProfileGate />}>
                <Route path="/onboarding" element={<div>OnboardingScreen</div>} />
                <Route path="/dashboard" element={<div>DashboardScreen</div>} />
              </Route>
            </Routes>
          </ProfileProvider>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByText('OnboardingScreen')).not.toBeInTheDocument();
    expect(screen.queryByText('DashboardScreen')).not.toBeInTheDocument();

    resolveLoad({
      businessProfileId: 'bp-1', businessName: 'X', categories: [], coreServices: [],
      description: '', uvp: '', imagePreview: null, uniquenessScore: 0.9,
    });

    await waitFor(() => expect(screen.getByText('DashboardScreen')).toBeInTheDocument());
  });
});

// An operator whose email is unverified is 403'd by the backend on every route, the profile
// included. The load must wait for verification and then run, otherwise an existing operator with
// a complete profile verifies their email and is sent to /onboarding as if brand new.
describe('ProfileProvider — email verification', () => {
  beforeEach(() => {
    localStorage.clear();
    mockLoad.mockReset();
  });

  function VerifyButton() {
    const { markEmailVerified } = useAuth();
    return <button onClick={markEmailVerified}>verify</button>;
  }

  const savedProfile = {
    businessProfileId: 'bp-1', businessName: 'Reef Co', categories: [], coreServices: [],
    description: '', uvp: '', imagePreview: null, uniquenessScore: 0.9,
  };

  it('does not call the backend while the email is unverified, and stays loading', () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false });

    render(
      <AuthProvider>
        <ProfileProvider>
          <Probe />
        </ProfileProvider>
      </AuthProvider>,
    );

    expect(mockLoad).not.toHaveBeenCalled();
    expect(screen.getByTestId('loading')).toHaveTextContent('true');
  });

  it('loads the saved profile once the email becomes verified', async () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false });
    mockLoad.mockResolvedValue(savedProfile);
    render(
      <AuthProvider>
        <ProfileProvider>
          <Probe />
          <VerifyButton />
        </ProfileProvider>
      </AuthProvider>,
    );
    expect(mockLoad).not.toHaveBeenCalled();

    act(() => screen.getByText('verify').click());

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Reef Co'));
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('ProfileGate sends a verified operator with a saved profile to /dashboard, not /onboarding', async () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: false });
    mockLoad.mockResolvedValue(savedProfile);
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <ProfileProvider>
            <VerifyButton />
            <Routes>
              <Route element={<ProfileGate />}>
                <Route path="/onboarding" element={<div>OnboardingScreen</div>} />
                <Route path="/dashboard" element={<div>DashboardScreen</div>} />
              </Route>
            </Routes>
          </ProfileProvider>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText('OnboardingScreen')).not.toBeInTheDocument();

    act(() => screen.getByText('verify').click());

    await waitFor(() => expect(screen.getByText('DashboardScreen')).toBeInTheDocument());
    expect(screen.queryByText('OnboardingScreen')).not.toBeInTheDocument();
  });

  it('still loads straight away for a verified session', async () => {
    saveTokens({ accessToken: 'jwt-1', profileCompleted: true, emailVerified: true });
    mockLoad.mockResolvedValue(savedProfile);

    render(
      <AuthProvider>
        <ProfileProvider>
          <Probe />
        </ProfileProvider>
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Reef Co'));
  });
});
