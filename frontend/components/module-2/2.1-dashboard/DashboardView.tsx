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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Award, AlertTriangle } from 'lucide-react';
import PageHead from '../../../layout/PageHead';
import { useProfile } from '../../../services/profileContext';
import { useDashboardState } from './useDashboardState';
import type { DashMode } from './useDashboardState';
import AlertFeed from './AlertFeed';
import AiStatusBanner from './AiStatusBanner';
import MarketsRevealPanel from './MarketsRevealPanel';
import RefreshForecastButton from './RefreshForecastButton';
import SignalSummary from './SignalSummary';
import MarketRadarDrawer from '../2.2-market-radar/MarketRadarDrawer';

interface DashboardViewProps {
  /** Dev-preview only — pins the state machine to one mode. */
  forceMode?: DashMode;
}

export default function DashboardView({ forceMode }: DashboardViewProps) {
  const { profile } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const state = useDashboardState({ forceMode });

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
      <PageHead
        title={`Good morning${profile.businessName ? `, ${profile.businessName}` : ''}`}
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
                <b className="score-badge-disc num">{profile.uniquenessScore}</b>
                <span className="score-badge-body">
                  <span className="score-badge-label">Uniqueness</span>
                  <Award className="score-badge-glyph" size={15} strokeWidth={1.75} aria-hidden="true" />
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
          </>
        }
      />

      <AiStatusBanner visible={degraded} />

      <SignalSummary
        loading={state.mode === 'loading'}
        degraded={degraded}
        unreadCount={state.unreadCount}
        surgeCount={state.surgeCount}
        surgeMarkets={state.surgeMarkets}
        topMarket={state.topMarket}
        onOpenMarket={openMarket}
      />

      <div className="dash-grid">
        <AlertFeed
          mode={state.mode}
          alerts={state.visibleAlerts}
          totalForProfile={state.myAlerts.length}
          categories={profile.categories}
          selectedAlertId={state.selectedAlertId}
          isRead={state.isRead}
          onSelect={state.selectAlert}
          filter={state.feedFilter}
          onFilterChange={state.setFeedFilter}
          unreadCount={state.unreadCount}
          surgeCount={state.surgeCount}
        />

        {/* Hidden in the states where there is nothing to rank against. */}
        {state.mode !== 'loading' && state.mode !== 'empty' && state.myAlerts.length > 0 && (
          <MarketsRevealPanel
            selectedAlert={state.selectedAlert}
            markets={state.rankedMarkets}
            onOpenMarket={openMarket}
          />
        )}
      </div>

      {/* Overlay, not a route — see MarketRadarDrawer's header. It reads
          ?market= itself, so mounting it unconditionally is correct: with no
          market in the URL it renders closed. */}
      <MarketRadarDrawer onTargetMarket={() => navigate('/content')} />
    </div>
  );
}
