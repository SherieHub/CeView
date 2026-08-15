/**
 * CARD — Dashboard: Alert Feed & Category Filtering
 *   + Dashboard: Markets Reveal
 *   + Dashboard: States & Refresh Forecast
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Screen doc: docs/module-2/screens/dashboard.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 *
 * Route: /dashboard — replaces the legacy HomeView.tsx
 *
 * TODO (Alert Feed & Category Filtering):
 * - Base layout (page head, alert feed) + AlertCard.tsx (replaces TrendAlertCard)
 * - Filter: notifications.filter(n => profile.categories.includes(n.category))
 *   (ui-ux-prototype.html:2376)
 * - Selecting an alert marks it read as a side effect of viewing (not a separate action)
 *
 * TODO (Markets Reveal):
 * - Two-column layout on selection: alert feed (left) + markets reveal (right);
 *   deselecting collapses back to single-column
 * - marketsForCategory-equivalent re-ranking per selected alert's category
 * - Rank cards: rank number, market-potential bar, city + distance, direct/via-Manila +
 *   flight hours, weekly frequency, surge chip if any chart point is spiking
 * - Ranking-formula footer card
 *   (market_score = 0.40*demand_4w + 0.35*seasonality + 0.25*economic_viability)
 * - Clicking a rank card opens the Market Radar drawer (?market=<id>) for that market
 *
 * TODO (States & Refresh Forecast) — 6 states total:
 * - loading: 3 skeleton cards
 * - empty: "No notifications yet" (no forecast run yet)
 * - normal, zero matching alerts: "No surge alerts for your categories yet", names the
 *   categories, points at Settings to widen coverage
 * - ai-down: amber "AI Forecast Service Unavailable" banner, alerts still render from
 *   cache, refresh does not produce new predictions
 * - "Refresh forecast" button — disables + spinner label during the call, toast on completion
 *
 * DashboardView.test.tsx: category-filter predicate, re-ranking across categories, one
 * assertion per state.
 */
export default function DashboardView() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Dashboard</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Dashboard: Alert Feed &amp; Category Filtering in
        03-module-2.md.
      </p>
    </div>
  );
}
