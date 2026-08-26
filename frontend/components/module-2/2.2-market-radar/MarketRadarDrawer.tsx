/**
 * CARD — Foundation: Dashboard & Radar Shell
 * Screen doc: docs/module-2/screens/market-radar-drawer.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 *
 * Overlay on /dashboard?market=<id> — deliberately NOT its own route. The
 * operator arrived by drilling into one market from one alert's ranked list,
 * and a drawer keeps that context (the feed, the other ranked markets) visible
 * and one click away behind the scrim. Carrying the market in the URL also
 * makes it linkable and survives a refresh.
 *
 * No fetch on open: the Dashboard has already loaded the markets, so this is a
 * pure lookup (`marketById`), per the screen doc.
 *
 * It carries its own market switcher because it physically covers the ranked
 * list it was opened from — the drawer spans the right 560px, the rank cards
 * sit inside that, so once it is open those cards cannot be clicked at all.
 * Without a switcher, comparing two markets meant closing, re-reading the list
 * and reopening.
 *
 * The shell owns `timeframe` and `activeTab` because the two body slots are
 * siblings that must not reset each other — switching tabs has to leave the
 * chart's timeframe alone. Both DO reset when the market changes, so opening a
 * second market never inherits the first one's state.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Plane } from 'lucide-react';
import Drawer from '../../shared/Drawer';
import DrawerChartPanel from './DrawerChartPanel';
import InsightsTabs from './InsightsTabs';
import RouteCarriers from './RouteCarriers';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import type { InsightsTab, Timeframe } from './radarTypes';

interface MarketRadarDrawerProps {
  /** Called by "Target this market" — the Dashboard owns the navigation. */
  onTargetMarket?: (marketId: string) => void;
}

export default function MarketRadarDrawer({ onTargetMarket }: MarketRadarDrawerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const marketId = searchParams.get('market');

  const [timeframe, setTimeframe] = useState<Timeframe>('4WK');
  const [activeTab, setActiveTab] = useState<InsightsTab>('economy');

  // An unknown id is treated as closed rather than rendering an empty drawer.
  const market = marketId ? MOCK_MARKETS.find((m) => m.id === marketId) ?? null : null;
  const open = market != null;

  // Reset per market, not per open: reopening the same market keeps where you
  // were, but a different market starts from its own defaults.
  useEffect(() => {
    setTimeframe('4WK');
    setActiveTab('economy');
  }, [marketId]);

  function close() {
    // Drops only `market`, so any other query state on /dashboard survives.
    const next = new URLSearchParams(searchParams);
    next.delete('market');
    setSearchParams(next);
  }

  if (!market) return <Drawer open={false} onClose={close}>{null}</Drawer>;

  return (
    <Drawer
      open={open}
      onClose={close}
      label={`${market.name} market radar`}
      // Pinned rather than sitting in the header: the decision to target a
      // market is made after reading the forecast, the economics and the route,
      // all of which are below the fold.
      footer={
        <button
          type="button"
          className="btn-cta w-full"
          onClick={() => {
            onTargetMarket?.(market.id);
            close();
          }}
        >
          Target this market <ArrowRight size={16} aria-hidden="true" />
        </button>
      }
    >
      <header className="radar-head">
        {/* Switching here rather than behind the drawer, which covers the rank
            cards entirely. Ordered by rank, so it mirrors the list it replaces. */}
        <div className="radar-switch" role="group" aria-label="Switch market">
          {MOCK_MARKETS.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={m.id === market.id}
              onClick={() => setSearchParams({ market: m.id })}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="radar-head-top">
          <span className="rank-no" data-lead={market.rank === 1}>
            {market.rank}
          </span>
          <div className="min-w-0">
            <h2 className="heading-md">{market.name}</h2>
            <p className="text-meta">
              {market.city} · {market.distanceKm.toLocaleString()} km · {market.flightHours}
              {market.directFlight ? ' direct' : ' via Manila'}
            </p>
          </div>
        </div>

        <p className="radar-route text-meta">
          <Plane size={14} aria-hidden="true" />
          {market.nearestAirport} → {market.destinationAirport}
        </p>
      </header>

      <DrawerChartPanel
        market={market}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
      />

      <InsightsTabs market={market} activeTab={activeTab} onTabChange={setActiveTab} />

      <RouteCarriers market={market} />
    </Drawer>
  );
}
