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
import CampaignAnalyticsView from './components/module-4/4.1-campaign-analytics/CampaignAnalyticsView';
import { PostStoreProvider } from './services/postStore';
import { ConnectionsStoreProvider } from './services/connectionsStore';

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
 *         (PostStoreProvider + ConnectionsStoreProvider: Module 3's Foundation — Shared
 *          Stores, m3c1 — mounted here, above AppShell, per that card's own milestone, so
 *          every AppShell child reads the same posts/connections state)
 *         (AppShell: sidebar + topbar + <Outlet/>)
 *           /dashboard, /content, /calendar, /settings/:tab - still empty screen-shell
 *             placeholders, land in later cards (03-module-2.md, 04-module-3.md)
 *           /performance          - CampaignAnalyticsView (Module 4 — Campaign Analytics &
 *                                   Reporting, all 7 cards done — see 05-module-4.md)
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
                element: (
                  <PostStoreProvider>
                    <ConnectionsStoreProvider>
                      <AppShell />
                    </ConnectionsStoreProvider>
                  </PostStoreProvider>
                ),
                children: [
                  { index: true, element: <Navigate to="/dashboard" replace /> },
                  { path: 'dashboard', element: <RoutePlaceholder navId="dashboard" /> },
                  { path: 'content', element: <RoutePlaceholder navId="content" /> },
                  { path: 'calendar', element: <RoutePlaceholder navId="calendar" /> },
                  { path: 'performance', element: <CampaignAnalyticsView /> },
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
