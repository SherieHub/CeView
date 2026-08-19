/**
 * Business profile context + the onboarding<->dashboard redirect gate
 * (ProfileGate): `/onboarding` while uniquenessScore is null, `/dashboard`
 * once it's set.
 *
 * Fetches the operator's real profile (apiClient.businessProfile.load,
 * GET /api/v1/business-profile) once authenticated, rather than staying
 * permanently on the local EMPTY_PROFILE default — otherwise every operator
 * would look brand-new forever regardless of what's actually saved. The
 * fetched BusinessProfileDto (backend's real, narrower shape) is merged over
 * EMPTY_PROFILE so the onboarding-only fields (slogan/industry/vibes/etc. —
 * not in the backend schema yet, see docs/module-1/backend/schema-delta.md)
 * stay at their local defaults.
 */
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { BusinessProfile } from '../types';
import { apiClient } from './apiClient';
import { useAuth } from './auth';

const EMPTY_PROFILE: BusinessProfile = {
  businessProfileId: null,
  businessName: '',
  categories: [],
  coreServices: [],
  description: '',
  uvp: '',
  imagePreview: null,
  uniquenessScore: null,
  slogan: '',
  industry: '',
  vibes: [],
  website: '',
  logo: null,
  socials: {},
};

interface ProfileContextValue {
  profile: BusinessProfile;
  setProfile: (profile: BusinessProfile) => void;
  isLoading: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  // Starts true when already authenticated on mount (e.g. a fresh full page
  // load with a valid persisted token) so the very first render shows the
  // loading state instead of racing ahead with the still-empty profile —
  // otherwise ProfileGate sees "not complete" for one render and redirects
  // to /onboarding before the real fetch even starts, then redirects again
  // to /dashboard once it resolves, losing whatever route was actually
  // requested either way.
  const [isLoading, setIsLoading] = useState(isAuthenticated);

  // Request-ordering guard: a fast logout-then-login-as-someone-else while a
  // fetch is still in flight must not let a stale response land after a
  // newer load (or a logout) has already superseded it.
  const requestToken = useRef(0);

  useEffect(() => {
    const token = ++requestToken.current;

    if (!isAuthenticated) {
      setProfile(EMPTY_PROFILE);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    apiClient.businessProfile
      .load()
      .then((dto) => {
        if (requestToken.current !== token) return; // superseded — discard
        setProfile({ ...EMPTY_PROFILE, ...dto });
      })
      .catch((err) => {
        if (requestToken.current !== token) return; // superseded — discard
        console.error('businessProfile.load failed', err);
      })
      .finally(() => {
        if (requestToken.current !== token) return; // superseded — discard
        setIsLoading(false);
      });
  }, [isAuthenticated]);

  const value = useMemo(() => ({ profile, setProfile, isLoading }), [profile, isLoading]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}

/**
 * Redirects /onboarding <-> /dashboard based on profile.uniquenessScore.
 * Waits for the initial fetch to settle before deciding, so a freshly
 * authenticated operator with real saved data doesn't flash to /onboarding
 * while their profile is still loading.
 */
export function ProfileGate() {
  const { profile, isLoading } = useProfile();
  const { pathname } = useLocation();
  const onOnboardingRoute = pathname.startsWith('/onboarding');

  if (isLoading) {
    return (
      <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
        <p className="body-sm">Loading your profile…</p>
      </div>
    );
  }

  const complete = profile.uniquenessScore != null;

  if (!complete && !onOnboardingRoute) return <Navigate to="/onboarding" replace />;
  if (complete && onOnboardingRoute) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
