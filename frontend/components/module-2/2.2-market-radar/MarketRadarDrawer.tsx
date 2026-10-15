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
 *
 * The body itself is RadarDrawerView, shared with the Philippine regions'
 * drawer; this component only binds it to ?market=.
 */
import { useSearchParams } from 'react-router-dom';
import MarketFlagIcon from '../2.1-dashboard/MarketFlagIcon';
import RadarDrawerView from './RadarDrawerView';
import type { Market } from '@/types';

interface MarketRadarDrawerProps {
  /**
   * Markets to switch between and look the open one up in — the Dashboard has
   * already loaded these (the selected alert's ranked markets), so the drawer
   * does its own lookup rather than re-fetching.
   */
  markets: Market[];
  /** Called by "Target this market" — the Dashboard owns the navigation. */
  onTargetMarket?: (marketId: string) => void;
}

export default function MarketRadarDrawer({ markets, onTargetMarket }: MarketRadarDrawerProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const marketId = searchParams.get('market');

  // An unknown id is treated as closed rather than rendering an empty drawer.
  const market = marketId ? markets.find((m) => m.id === marketId) ?? null : null;

  function close() {
    // Drops only `market`, so any other query state on /dashboard survives.
    const next = new URLSearchParams(searchParams);
    next.delete('market');
    setSearchParams(next);
  }

  return (
    <RadarDrawerView
      markets={markets}
      market={market}
      onSelect={(id) => setSearchParams({ market: id })}
      onClose={close}
      renderIcon={(m) => <MarketFlagIcon name={m.name} />}
      dialogLabel={(m) => `${m.name} market radar`}
      onTarget={(id) => onTargetMarket?.(id)}
    />
  );
}
