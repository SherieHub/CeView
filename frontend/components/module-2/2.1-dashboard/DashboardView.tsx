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
import { useSearchParams } from 'react-router-dom';
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

interface DashboardViewProps {
  /** Dev-preview only — pins the state machine to one mode. */
  forceMode?: DashMode;
}

export default function DashboardView({ forceMode }: DashboardViewProps) {
  const { profile } = useProfile();
  const [, setSearchParams] = useSearchParams();
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

  return (
    <>
      <PageHead
        title={`Good morning${profile.businessName ? `, ${profile.businessName}` : ''}`}
        subtitle={subtitle}
        actions={
          <>
            {profile.uniquenessScore != null ? (
              <span className="chip chip--attention">
                <Award aria-hidden="true" /> Uniqueness {profile.uniquenessScore}
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
    </>
  );
}
