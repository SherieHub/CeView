/**
 * CARD — Foundation: Dashboard & Radar Shell
 * Screen doc: docs/module-2/screens/dashboard.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 *
 * Route: /dashboard — replaces the legacy HomeView.tsx.
 *
 * A master/detail alert command center: alerts scoped to the operator's own
 * business categories, and selecting one reveals a market ranking computed for
 * THAT alert's category. Purely compositional — all state lives in
 * useDashboardState, all rendering in the slot components.
 *
 * The two-column grid is reserved rather than toggled. The prototype swapped
 * between a one- and two-column layout on selection, which resized every card
 * and moved the one just clicked out from under the cursor.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Info } from 'lucide-react';
import '@fontsource-variable/fraunces/opsz.css';
import { LandingImage } from '../../landing/ui';
import CoverPhotoMenu from './CoverPhotoMenu';
import { useCoverPhoto } from './useCoverPhoto';
import PageHead from '../../../layout/PageHead';
import { useProfile } from '../../../services/profileContext';
import { useTargetSelection } from '../../../services/targetSelectionStore';
import { isSurge } from '../../../types';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import { StaleDataBanner } from '../../shared/StaleDataBanner';
import { useDashboardState } from './useDashboardState';
import type { DashMode } from './useDashboardState';
import AlertFeed from './AlertFeed';
import TrendingBusinessTypes from './TrendingBusinessTypes';
import AiStatusBanner from './AiStatusBanner';
import MarketsRevealPanel from './MarketsRevealPanel';
import RefreshForecastButton from './RefreshForecastButton';
import ForecastFreshness from './ForecastFreshness';
import SignalSummary from './SignalSummary';
import PhilippineRegionsPanel from './PhilippineRegionsPanel';
import MarketRadarDrawer from '../2.2-market-radar/MarketRadarDrawer';
import { useJustOnboardedTutorial } from './useJustOnboardedTutorial';
import TutorialModal from '../../shared/TutorialModal';
import EnquiryInbox from '../../module-4/enquiries/EnquiryInbox';
import QuickLogBooking from '../../module-4/4.1-campaign-analytics/QuickLogBooking';

interface DashboardViewProps {
  /** Dev-preview only — pins the state machine to one mode. */
  forceMode?: DashMode;
}

export default function DashboardView({ forceMode }: DashboardViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const marketPanelsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    const panels = marketPanelsRef.current;
    if (!grid || !panels || typeof ResizeObserver === 'undefined') return;
    const updateHeight = () => {
      const height = panels.getBoundingClientRect().height;
      if (height > 0) grid.style.setProperty('--alert-panel-max-height', `${height}px`);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(panels);
    return () => observer.disconnect();
  }, []);
  const { profile } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = useDashboardState({ forceMode });
  const { setTarget } = useTargetSelection();
  const tutorial = useJustOnboardedTutorial();
  const cover = useCoverPhoto(profile.businessProfileId);
  // Shared by the Philippine summary tile and the regions panel's rows.
  const [activeRegion, setActiveRegion] = useState<string | null>(null);

  // The radar drawer reads ?market=<id>, so it is linkable and the browser back
  // button closes it. See 03-module-2.md's M2-F card.
  function openMarket(marketId: string) {
    setSearchParams({ market: marketId });
  }

  const degraded = state.mode === 'ai-down';

  const subtitle =
    state.mode === 'loading'
      ? 'Loading your latest surge alerts…'
      : state.mode === 'empty'
        ? 'No forecast data yet — run your first analysis to start receiving alerts.'
        : state.myAlerts.length === 0
          ? 'No surge alerts match your business categories right now.'
          : 'Select an alert to see the markets ranked for its category.';

  // The radar is a right-hand overlay and the markets column is a right-hand
  // column, so the drawer covered it completely at every desktop width — its
  // rank cards were on screen but unclickable. The screen steps aside instead.
  const radarOpen = searchParams.get('market') != null;

  return (
    <div className="dash-screen" data-radar-open={radarOpen}>
      <div className="dash-hero">
        <div className="dash-hero-photo" aria-hidden="true">
          {cover.custom ? (
            <img className="cv-img cv-img--fill" src={cover.custom} alt="" />
          ) : (
            <LandingImage slot="product-malapascua-beach" fill decorative sizes="70vw" />
          )}
        </div>
        <CoverPhotoMenu isCustom={cover.custom != null} onPick={cover.setFromFile} onReset={cover.reset} />
      <PageHead
        title={
          profile.businessName ? (
            <>
              Good morning,
              <br />
              {profile.businessName}
            </>
          ) : (
            'Good morning'
          )
        }
        subtitle={subtitle}
        actions={
          <>
            {profile.uniquenessScore != null ? (
              /* A raised disc carrying the figure, overlapping the left end of
                 an outlined capsule that names it. The score is the one number
                 on this screen that describes the operator rather than the
                 market, so it gets its own object rather than another chip in
                 the row — and the disc is what makes it read as a score rather
                 than a label with a number after it. */
              <span className="score-badge">
                {/* Stored 0–1 (matches the DB column); formatted to a human
                    0–100 figure only here, at the display edge. */}
                <b className="score-badge-disc num">{Math.round(profile.uniquenessScore * 100)}</b>
                <span className="score-badge-body">
                  <span className="score-badge-label">Uniqueness</span>
                  <Info className="score-badge-glyph" size={15} strokeWidth={1.75} aria-hidden="true" />
                </span>
              </span>
            ) : (
              <span className="chip chip--attention">
                <AlertTriangle aria-hidden="true" /> Demo profile — scores not computed
              </span>
            )}
            <RefreshForecastButton
              isRefreshing={state.isRefreshing}
              degraded={degraded}
              onRefresh={state.refresh}
            />
            {state.mode !== 'loading' && (
              <ForecastFreshness
                syncing={state.syncing}
                isRefreshing={state.isRefreshing}
                refreshError={state.refreshError}
                generatedAt={state.generatedAt}
                fetchedAt={state.fetchedAt}
              />
            )}
          </>
        }
      />
      </div>

      {/* Step 17 (C-19/C-20): Retry re-runs only the initial load — never the
          forecast pipeline. Only the Refresh button above (state.refresh)
          runs analyze(); conflating the two meant a stuck "no data yet"
          error silently kicked off a full pipeline run on every retry. */}
      {state.error != null && <ApiErrorPanel error={state.error} label="Dashboard" onRetry={state.retry} />}

      <AiStatusBanner visible={degraded} />

      <SignalSummary
        loading={state.mode === 'loading'}
        degraded={degraded}
        unreadCount={state.unreadCount}
        surgeCount={state.surgeCount}
        surgeMarkets={state.surgeMarkets}
        topMarket={state.topMarket}
        onOpenRegion={setActiveRegion}
        onOpenMarket={(marketId) => {
          // Step 18 (C-21/C-22/C-23): pin the category BEFORE navigating so
          // rankedMarkets loads it — otherwise the drawer looks marketId up in
          // whatever rankedMarkets already held (empty with no alert selected)
          // and silently never opens.
          if (state.topMarket) state.pinCategory(state.topMarket.category);
          openMarket(marketId);
        }}
      />

      {/* Step 18 (H-11): used to be evaluated only from rankedMarkets, which is
          empty until an alert is selected — a stale dashboard looked fresh
          until you clicked something. topMarket now carries its own staleness
          (loaded independently of any alert selection), so this fires on a
          cold dashboard too; rankedMarkets is still checked for the alert-
          selected case, where its data can differ from topMarket's category. */}
      {(state.topMarket?.dataStale || state.rankedMarkets.some((m) => m.dataStale)) && (
        <StaleDataBanner
          dataAsOf={
            state.topMarket?.dataStale
              ? state.topMarket.dataAsOf
              : (state.rankedMarkets.find((m) => m.dataStale)?.dataAsOf ?? null)
          }
          cause={
            state.topMarket?.dataStale
              ? (state.topMarket.dataStaleCause ?? undefined)
              : (state.rankedMarkets.find((m) => m.dataStale)?.dataStaleCause ?? undefined)
          }
          now={new Date()}
        />
      )}

      <div className="dash-grid" ref={gridRef}>
        <AlertFeed
          mode={state.mode}
          alerts={state.myAlerts}
          hideFilters
          totalForProfile={state.myAlerts.length}
          categories={profile.categories}
          selectedAlertId={state.selectedAlertId}
          isRead={state.isRead}
          onSelect={state.selectAlert}
          filter="all"
          onFilterChange={state.setFeedFilter}
          unreadCount={state.unreadCount}
          surgeCount={state.surgeCount}
        />

        <div className="dash-market-panels" ref={marketPanelsRef}>
        {/* Hidden in the states where there is nothing to rank against. */}
        {state.mode !== 'loading' && state.mode !== 'empty' && state.myAlerts.length > 0 && (
          <MarketsRevealPanel
            selectedAlert={state.selectedAlert}
            markets={state.rankedMarkets}
            onOpenMarket={openMarket}
          />
        )}
        <PhilippineRegionsPanel
          selectedAlert={state.selectedAlert}
          fallbackCategory={state.topMarket?.category ?? null}
          activeRegionName={activeRegion}
          onActiveRegionChange={setActiveRegion}
        />
        </div>
      </div>

      {/* Staff land here, so the booking quick-log sits beside the enquiries it complements. */}
      {profile.businessProfileId && <QuickLogBooking key={`log-${profile.businessProfileId}`} />}
      {profile.businessProfileId && <EnquiryInbox key={profile.businessProfileId} />}

      <TrendingBusinessTypes />

      {/* Overlay, not a route — see MarketRadarDrawer's header. It reads
          ?market= itself, so mounting it unconditionally is correct: with no
          market in the URL it renders closed. */}
      <MarketRadarDrawer
        markets={state.rankedMarkets}
        onTargetMarket={(marketId) => {
          // "Target this market" only means anything alongside the surge alert
          // whose category produced this ranked list — the radar drawer only
          // ever opens from state.rankedMarkets, so both are always present
          // here. Content Studio refuses to render without both (see
          // ContentStudioView), so an incomplete pick is never written.
          const market = state.rankedMarkets.find((m) => m.id === marketId);
          // Opened from the Top International Market tile there is no selected
          // alert, so the pick used to be dropped and Content Studio fell back
          // to its picker. Use the operator's own alert for this category —
          // this market's, then a surge, then any — so the click lands on
          // Quick Post with the market already chosen. Never invents an alert:
          // with none for the category, the picker still asks.
          const category = state.selectedAlert?.category ?? state.topMarket?.category ?? null;
          const inCategory = state.myAlerts.filter((a) => a.category === category);
          const alert =
            state.selectedAlert ??
            inCategory.find((a) => a.marketId === marketId) ??
            inCategory.find(isSurge) ??
            inCategory[0] ??
            null;
          if (alert && market) setTarget(alert, market);
          navigate('/content');
        }}
      />
      <TutorialModal open={tutorial.open} onClose={tutorial.close} />
    </div>
  );
}
