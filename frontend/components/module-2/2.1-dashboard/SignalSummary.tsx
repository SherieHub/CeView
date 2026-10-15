/** Four summary tiles; the Philippine-region one opens that region's details. */
import { Bell, ChevronRight, Globe, MapPin, TrendingUp } from 'lucide-react';
import { SAMPLE_REGIONS } from './regionSamples';
import type { SignalSummarySlotProps } from './dashboardTypes';

export default function SignalSummary({
  loading,
  degraded,
  unreadCount,
  surgeCount,
  surgeMarkets,
  topMarket,
  onOpenMarket,
  onOpenRegion,
}: SignalSummarySlotProps) {
  const topRegion = SAMPLE_REGIONS[0];
  if (loading) {
    return (
      <div className="stat-row stat-row--markets" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel" style={{ height: 132 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="stat-row stat-row--markets">
      <div className="stat-tile">
        <span className="stat-icon">
          <Bell size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="stat-head">
          <span className="stat-label">Unread alerts</span>
          <b className="stat-value num">{unreadCount}</b>
        </div>
        <div className="stat-foot">
          {unreadCount === 0 ? 'You are all caught up' : 'Across your categories'}
        </div>
      </div>

      <div className="stat-tile" data-tone="coral">
        <span className="stat-icon">
          <TrendingUp size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="stat-head">
          <span className="stat-label">Active surges</span>
          <b className="stat-value num">{surgeCount}</b>
        </div>
        <div className="stat-foot">
          {surgeMarkets.length > 0 ? surgeMarkets.join(', ') : 'Nothing above threshold'}
        </div>
      </div>

      {/* Clickable — the drawer is the natural next step from "this is your
          strongest market", and it saves picking an alert first just to reach it. */}
      <button
        type="button"
        className="stat-tile stat-tile--action"
        onClick={() => topMarket && onOpenMarket(topMarket.id)}
        disabled={!topMarket}
      >
        <span className="stat-icon">
          <Globe size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="stat-head">
          <span className="stat-label">
            Top market for International
            {degraded && <span className="chip ml-2">cached</span>}
          </span>
          <b className="stat-value">{topMarket?.name ?? '—'}</b>
        </div>
        <div className="stat-foot">
          <span>
            {topMarket ? `${topMarket.matchScore}/100 · ${topMarket.category}` : 'No markets ranked yet'}
          </span>
          {/* The only tile that does anything on click, so it is the only one
              that gets an affordance. Same arrow the alert cards use for
              "View target markets", so the gesture reads the same way. */}
          {topMarket && <ChevronRight size={18} className="stat-go" aria-hidden="true" />}
        </div>
      </button>
      {/* Same clickable tile as the international one: opens the region's
          details. The figures are a design preview — see PhilippineRegionsPanel. */}
      <button
        type="button"
        className="stat-tile stat-tile--action stat-tile--region"
        onClick={() => onOpenRegion?.(topRegion.name)}
        disabled={!onOpenRegion}
      >
        <span className="stat-icon">
          <MapPin size={24} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="stat-head">
          <span className="stat-label">Top market for Philippines</span>
          <b className="stat-value">{topRegion.name}</b>
        </div>
        <div className="stat-foot">
          <span>
            {topRegion.score}/100{topMarket ? ` · ${topMarket.category}` : ''}
          </span>
          {onOpenRegion && <ChevronRight size={18} className="stat-go" aria-hidden="true" />}
        </div>
      </button>
    </div>
  );
}
