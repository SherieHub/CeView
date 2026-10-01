/**
 * Frontend business-profile context. Replaces the profile useState/
 * ProfileSetters prop-drilling block that used to live in App.tsx: fetches
 * the operator's profile once via api.loadProfile() and exposes it (plus a
 * refresh() for after a save) to any component via useProfile().
 *
 * Also hosts ProfileGate, the profile-completeness route guard: redirects
 * /onboarding -> /dashboard once profile.uniquenessScore is non-null, and
 * the reverse (any other authenticated route -> /onboarding) while it's
 * still null. Lives alongside the context because the guard reads nothing
 * but useProfile() + the current route.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api, type BusinessProfileDTO } from './apiClient';
import { useAuth } from './auth';

export type ProfileData = BusinessProfileDTO;

interface ProfileContextValue {
  profile: ProfileData | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request-ordering guard: ProfileProvider lives above RouterProvider and
  // persists across login/logout, so a fast false->true->false flip (log
  // out while a fetch is in flight) must not let a stale response from an
  // earlier/different session land after a newer load() (or a logout) has
  // already run. Each load() call stamps the request with the current
  // token; a response is only applied if that token is still current when
  // it resolves — otherwise it's silently discarded rather than
  // resurrecting a previous operator's profile.
  const requestToken = useRef(0);

  const load = useCallback(() => {
    const token = ++requestToken.current;

    if (!isAuthenticated) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    api.loadProfile()
      .then(dto => {
        if (requestToken.current !== token) return; // superseded — discard
        setProfile(dto);
      })
      .catch(err => {
        if (requestToken.current !== token) return; // superseded — discard
        console.error('loadProfile failed', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => {
        if (requestToken.current !== token) return; // superseded — discard
        setIsLoading(false);
      });
  }, [isAuthenticated]);

  useEffect(() => { load(); }, [load]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, error, refresh: load }}>
      {children}
    </ProfileContext.Provider>
  );
};

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}

const ONBOARDING_PATH = '/onboarding';
const DASHBOARD_PATH = '/dashboard';

/**
 * Route guard: sits under AuthGate, above the routed screens. Waits for the
 * profile fetch to settle (or fail) before making a redirect decision, so a
 * slow/failed request can't bounce the user into a redirect loop.
 */
export const ProfileGate: React.FC = () => {
  const { profile, isLoading, error } = useProfile();
  const location = useLocation();

  if (isLoading || (profile == null && error == null)) {
    return (
      <div className="content"><div className="wrap"><p className="body-sm">Loading your profile…</p></div></div>
    );
  }

  // A failed fetch shouldn't force onboarding on an otherwise-complete
  // profile it just couldn't read — let the route render and surface the
  // error there rather than redirect-looping.
  if (profile == null) {
    return <Outlet />;
  }

  const onOnboarding = location.pathname.startsWith(ONBOARDING_PATH);
  const isComplete = profile.uniquenessScore != null;

  if (onOnboarding && isComplete) {
    return <Navigate to={DASHBOARD_PATH} replace />;
  }
  if (!onOnboarding && !isComplete) {
    return <Navigate to={ONBOARDING_PATH} replace />;
  }
  return <Outlet />;
};
