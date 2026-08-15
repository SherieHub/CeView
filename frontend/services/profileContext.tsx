/**
 * Business profile context + the onboarding<->dashboard redirect gate
 * (ProfileGate): `/onboarding` while uniquenessScore is null, `/dashboard`
 * once it's set. Onboarding wizard internals land in a later card
 * (02-module-1.md); this Foundation card only needs the gate + the shape.
 */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { BusinessProfile } from '../types';

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
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<BusinessProfile>(EMPTY_PROFILE);
  const value = useMemo(() => ({ profile, setProfile }), [profile]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}

/** Redirects /onboarding <-> /dashboard based on profile.uniquenessScore. */
export function ProfileGate() {
  const { profile } = useProfile();
  const onOnboardingRoute = window.location.pathname.startsWith('/onboarding');
  const complete = profile.uniquenessScore != null;

  if (!complete && !onOnboardingRoute) return <Navigate to="/onboarding" replace />;
  if (complete && onOnboardingRoute) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
