/**
 * CARD — Performance: Previously Published & Post Analytics Modal
 * Depends on: Card 25 (KPI Cards, PES Gauge & Funnel), Content Studio Card 19 (shared
 * post store)
 * Component doc: docs/module-4/screens/_components/post-analytics-modal.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md
 *
 * TODO:
 * - Reach/likes/comments/shares/engagement-rate stat grid
 * - 7-day reach-accumulation line chart (Recharts, not the prototype's SVG helper)
 * - "No data yet" empty state for zero-reach posts
 * - Only opens for published posts — draft posts (Calendar or Content Board) don't offer
 *   this modal
 *
 * PostAnalyticsModal.test.tsx: has-data vs. no-data-yet branch.
 */
export default function PostAnalyticsModal() {
  return (
    <div className="modal empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Post Analytics</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: Previously Published &amp; Post
        Analytics Modal in 05-module-4.md.
      </p>
    </div>
  );
}
