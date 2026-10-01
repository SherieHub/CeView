// ---- components/module-2/2.1-dashboard/AiStatusBanner.tsx ----
// Replaces the M2-F stub. Implements AiStatusBannerSlotProps from dashboardTypes.ts.
// The 2 states this card owns (of the dashboard's 6 total): the other 4 — loading, empty,
// zero-matching, and the alert-feed-with-cards state — belong to M2-1's AlertFeed.tsx.
props: { visible }
render: visible ? amber "AI Forecast Service Unavailable — alerts shown are from cache; refresh
        will not produce new predictions" banner : null

// ---- components/module-2/2.1-dashboard/RefreshForecastButton.tsx ----
// Replaces the M2-F stub. Implements RefreshForecastSlotProps from dashboardTypes.ts.
props: { disabled? }
imports: apiClient, useToast
state: running ← false

handleRefresh():
  running ← true  // disables button, spinner label "Running pipeline…"
  apiClient.markets.list()  // re-run forecast, fixture-backed
  running ← false
  showToast(`Forecast refreshed — N markets re-ranked`)

render: button (disabled if disabled prop or running; label swaps to spinner text while running)
