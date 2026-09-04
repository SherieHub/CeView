import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import AuthGate, { RedirectIfAuthenticated } from './components/auth/AuthGate';
import LoginPage from './components/auth/LoginPage';
import CompleteProfilePage from './components/auth/CompleteProfilePage';
import ProfileCompletionGate from './components/auth/ProfileCompletionGate';
import OnboardingWizard from './components/module-1/onboarding/OnboardingWizard';
import AppShell from './layout/AppShell';
import { ProfileProvider, ProfileGate } from './services/profileContext';
import { OverlayStackProvider } from './components/shared/useOverlayStack';
import { ToastProvider } from './components/shared/Toast';
import { ObDraftProvider, DEMO_OB_DRAFT } from './components/module-1/onboarding/obDraft';
import AssetsLinksStep from './components/module-1/onboarding/steps/AssetsLinksStep';
import CampaignAnalyticsView from './components/module-4/4.1-campaign-analytics/CampaignAnalyticsView';
import { PostStoreProvider } from './services/postStore';
import { ConnectionsStoreProvider } from './services/connectionsStore';
import { TargetSelectionProvider } from './services/targetSelectionStore';
import DashboardView from './components/module-2/2.1-dashboard/DashboardView';
import { DEMO_PROFILE } from './services/fixtures/profile';
import type { DashMode } from './components/module-2/2.1-dashboard/useDashboardState';
import ContentStudioView from './components/module-3/3.1-content-studio/ContentStudioView';
import CalendarView from './components/module-3/3.2-calendar/CalendarView';
import BusinessProfileSettings from './components/settings/BusinessProfileSettings';
import PlatformsSettings from './components/settings/PlatformsSettings';
import WorkspaceSettings from './components/settings/WorkspaceSettings';
import path from 'path/win32';

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
      {
        path: '/preview/dashboard/:mode?',
        element: <DashboardPreviewShell />,
        children: [{ index: true, element: <DashboardPreviewScreen /> }],
      },
      {
        // Module 3 previews intentionally bypass auth/profile gates. They are
        // DEV-only, so production users still enter through the normal shell.
        // Wrapped in its own TargetSelectionProvider + ConnectionsStoreProvider
        // (normally mounted once, above AppShell) since this route bypasses
        // that subtree entirely.
        path: '/preview/content',
        element: (
          <ConnectionsStoreProvider>
            <TargetSelectionProvider>
              <ContentStudioView />
            </TargetSelectionProvider>
          </ConnectionsStoreProvider>
        ),
      },
      {
        path: '/preview/calendar',
        element: <CalendarView />,
      },
    ]
  : [];

/**
 * DEV-ONLY. Re-seeds the profile for the subtree, then hands off to the real
 * AppShell so the preview exercises the actual chrome rather than a copy of it.
 * ProfileProvider is already mounted above the router; the nearest one wins.
 */
function DashboardPreviewShell() {
  const { mode } = useParams();
  const profile =
    mode === 'zero-match'
      ? { ...DEMO_PROFILE, categories: ['Wellness & Spa'] }
      : DEMO_PROFILE;

  return (
    <ProfileProvider initial={profile}>
      <TargetSelectionProvider>
        <AppShell />
      </TargetSelectionProvider>
    </ProfileProvider>
  );
}

/** DEV-ONLY. Maps the :mode segment onto the dashboard's state machine. */
const FORCEABLE_MODES: DashMode[] = ['loading', 'empty', 'ai-down'];

function DashboardPreviewScreen() {
  const { mode } = useParams();
  const forceMode = FORCEABLE_MODES.find((m) => m === mode);
  return <DashboardView forceMode={forceMode} />;
}

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
 *           /dashboard, /content, /calendar    - real screens (03-module-2.md, 04-module-3.md)
 *           /settings/profile, /platforms,       BusinessProfileSettings (02-module-1.md Card 9),
 *             /workspace                         PlatformsSettings + WorkspaceSettings (04-module-3.md
 *                                                 M3-9, M3-10); settings/:tab falls back to /profile
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
                      <TargetSelectionProvider>
                        <AppShell />
                      </TargetSelectionProvider>
                    </ConnectionsStoreProvider>
                  </PostStoreProvider>
                ),
                children: [
                  { index: true, element: <Navigate to="/dashboard" replace /> },
                  { path: 'performance', element: <CampaignAnalyticsView /> },
                  { path: 'dashboard', element: <DashboardView /> },
                  { path: 'content', element: <ContentStudioView /> },
                  { path: 'calendar', element: <CalendarView /> },
                  { path: 'settings', element: <Navigate to="/settings/profile" replace /> },
                  { path: 'settings/profile', element: <BusinessProfileSettings /> },
                  { path: 'settings/platforms', element: <PlatformsSettings /> },
                  { path: 'settings/workspace', element: <WorkspaceSettings /> },
                  // An unrecognized settings/:tab falls back to Profile rather
                  // than a dead end — the three explicit routes above always
                  // win first since react-router matches static segments
                  // before this catch-all.
                  { path: 'settings/:tab', element: <Navigate to="/settings/profile" replace /> },
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
