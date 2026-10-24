import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom';
import AuthGate, { RedirectIfAuthenticated } from './components/auth/AuthGate';
import EmailVerificationGate from './components/auth/EmailVerificationGate';
import ProfileCompletionGate from './components/auth/ProfileCompletionGate';
import AppShell from './layout/AppShell';
import { ProfileProvider, ProfileGate } from './services/profileContext';
import { OverlayStackProvider } from './components/shared/useOverlayStack';
import { ToastProvider } from './components/shared/Toast';
import { ObDraftProvider, DEMO_OB_DRAFT } from './components/module-1/onboarding/obDraft';
import { PostStoreProvider } from './services/postStore';
import { ConnectionsStoreProvider } from './services/connectionsStore';
import { TargetSelectionProvider } from './services/targetSelectionStore';
import { UnreadAlertsProvider } from './services/unreadAlertsStore';
import { ForecastStoreProvider } from './services/forecastStore';
import { DEMO_PROFILE } from './services/fixtures/profile';
import type { DashMode } from './components/module-2/2.1-dashboard/useDashboardState';
import { DEMO_DRAFT, DEMO_BOARD_POSTS, DEMO_TARGET } from './components/module-3/3.1-content-studio/previewFixtures';
import LandingPage from './components/LandingPage';

/**
 * Screens behind the landing page load on demand, so a visitor to "/" only
 * downloads the landing page. Each is wrapped in its own Suspense boundary
 * (`page`), so loading one never blanks the shell around it.
 */
const LoginPage = lazy(() => import('./components/auth/LoginPage'));
const VerifyEmailPage = lazy(() => import('./components/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./components/auth/ForgotPasswordPage'));
const CompleteProfilePage = lazy(() => import('./components/auth/CompleteProfilePage'));
const OnboardingWizard = lazy(() => import('./components/module-1/onboarding/OnboardingWizard'));
const AssetsLinksStep = lazy(() => import('./components/module-1/onboarding/steps/AssetsLinksStep'));
const CampaignAnalyticsView = lazy(() => import('./components/module-4/4.1-campaign-analytics/CampaignAnalyticsView'));
const EnquiryPage = lazy(() => import('./components/module-4/enquiries/EnquiryPage'));
// The public interactive demo — its own chunk, loaded only when a visitor opens it.
const loadDemo = () => import('./components/demo/DemoRoot');
const DemoRoot = lazy(loadDemo);
const DemoDashboard = lazy(() => loadDemo().then((m) => ({ default: m.DemoDashboard })));
const DemoContentStudio = lazy(() => loadDemo().then((m) => ({ default: m.DemoContentStudio })));
const DemoCalendar = lazy(() => loadDemo().then((m) => ({ default: m.DemoCalendar })));
const DemoPerformance = lazy(() => loadDemo().then((m) => ({ default: m.DemoPerformance })));
const DemoBusinessProfile = lazy(() => loadDemo().then((m) => ({ default: m.DemoBusinessProfile })));
// Terms of Use and Privacy Notice — public, readable signed in or out.
const TermsPage = lazy(() => import('./components/legal/LegalPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('./components/legal/LegalPage').then((m) => ({ default: m.PrivacyPage })));
const DashboardView = lazy(() => import('./components/module-2/2.1-dashboard/DashboardView'));
const ContentStudioView = lazy(() => import('./components/module-3/3.1-content-studio/ContentStudioView'));
const CalendarView = lazy(() => import('./components/module-3/3.2-calendar/CalendarView'));
const BusinessProfileSettings = lazy(() => import('./components/settings/BusinessProfileSettings'));
const PlatformsSettings = lazy(() => import('./components/settings/PlatformsSettings'));
const WorkspaceSettings = lazy(() => import('./components/settings/WorkspaceSettings'));

const page = (element: ReactNode) => <Suspense fallback={null}>{element}</Suspense>;

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
            {page(<OnboardingWizard />)}
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
              {page(<AssetsLinksStep />)}
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
        // Module 3 previews intentionally bypass auth/profile gates -- but not
        // the shell. Mounting AppShell here means the preview exercises the real
        // chrome (sidebar, topbar, the minmax(0, 1fr) content track and the
        // shared overlay scrim) rather than a bare full-width viewport, so a
        // panel that overflows at /content overflows here too. The stores are
        // mounted for the same reason: usePosts()/useConnections() throw outside
        // their provider, so without them these routes would start failing the
        // moment a Module 3 screen wires up to publish(). Matches
        // DashboardPreviewShell below. DEV-only, so production users still enter
        // through the gated tree.
        //
        // TargetSelectionProvider is seeded rather than merely mounted:
        // ContentStudioView gates its whole screen behind an explicit surge +
        // market pick, so an empty provider would leave every preview stuck on
        // step 1 of the picker with none of the panels reachable.
        path: '/preview',
        element: (
          <ProfileProvider initial={DEMO_PROFILE}>
            <PostStoreProvider initial={DEMO_BOARD_POSTS}>
              <ConnectionsStoreProvider>
                <TargetSelectionProvider initial={DEMO_TARGET}>
                  <AppShell />
                </TargetSelectionProvider>
              </ConnectionsStoreProvider>
            </PostStoreProvider>
          </ProfileProvider>
        ),
        children: [
          { path: 'content', element: <ContentPreviewScreen /> },
          { path: 'calendar', element: page(<CalendarView />) },
          { path: 'performance', element: page(<CampaignAnalyticsView />) },
          { path: 'settings/profile', element: page(<BusinessProfileSettings />) },
          { path: 'settings/platforms', element: page(<PlatformsSettings />) },
          { path: 'settings/workspace', element: page(<WorkspaceSettings />) },
        ],
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

/**
 * DEV-ONLY. Content Studio with its composer pre-staged, so the publish and
 * compliance panels are reachable without a login or a file picker. The
 * profile is seeded one level up, on the /preview shell, because every screen
 * under it needs one — Content Studio will not generate captions against an
 * empty businessName.
 */
function ContentPreviewScreen() {
  // Posts come from the preview's PostStoreProvider (seeded with the demo
  // board), so what is scheduled here also shows on /preview/calendar.
  return page(<ContentStudioView initialDraft={DEMO_DRAFT} />);
}

/** DEV-ONLY. Maps the :mode segment onto the dashboard's state machine. */
const FORCEABLE_MODES: DashMode[] = ['loading', 'empty', 'ai-down'];

function DashboardPreviewScreen() {
  const { mode } = useParams();
  const forceMode = FORCEABLE_MODES.find((m) => m === mode);
  return page(<DashboardView forceMode={forceMode} />);
}

/**
 * Route tree:
 *   /login, /forgot-password     - public (redirect to the app when already signed in)
 *   (AuthGate: redirects to /login when unauthenticated)
 *     /verify-email              - enter the emailed 6-digit code; deliberately OUTSIDE
 *                                  EmailVerificationGate, which redirects here
 *     (EmailVerificationGate: redirects to /verify-email until the email is verified)
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
  { path: '/', element: <RedirectIfAuthenticated><LandingPage /></RedirectIfAuthenticated> },
  { path: '/enquiry', element: page(<EnquiryPage />) },
  {
    // Public interactive demo: the real screens on sample data, no account.
    // Outside every auth gate; never talks to the backend (services/demoMode.ts).
    path: '/demo',
    element: page(<DemoRoot />),
    children: [
      { index: true, element: page(<DemoDashboard />) },
      { path: 'content', element: page(<DemoContentStudio />) },
      { path: 'calendar', element: page(<DemoCalendar />) },
      { path: 'performance', element: page(<DemoPerformance />) },
      { path: 'settings/profile', element: page(<DemoBusinessProfile />) },
      { path: '*', element: <Navigate to="/demo" replace /> },
    ],
  },
  { path: '/terms', element: page(<TermsPage />) },
  { path: '/privacy', element: page(<PrivacyPage />) },
  { path: '/login', element: <RedirectIfAuthenticated>{page(<LoginPage />)}</RedirectIfAuthenticated> },
  { path: '/forgot-password', element: <RedirectIfAuthenticated>{page(<ForgotPasswordPage />)}</RedirectIfAuthenticated> },
  {
    element: <AuthGate />,
    children: [
      { path: 'verify-email', element: page(<VerifyEmailPage />) },
      {
        element: <EmailVerificationGate />,
        children: [
      {
        element: <ProfileCompletionGate />,
        children: [
          { path: 'complete-profile', element: page(<CompleteProfilePage />) },
          {
            element: <ProfileGate />,
            children: [
              {
                path: 'onboarding',
                element: (
                  <ObDraftProvider>
                    {page(<OnboardingWizard />)}
                  </ObDraftProvider>
                ),
              },
              {
                element: (
                  <UnreadAlertsProvider>
                    <PostStoreProvider>
                      <ConnectionsStoreProvider>
                        <TargetSelectionProvider>
                          {/* Loads the forecast as soon as the operator is in the app (right
                              after login) and keeps it across navigation; AuthGate unmounts it
                              on logout. Also publishes the sidebar's unread badge. */}
                          <ForecastStoreProvider>
                            <AppShell />
                          </ForecastStoreProvider>
                        </TargetSelectionProvider>
                      </ConnectionsStoreProvider>
                    </PostStoreProvider>
                  </UnreadAlertsProvider>
                ),
                // No `{ index: true, ... }` route here on purpose. AuthGate,
                // ProfileCompletionGate, ProfileGate and this providers-wrapper
                // are all pathless layout routes, so an index child here would
                // match the bare "/" path too — colliding with the explicit
                // `{ path: '/', element: <RedirectIfAuthenticated><LandingPage />... }`
                // route above and winning the match. That used to send every
                // unauthenticated visit to "/" straight through AuthGate's own
                // redirect to /login, so the landing page was never reachable.
                // RedirectIfAuthenticated on the "/" route already sends a
                // logged-in visitor to /dashboard, so nothing here needs to.
                children: [
                  { path: 'performance', element: page(<CampaignAnalyticsView />) },
                  { path: 'dashboard', element: page(<DashboardView />) },
                  { path: 'content', element: page(<ContentStudioView />) },
                  { path: 'calendar', element: page(<CalendarView />) },
                  { path: 'settings', element: <Navigate to="/settings/profile" replace /> },
                  { path: 'settings/profile', element: page(<BusinessProfileSettings />) },
                  { path: 'settings/platforms', element: page(<PlatformsSettings />) },
                  { path: 'settings/workspace', element: page(<WorkspaceSettings />) },
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
