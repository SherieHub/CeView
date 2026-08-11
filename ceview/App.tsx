import React from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AuthGate, { RedirectIfAuthenticated } from './components/auth/AuthGate';
import LoginPage from './components/auth/LoginPage';
import AppShell from './layout/AppShell';
import RoutePlaceholder from './layout/RoutePlaceholder';
import { ProfileProvider, ProfileGate } from './services/profileContext';

/**
 * Back-compat type-only re-exports. BusinessProfile.tsx and
 * UniquenessCalibrationView.tsx (both untouched, unused-for-now per this
 * card's scope boundary — see 01-foundation.md) still import these two
 * interfaces from './App' for their prop types. The runtime
 * useState/ProfileSetters prop-drilling block that used to back them is
 * gone (replaced by services/profileContext.tsx), but the shapes are kept
 * here, type-only, so those files keep compiling untouched until a later
 * card redistributes their internals.
 */
export interface ProfileData {
  businessProfileId: string | null;
  businessName: string;
  categories: string[];
  coreServices: string[];
  description: string;
  uvp: string;
  imagePreview: string | null;
  uniquenessScore: number | null;
}

export interface ProfileSetters {
  setBusinessProfileId: React.Dispatch<React.SetStateAction<string | null>>;
  setBusinessName: React.Dispatch<React.SetStateAction<string>>;
  setCategories: React.Dispatch<React.SetStateAction<string[]>>;
  setCoreServices: React.Dispatch<React.SetStateAction<string[]>>;
  setDescription: React.Dispatch<React.SetStateAction<string>>;
  setUvp: React.Dispatch<React.SetStateAction<string>>;
  setImagePreview: React.Dispatch<React.SetStateAction<string | null>>;
  setUniquenessScore: React.Dispatch<React.SetStateAction<number | null>>;
}

/**
 * Real routes replacing the old activeTab state switch. Route tree:
 *   /login                       - public
 *   (AuthGate: redirects to /login when unauthenticated)
 *     (ProfileGate: onboarding <-> dashboard redirect on uniquenessScore)
 *       /onboarding              - placeholder, no shell (wizard is a later card)
 *       (AppShell: sidebar + topbar + <Outlet/>)
 *         /dashboard, /content, /calendar, /performance, /settings/:tab
 *
 * Every route element below is an empty screen-shell placeholder per this
 * card's scope boundary — the existing HomeView/MarketRadarView/etc.
 * components are intentionally left unwired; later cards redistribute them.
 */
const router = createBrowserRouter([
  { path: '/login', element: <RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated> },
  {
    element: <AuthGate />,
    children: [
      {
        element: <ProfileGate />,
        children: [
          {
            path: '/onboarding',
            element: <RoutePlaceholder title="Onboarding" sub="Set up your business profile" />,
          },
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: '/dashboard', element: <RoutePlaceholder navId="dashboard" /> },
              { path: '/content', element: <RoutePlaceholder navId="content" /> },
              { path: '/calendar', element: <RoutePlaceholder navId="calendar" /> },
              { path: '/performance', element: <RoutePlaceholder navId="performance" /> },
              { path: '/settings', element: <Navigate to="/settings/profile" replace /> },
              { path: '/settings/:tab', element: <RoutePlaceholder navId="settings" /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

const App: React.FC = () => (
  <ProfileProvider>
    <RouterProvider router={router} />
  </ProfileProvider>
);

export default App;
