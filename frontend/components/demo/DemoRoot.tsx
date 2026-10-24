/**
 * /demo — the public interactive demo. The real CeView shell and screens,
 * running on sample data for a fictional business, with no account.
 *
 * Safety (see services/demoMode.ts): while this is mounted, apiClient answers
 * from demoApi.ts in the browser or refuses; nothing reaches the backend and
 * no sign-in token is sent. Demo mode is switched on during render — so even
 * the first data request of the first screen is covered — and off when the
 * visitor leaves. Every store here is a fresh, seeded instance, separate from
 * a signed-in operator's own.
 *
 * Screens: Dashboard (/demo), Content Studio, Calendar, Performance and the
 * Business Profile. Platforms and Workspace need a real account; the sidebar
 * shows them locked.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import { ShellModeProvider } from '../../layout/shellContext';
import { activateDemo, deactivateDemo } from '../../services/demoMode';
import { ProfileProvider } from '../../services/profileContext';
import { PostStoreProvider } from '../../services/postStore';
import { ConnectionsStoreProvider } from '../../services/connectionsStore';
import { TargetSelectionProvider } from '../../services/targetSelectionStore';
import { DEMO_PROFILE } from '../../services/fixtures/profile';
import { DEFAULT_CAMPAIGN_INPUT } from '../../services/fixtures/campaign';
import { DEMO_BOARD_POSTS, DEMO_DRAFT, DEMO_TARGET } from '../module-3/3.1-content-studio/previewFixtures';
import { lastCompleteWeek } from '../module-4/4.1-campaign-analytics/dateRange';
import type { StudioStepId } from '../module-3/3.1-content-studio/studioSteps';
import { useToast } from '../shared/Toast';
import { track } from '../../services/analytics';
import { createDemoApi, resetDemoAdScope } from './demoApi';
import DemoBar from './DemoBar';
import { DemoIntro, DemoTour } from './DemoTour';
import { TOUR_STEPS } from './tourSteps';
import './demo.css';

const DashboardView = lazy(() => import('../module-2/2.1-dashboard/DashboardView'));
const ContentStudioView = lazy(() => import('../module-3/3.1-content-studio/ContentStudioView'));
const CalendarView = lazy(() => import('../module-3/3.2-calendar/CalendarView'));
const CampaignAnalyticsView = lazy(() => import('../module-4/4.1-campaign-analytics/CampaignAnalyticsView'));
const BusinessProfileSettings = lazy(() => import('../settings/BusinessProfileSettings'));

const page = (element: ReactNode) => <Suspense fallback={<p className="dm-loading">Loading…</p>}>{element}</Suspense>;

const INTRO_KEY = 'ceview.demo.introSeen';
/** The demo business's browser-stored extras, cleared by Reset. */
const DEMO_STORAGE_KEYS = [`ceview.coverPhoto.${DEMO_PROFILE.businessProfileId}`];

function readIntroSeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_KEY) === '1';
  } catch {
    return false;
  }
}

/** Which product area a demo path belongs to, for the exploration event. */
function featureOf(pathname: string): string {
  if (pathname.startsWith('/demo/content')) return 'content_studio';
  if (pathname.startsWith('/demo/calendar')) return 'calendar';
  if (pathname.startsWith('/demo/performance')) return 'performance';
  if (pathname.startsWith('/demo/settings')) return 'business_profile';
  return 'demand_intelligence';
}

export function DemoDashboard() {
  return page(<DashboardView />);
}

export function DemoContentStudio() {
  // ?step=validate opens Quick Post on that step (the tour uses it). Keyed on
  // the step so following the tour there opens it even if already on /content.
  const [params] = useSearchParams();
  const step = params.get('step');
  const initialStep: StudioStepId | undefined = step === 'attach' || step === 'validate' ? step : undefined;
  return page(<ContentStudioView key={step ?? 'draft'} initialDraft={DEMO_DRAFT} initialStep={initialStep} />);
}

export function DemoCalendar() {
  return page(<CalendarView />);
}

export function DemoPerformance() {
  // Opens on results for last week's sample figures; "New submission" shows the form.
  return page(
    <CampaignAnalyticsView
      initialSubmission={{ input: DEFAULT_CAMPAIGN_INPUT, context: { period: lastCompleteWeek(), currency: '₱' } }}
    />,
  );
}

export function DemoBusinessProfile() {
  return page(<BusinessProfileSettings />);
}

export default function DemoRoot() {
  const apiRef = useRef<ReturnType<typeof createDemoApi> | null>(null);
  if (!apiRef.current) apiRef.current = createDemoApi();
  // During render, before any child effect can request data.
  activateDemo(apiRef.current);

  useEffect(() => {
    const api = apiRef.current!;
    activateDemo(api);
    return () => deactivateDemo(api);
  }, []);

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { showToast } = useToast();
  const [resetKey, setResetKey] = useState(0);
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const [introSeen, setIntroSeen] = useState(readIntroSeen);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Interactive demo — CeView';
    track('demo_opened');
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    track('demo_feature_explored', { feature: featureOf(pathname) });
  }, [pathname]);

  const seeIntro = () => {
    setIntroSeen(true);
    try {
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      // Storage blocked: the welcome card may show again next visit.
    }
  };

  const startTour = () => {
    seeIntro();
    setTourIndex(0);
    track('demo_guided_tour_started');
  };

  const exitTour = useCallback(() => setTourIndex(null), []);

  const reset = () => {
    resetDemoAdScope();
    for (const key of DEMO_STORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Nothing stored, or storage blocked.
      }
    }
    setTourIndex(null);
    setResetKey((k) => k + 1);
    navigate('/demo');
    showToast('Demo reset — everything is back to the starting sample.');
    track('demo_reset');
  };

  return (
    <ShellModeProvider value={{ demo: true }}>
      {/* Keyed so Reset rebuilds every store from its seed. */}
      <ProfileProvider key={resetKey} initial={DEMO_PROFILE}>
        <PostStoreProvider initial={DEMO_BOARD_POSTS}>
          <ConnectionsStoreProvider>
            <TargetSelectionProvider initial={DEMO_TARGET}>
              <AppShell
                banner={
                  <DemoBar
                    touring={tourIndex !== null}
                    onTour={() => (tourIndex === null ? startTour() : exitTour())}
                    onReset={reset}
                  />
                }
              />
            </TargetSelectionProvider>
          </ConnectionsStoreProvider>
        </PostStoreProvider>
      </ProfileProvider>

      {tourIndex !== null ? (
        <DemoTour index={tourIndex} onIndex={(i) => setTourIndex(Math.max(0, Math.min(TOUR_STEPS.length - 1, i)))} onExit={exitTour} />
      ) : (
        !introSeen && <DemoIntro onTour={startTour} onExplore={seeIntro} />
      )}
    </ShellModeProvider>
  );
}
