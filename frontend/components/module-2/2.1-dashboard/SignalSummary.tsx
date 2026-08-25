/**
 * CARD — Dashboard: Alert Feed & Category Filtering (added element)
 *
 * Three tiles answering "is anything urgent right now" above the fold.
 *
 * NOT in ui-ux-prototype.html. The dashboard is the post-login landing screen
 * and calls itself a command center, but the prototype answered nothing at a
 * glance — you had to read a feed of eight cards to learn that two of them
 * mattered. Its subtitle tried to be the summary and ended up as one status
 * string doing four unrelated jobs across four states.
 *
 * Every value is derived from data already loaded: no new endpoint, no new
 * fixture. The third tile also gives "Refresh forecast" a visible consequence.
 */
import { BellDot, Compass, Zap } from 'lucide-react';
import type { SignalSummarySlotProps } from './dashboardTypes';

export default function SignalSummary({
  loading,
  degraded,
  unreadCount,
  surgeCount,
  surgeMarkets,
  topMarket,
  onOpenMarket,
}: SignalSummarySlotProps) {
  if (loading) {
    return (
      <div className="stat-row" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel" style={{ height: 104 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="stat-row">
      <div className="stat-tile">
        <span className="eyebrow">
          <BellDot size={13} aria-hidden="true" /> Unread alerts
        </span>
        <b className="stat-value num">{unreadCount}</b>
        <span className="text-meta">
          {unreadCount === 0 ? 'You are all caught up' : 'Across your categories'}
        </span>
      </div>

      <div className="stat-tile">
        <span className="eyebrow">
          <Zap size={13} aria-hidden="true" /> Confirmed surges
        </span>
        <b className="stat-value num">{surgeCount}</b>
        <span className="text-meta">
          {surgeMarkets.length > 0 ? surgeMarkets.join(', ') : 'Nothing above threshold'}
        </span>
      </div>

      {/* Clickable — the drawer is the natural next step from "this is your
          strongest market", and it saves picking an alert first just to reach it. */}
      <button
        type="button"
        className="stat-tile stat-tile--action"
        onClick={() => topMarket && onOpenMarket(topMarket.id)}
        disabled={!topMarket}
      >
        <span className="eyebrow">
          <Compass size={13} aria-hidden="true" /> Top market now
          {degraded && <span className="chip ml-2">cached</span>}
        </span>
        <b className="stat-value">{topMarket?.name ?? '—'}</b>
        <span className="text-meta">
          {topMarket ? `${topMarket.matchScore}/100 · ${topMarket.category}` : 'No markets ranked yet'}
        </span>
      </button>
    </div>
  );
}
