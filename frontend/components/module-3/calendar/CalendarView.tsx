/**
 * CARD — Calendar: Month Grid & Navigation
 *   + Calendar: List View & Day-Click Modal
 * Depends on: Card 19 (Content Board & Publish Action — shared post store)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
 *
 * Does NOT reuse or extend frontend/old-components/CalendarView.tsx (legacy, untouched
 * per .claude/CLAUDE.md).
 *
 * TODO (Month Grid & Navigation):
 * - 7-column grid, leading/trailing days greyed + inert, today ringed, up to 3
 *   platform-colored chips per day + "+N more"
 * - Month navigation (prev/next, wraps Dec<->Jan), per-status counts header
 * - A post published from Content Studio must appear on today's cell without a reload
 *
 * TODO (List View & Day-Click Modal):
 * - List view — flat reverse-chronological list with status chips
 * - Day click (only on days with >=1 post) opens a modal listing that day's posts;
 *   published posts show reach/likes/engagement inline
 *
 * CalendarView.test.tsx: month-boundary cell distribution (leading/trailing/today),
 * day-click no-op vs. modal-open branches.
 */
export default function CalendarView() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Calendar</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Calendar: Month Grid &amp; Navigation in
        04-module-3.md.
      </p>
    </div>
  );
}
