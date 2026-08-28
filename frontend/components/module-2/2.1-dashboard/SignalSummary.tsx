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
 *
 * Layout: the glyph sits in a gradient block overlapping the card's top-left
 * corner, with the label and figure right-aligned opposite it and the
 * supporting line below a rule. The three gradients run blue -> cyan -> green
 * across the row, all drawn from the brand ramp rather than the semantic
 * state colours — these are identities for the metrics, not severities.
 */
import { ArrowRight, BellDot, Compass, Zap } from 'lucide-react';
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
          <div key={i} className="skel" style={{ height: 132 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="stat-row">
      <div className="stat-tile">
        <span className="stat-icon">
          <BellDot size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="stat-head">
          <span className="stat-label">Unread alerts</span>
          <b className="stat-value num">{unreadCount}</b>
        </div>
        <div className="stat-foot">
          {unreadCount === 0 ? 'You are all caught up' : 'Across your categories'}
        </div>
      </div>

      <div className="stat-tile">
        <span className="stat-icon">
          <Zap size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="stat-head">
          <span className="stat-label">Confirmed surges</span>
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
          <Compass size={22} strokeWidth={1.75} aria-hidden="true" />
        </span>
        <div className="stat-head">
          <span className="stat-label">
            Top market now
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
          {topMarket && <ArrowRight size={15} className="stat-go" aria-hidden="true" />}
        </div>
      </button>
    </div>
  );
}
