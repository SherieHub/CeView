/**
 * CARD — Dashboard: Alert Feed & Category Filtering
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 *
 * Replaces the legacy TrendAlertCard.
 *
 * TODO:
 * - Date, title, alert message, market/category/trend chips, unread dot, surge chip
 * - Clicking marks the notification read and (once Markets Reveal lands) opens the
 *   markets reveal column for its category
 */
export default function AlertCard() {
  return (
    <div className="card">
      <p className="body-sm">AlertCard placeholder — see 03-module-2.md.</p>
    </div>
  );
}
