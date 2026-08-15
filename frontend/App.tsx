import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AuthGate, { RedirectIfAuthenticated } from './components/auth/AuthGate';
import LoginPage from './components/auth/LoginPage';
import AppShell from './layout/AppShell';
import RoutePlaceholder from './layout/RoutePlaceholder';
import { ProfileProvider, ProfileGate } from './services/profileContext';
import { OverlayStackProvider } from './components/shared/useOverlayStack';
import { ToastProvider } from './components/shared/Toast';
import { ObDraftProvider, DEMO_OB_DRAFT } from './components/module-1/onboarding/obDraft';
import OnboardingWizard from './components/module-1/onboarding/OnboardingWizard';

/**
 * DEV-ONLY preview routes.
 *
 * Onboarding steps live behind AuthGate, and apiClient.auth.login has no
 * fixture branch — it always hits the real backend — so a screen cannot be
 * eyeballed locally without Spring Boot + Postgres running. These routes mount
 * a step directly, outside both gates, purely so it can be checked in a
 * browser. `import.meta.env.DEV` is statically false in `vite build`, so the
 * whole array (and its imports) is tree-shaken out of production bundles.
 *
 * TEMPORARY: delete this once the wizard shell (Card 4, 02-module-1.md) mounts
 * the steps for real.
 */
const devPreviewRoutes = import.meta.env.DEV
  ? [
      {
        path: '/preview/onboarding',
        element: (
          <ObDraftProvider initial={DEMO_OB_DRAFT}>
            <OnboardingWizard />
          </ObDraftProvider>
        ),
      },
    ]
  : [];

/**
 * Route tree:
 *   /login                       - public
 *   (AuthGate: redirects to /login when unauthenticated)
 *     (ProfileGate: onboarding <-> dashboard redirect on uniquenessScore)
 *       /onboarding              - placeholder, no shell (wizard is a later card)
 *       (AppShell: sidebar + topbar + <Outlet/>)
 *         /dashboard, /content, /calendar, /performance, /settings/:tab
 *
 * Every route element below is an empty screen-shell placeholder per this
 * Foundation card's scope boundary — screen components land in later cards
 * (02-module-1.md … 05-module-4.md).
 */
const router = createBrowserRouter([
  ...devPreviewRoutes,
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

export default function App() {
  return (
    <ProfileProvider>
      <OverlayStackProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </OverlayStackProvider>
    </ProfileProvider>
  );
}
