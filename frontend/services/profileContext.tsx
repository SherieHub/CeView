/**
 * Business profile context + the onboarding<->dashboard redirect gate
 * (ProfileGate): `/onboarding` while uniquenessScore is null, `/dashboard`
 * once it's set.
 *
 * Fetches the operator's real profile (apiClient.businessProfile.load,
 * GET /api/business-profile) once authenticated, rather than staying
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

export function ProfileProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /**
   * Seed the profile instead of starting empty. Only the dev preview routes
   * and tests pass this — the authenticated app always starts at EMPTY_PROFILE
   * and lets the fetch below fill it in. Mirrors ObDraftProvider's `initial`.
   *
   * A seed is AUTHORITATIVE: when one is supplied the fetch below is skipped
   * entirely. It used to run anyway, and with a live session in localStorage
   * (which a dev preview inherits — the routes bypass AuthGate, not the token)
   * businessProfile.load() resolved and overwrote the seed. Under
   * VITE_USE_FIXTURES that load answers EMPTY_BUSINESS_PROFILE_DTO, so every
   * preview route silently reset to a blank operator a moment after mounting:
   * the Content Studio stopped generating captions (its effect requires a
   * businessName) and the dashboard's feed matched no categories. The bug was
   * invisible to tests, which run with an empty localStorage and therefore
   * always took the unauthenticated branch that already preserved the seed.
   */
  initial?: BusinessProfile;
}) {
  const seeded = initial !== undefined;
  const { isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<BusinessProfile>(initial ?? EMPTY_PROFILE);
  // Starts true when already authenticated on mount (e.g. a fresh full page
  // load with a valid persisted token) so the very first render shows the
  // loading state instead of racing ahead with the still-empty profile —
  // otherwise ProfileGate sees "not complete" for one render and redirects
  // to /onboarding before the real fetch even starts, then redirects again
  // to /dashboard once it resolves, losing whatever route was actually
  // requested either way.
  // A seeded provider has nothing to load, so it must not start in the
  // loading state either — ProfileGate would hold the preview on a spinner.
  const [isLoading, setIsLoading] = useState(isAuthenticated && !seeded);

  // Request-ordering guard: a fast logout-then-login-as-someone-else while a
  // fetch is still in flight must not let a stale response land after a
  // newer load (or a logout) has already superseded it.
  const requestToken = useRef(0);
  // Held in a ref so the reset below can reach it without putting a caller-
  // supplied object in the effect's dependency array, where a fresh literal
  // each render would re-run the fetch forever.
  const initialRef = useRef(initial ?? EMPTY_PROFILE);

  useEffect(() => {
    const token = ++requestToken.current;

    // Seeded: the caller owns this profile. Skipping the fetch is the whole
    // point — see the `initial` docblock above.
    if (seeded) {
      setIsLoading(false);
      return;
    }

    if (!isAuthenticated) {
      // Back to the starting profile, not a hardcoded empty one — for the real
      // app these are the same value, but a seeded provider (dev previews,
      // tests) must not have its seed wiped just because there is no session.
      setProfile(initialRef.current);
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
  }, [isAuthenticated, seeded]);

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
