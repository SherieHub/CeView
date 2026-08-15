// ---- components/module-2/2.1-dashboard/DashboardView.tsx (additions) ----
imports: useToast, RefreshForecastButton

type Mode: 'loading' | 'empty' | 'normal' | 'ai-down'
state: mode ← 'loading'

on mount:
  apiClient.notifications.list()
    → success: setNotifications, mode ← (list empty ? 'empty' : 'normal')
    → failure: mode ← 'ai-down'  // alerts still render from cache

render (6 mutually exclusive branches):
  mode === 'loading' → 3 skeleton cards
  mode === 'empty' → "No notifications yet"
  mode === 'normal' AND visible.length === 0 → "No surge alerts for <categories> — widen coverage in Settings"
  mode === 'normal', visible non-empty → Card 10 feed / Card 11 reveal (per rankedMarkets)
  mode === 'ai-down' → amber "AI Forecast Service Unavailable" banner + same feed/reveal rendering

// ---- components/module-2/2.1-dashboard/RefreshForecastButton.tsx ----
props: { disabled? }
state: running ← false

handleRefresh():
  running ← true  // disables button, spinner label "Running pipeline…"
  apiClient.markets.list()  // re-run forecast, fixture-backed
  running ← false
  showToast(`Forecast refreshed — N markets re-ranked`)

render: button (disabled if disabled prop or running; label swaps to spinner text while running)
