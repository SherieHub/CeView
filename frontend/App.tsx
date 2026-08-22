import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import AuthGate, { RedirectIfAuthenticated } from './components/auth/AuthGate';
import LoginPage from './components/auth/LoginPage';
import CompleteProfilePage from './components/auth/CompleteProfilePage';
import ProfileCompletionGate from './components/auth/ProfileCompletionGate';
import OnboardingWizard from './components/module-1/onboarding/OnboardingWizard';
import AppShell from './layout/AppShell';
import RoutePlaceholder from './layout/RoutePlaceholder';
import { ProfileProvider, ProfileGate } from './services/profileContext';
import { OverlayStackProvider } from './components/shared/useOverlayStack';
import { ToastProvider } from './components/shared/Toast';
import { ObDraftProvider, DEMO_OB_DRAFT } from './components/module-1/onboarding/obDraft';
import AssetsLinksStep from './components/module-1/onboarding/steps/AssetsLinksStep';

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
        // Prefilled with the demo business so steps 1-3 already satisfy
        // stepValid() and Assets & Links (step 4) is reachable in three clicks.
        path: '/preview/onboarding',
        element: (
          <ObDraftProvider initial={DEMO_OB_DRAFT}>
            <OnboardingWizard />
          </ObDraftProvider>
        ),
      },
      {
        // Step 4 in isolation, with no rail or wizard chrome — handy for
        // working on the step itself. Use /preview/onboarding above to see it
        // in place. Padding mirrors the wizard's own .ob-panel.
        path: '/preview/onboarding/assets',
        element: (
          <ObDraftProvider>
            <div className="mx-auto max-w-[640px] p-6 md:p-10">
              <AssetsLinksStep />
            </div>
          </ObDraftProvider>
        ),
      },
    ]
  : [];

/**
 * DEV-ONLY preview route. `/onboarding` sits behind AuthGate + ProfileGate,
 * and apiClient.auth.login always hits the real backend (no fixture branch),
 * so the wizard can't be eyeballed locally without Spring Boot + Postgres
 * running. This route mounts it directly, outside both gates, purely so
 * in-progress steps can be checked in a browser — same fix as
 * feat/assets-and-links's identical `/preview/onboarding` route.
 * `import.meta.env.DEV` is statically false under `vite build`, so the whole
 * array (and its imports) is tree-shaken out of production bundles.
 *
 * TEMPORARY: delete once every wizard step (Cards 5-8) is real and there's no
 * further need to preview a still-landing step without auth.
 */
const devPreviewRoutes = import.meta.env.DEV
  ? [
      {
        // OnboardingWizard's own default export already wraps ObDraftProvider
        // internally — no need to supply one here.
        path: '/preview/onboarding',
        element: <OnboardingWizard />,
      },
    ]
  : [];

/**
 * Route tree:
 *   /login                       - public
 *   (AuthGate: redirects to /login when unauthenticated)
 *     (ProfileCompletionGate: complete-profile <-> rest-of-app redirect on profileCompleted)
 *       /complete-profile        - one-time contact-number step for Google-provisioned operators
 *       (ProfileGate: onboarding <-> dashboard redirect on uniquenessScore)
 *         /onboarding            - OnboardingWizard (m1c1: Wizard Shell & Step 1 Basic Info;
 *                                   m1c2: Step 2 Brand Identity; Steps 3-5 render their own
 *                                   "not implemented yet" panel until Cards 6-8 land — see
 *                                   02-module-1.md)
 *         (AppShell: sidebar + topbar + <Outlet/>)
 *           /dashboard, /content, /calendar, /performance, /settings/:tab
 *
 * Every route element below (besides /login, /complete-profile, /onboarding) is an
 * empty screen-shell placeholder per this Foundation card's scope boundary —
 * screen components land in later cards (02-module-1.md … 05-module-4.md).
 */
const router = createBrowserRouter([
  ...devPreviewRoutes,
  { path: '/login', element: <RedirectIfAuthenticated><LoginPage /></RedirectIfAuthenticated> },
  {
    element: <AuthGate />,
    children: [
      {
        element: <ProfileCompletionGate />,
        children: [
          { path: 'complete-profile', element: <CompleteProfilePage /> },
          {
            element: <ProfileGate />,
            children: [
              {
                path: 'onboarding',
                element: (
                  <ObDraftProvider>
                    <OnboardingWizard />
                  </ObDraftProvider>
                ),
              },
              {
                element: <AppShell />,
                children: [
                  { index: true, element: <Navigate to="/dashboard" replace /> },
                  { path: 'dashboard', element: <RoutePlaceholder navId="dashboard" /> },
                  { path: 'content', element: <RoutePlaceholder navId="content" /> },
                  { path: 'calendar', element: <RoutePlaceholder navId="calendar" /> },
                  { path: 'performance', element: <RoutePlaceholder navId="performance" /> },
                  { path: 'settings', element: <Navigate to="/settings/profile" replace /> },
                  { path: 'settings/:tab', element: <RoutePlaceholder navId="settings" /> },
                ],
              },
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
