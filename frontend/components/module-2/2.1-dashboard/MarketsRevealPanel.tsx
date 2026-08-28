/**
 * CARD — Dashboard: Markets Reveal
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 * Prototype reference: ui-ux-prototype.html:2422-2468
 *
 * The right-hand column. Its defining behaviour is that markets are ranked for
 * the SELECTED ALERT'S CATEGORY — not one fixed top-3 shared across the app.
 *
 * Unlike the prototype, this column is always mounted. There, selecting an
 * alert switched the page between a one- and two-column grid, so every card
 * resized and the one you had just clicked moved out from under the cursor.
 * Reserving the track costs nothing when idle, and the resting state explains
 * the interaction before you perform it.
 */
import { MousePointerClick, Tag } from 'lucide-react';
import RankCard from './RankCard';
import type { MarketsRevealSlotProps } from './dashboardTypes';

export default function MarketsRevealPanel({
  selectedAlert,
  markets,
  onOpenMarket,
}: MarketsRevealSlotProps) {
  return (
    <section className="dash-markets" id="dash-markets-panel" aria-label="Top Target Markets">
      <div className="feed-head">
        <h2 className="heading-md">Top Target Markets</h2>
        {selectedAlert && (
          <span className="chip chip--attention">
            <Tag aria-hidden="true" /> {selectedAlert.category}
          </span>
        )}
      </div>

      {selectedAlert ? (
        <div className="grid gap-4">
          {markets.map((market) => (
            <RankCard key={market.id} market={market} onOpen={onOpenMarket} />
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty">
            <div className="empty-glyph">
              <MousePointerClick aria-hidden="true" />
            </div>
            <h3 className="heading-sm">Select a surge alert</h3>
            <p className="body-sm">
              Markets are ranked for the category of whichever alert you open, so this list changes
              with your selection.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
