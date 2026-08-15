import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AuthGate, { RedirectIfAuthenticated } from './components/auth/AuthGate';
import LoginPage from './components/auth/LoginPage';
import AppShell from './layout/AppShell';
import RoutePlaceholder from './layout/RoutePlaceholder';
import { ProfileProvider, ProfileGate } from './services/profileContext';
import { OverlayStackProvider } from './components/shared/useOverlayStack';
import { ToastProvider } from './components/shared/Toast';
import OnboardingWizard from './components/module-1/onboarding/OnboardingWizard';

/**
 * Route tree:
 *   /login                       - public
 *   (AuthGate: redirects to /login when unauthenticated)
 *     (ProfileGate: onboarding <-> dashboard redirect on uniquenessScore)
 *       /onboarding              - OnboardingWizard (m1c1), no AppShell
 *       (AppShell: sidebar + topbar + <Outlet/>)
 *         /dashboard, /content, /calendar, /performance, /settings/:tab
 *
 * Remaining route elements are empty screen-shell placeholders per this
 * Foundation card's scope boundary — screen components land in later cards
 * (02-module-1.md … 05-module-4.md).
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
            element: <OnboardingWizard />,
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
