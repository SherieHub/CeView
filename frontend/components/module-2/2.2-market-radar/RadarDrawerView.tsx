/**
 * The radar drawer's body, independent of where its state lives: switcher,
 * header, planning signals + demand forecast, insights tabs, route &
 * carriers, and the pinned "Target this market" action.
 *
 * MarketRadarDrawer drives it from ?market= for the international markets;
 * RegionRadarDrawer drives it from component state for the Philippine
 * regions, so both drawers are the same components laid out the same way.
 *
 * Owns `timeframe` and `activeTab` (see MarketRadarDrawer's header for why):
 * they survive tab switches but reset whenever the active market changes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowRight, Check, ChevronDown, Plane } from 'lucide-react';
import '@fontsource-variable/fraunces/opsz.css';
import Drawer from '../../shared/Drawer';
import { useDismiss } from '../../shared/useDismiss';
import DrawerChartPanel from './DrawerChartPanel';
import InsightsTabs from './InsightsTabs';
import RouteCarriers from './RouteCarriers';
import type { InsightsTab, Timeframe } from './radarTypes';
import type { Market } from '@/types';

export interface RadarDrawerViewProps {
  /** Ordered by rank; the switcher mirrors this list. */
  markets: Market[];
  /** The open one, or null for closed. */
  market: Market | null;
  onSelect: (marketId: string) => void;
  onClose: () => void;
  /** The icon beside each switcher entry: a flag, a region map… */
  renderIcon: (m: Market) => ReactNode;
  /** Names the dialog, e.g. "South Korea market radar". */
  dialogLabel: (m: Market) => string;
  /** "Target this market"; omitted renders it disabled with `targetUnavailable`. */
  onTarget?: (marketId: string) => void;
  /** Shown as the disabled action's reason when there is no `onTarget`. */
  targetUnavailable?: string;
  /** Optional note under the header (e.g. a preview-data disclosure). */
  notice?: ReactNode;
  /**
   * How to switch markets: a row of buttons (few markets) or a dropdown
   * (a list that can grow, like the Philippine regions).
   */
  switcher?: 'buttons' | 'dropdown';
  /** Names the switcher, e.g. "Switch region". */
  switcherLabel?: string;
}

/** The dropdown switcher: current market + chevron, opening a scrollable menu. */
function SwitcherDropdown({
  markets,
  market,
  onSelect,
  renderIcon,
  label,
}: {
  markets: Market[];
  market: Market;
  onSelect: (marketId: string) => void;
  renderIcon: (m: Market) => ReactNode;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(wrapRef, open, close, triggerRef);

  // Opening puts focus on the current entry, so arrow keys start from there.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  function onMenuKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }

  return (
    <div
      className="radar-select"
      ref={wrapRef}
      onKeyDown={(e) => {
        // Escape closes just this menu. Stopped here so it never reaches the
        // drawer's own Escape handling, which would close the whole drawer.
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          close();
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="radar-select-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${market.name}`}
        onClick={() => setOpen((o) => !o)}
      >
        {renderIcon(market)}
        <span className="radar-select-name">{market.name}</span>
        <ChevronDown size={18} strokeWidth={2} className="radar-select-caret" aria-hidden="true" />
      </button>
      {open && (
        <div className="radar-select-menu" role="menu" aria-label={label} ref={menuRef} onKeyDown={onMenuKey}>
          {markets.map((m) => (
            <button
              key={m.id}
              type="button"
              role="menuitemradio"
              aria-checked={m.id === market.id}
              onClick={() => {
                onSelect(m.id);
                close();
                triggerRef.current?.focus();
              }}
            >
              <span className="radar-select-rank">{m.rank}</span>
              {renderIcon(m)}
              <span className="radar-select-name">{m.name}</span>
              <span className="radar-select-score num">{m.matchScore}</span>
              {m.id === market.id ? <Check size={16} strokeWidth={2.25} aria-hidden="true" /> : <span />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RadarDrawerView({
  markets,
  market,
  onSelect,
  onClose,
  renderIcon,
  dialogLabel,
  onTarget,
  targetUnavailable,
  notice,
  switcher = 'buttons',
  switcherLabel = 'Switch market',
}: RadarDrawerViewProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('4WK');
  const [activeTab, setActiveTab] = useState<InsightsTab>('economy');
  const marketId = market?.id ?? null;

  // Reset per market, not per open: reopening the same market keeps where you
  // were, but a different market starts from its own defaults.
  useEffect(() => {
    setTimeframe('4WK');
    setActiveTab('economy');
  }, [marketId]);

  if (!market) return <Drawer open={false} onClose={onClose}>{null}</Drawer>;

  const hasDirectFlight = market.airlines.some((a) => a.direct);
  // A connecting market's flightHours can already spell out the routing
  // ("16h+ (via MNL)"); only add the qualifier when it hasn't.
  const routeAlreadyDescribed = /via/i.test(market.flightHours);

  return (
    <Drawer
      open
      onClose={onClose}
      label={dialogLabel(market)}
      // Pinned: the decision to target comes after reading everything below.
      footer={
        <button
          type="button"
          className="btn-cta w-full"
          disabled={!onTarget}
          title={!onTarget ? targetUnavailable : undefined}
          onClick={() => {
            if (!onTarget) return;
            // Close first: closing rewrites the opener's ?market= query, which
            // is itself a navigation — run after onTarget's, it sent the owner
            // straight back to the dashboard instead of on to Content Studio.
            onClose();
            onTarget(market.id);
          }}
        >
          Target this market <ArrowRight size={16} aria-hidden="true" />
        </button>
      }
    >
      <header className="radar-head">
        {/* Switching here rather than behind the drawer, which covers the rank
            rows it was opened from. Ordered by rank. */}
        {switcher === 'dropdown' ? (
          <SwitcherDropdown
            markets={markets}
            market={market}
            onSelect={onSelect}
            renderIcon={renderIcon}
            label={switcherLabel}
          />
        ) : (
          <div className="radar-switch" role="group" aria-label={switcherLabel}>
            {markets.map((m) => (
              <button key={m.id} type="button" aria-pressed={m.id === market.id} onClick={() => onSelect(m.id)}>
                {renderIcon(m)}
                {m.name}
              </button>
            ))}
          </div>
        )}

        <div className="radar-head-top">
          <span className="rank-no" data-lead={market.rank === 1}>
            {market.rank}
          </span>
          <div className="min-w-0">
            <h2 className="heading-md">{market.name}</h2>
            <p className="text-meta">
              {market.city} · {market.distanceKm.toLocaleString()} km · {market.flightHours}
              {!routeAlreadyDescribed && (hasDirectFlight ? ' direct' : ' via Manila')}
            </p>
          </div>
        </div>

        <p className="radar-route text-meta">
          <Plane size={14} aria-hidden="true" />
          {market.nearestAirport} → {market.destinationAirport}
        </p>
      </header>

      {notice}

      <DrawerChartPanel market={market} timeframe={timeframe} onTimeframeChange={setTimeframe} />

      <InsightsTabs market={market} activeTab={activeTab} onTabChange={setActiveTab} />

      <RouteCarriers market={market} />

      {!onTarget && targetUnavailable && <p className="radar-target-note text-meta">{targetUnavailable}</p>}
    </Drawer>
  );
}
