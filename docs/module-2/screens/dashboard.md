# Screen — Dashboard

**Route:** `/dashboard` (default landing screen post-login/onboarding) · **Module:** 2 (Market Radar
& Notifications) · **Access:** authenticated.

**Prototype reference:** [`ui-ux-prototype.html:2346–2517`](../../../ui-ux-prototype.html#L2346)
(`renderDashboard`, `selectAlert`, `setDashMode`, `refreshForecast`).

**Component:** `components/module-2/2.1-dashboard/DashboardView.tsx` (replaces `HomeView.tsx`).

## Why this replaces `HomeView`

`HomeView` today renders a flat, unfiltered notification list. The overhaul makes the dashboard a
**master/detail alert command center**: alerts are scoped to the operator's own business categories,
and selecting one reveals a market ranking computed **for that alert's category specifically** — not
one fixed top-3 list shared across the whole app. This is the single largest behavioral change in the
overhaul (see the [Dashboard cards](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md)).

## Layout

Page head (greeting, subtitle, uniqueness-score pill, "Refresh forecast" button) → banner slot (only
in `ai-down` mode) → either a single-column alert feed, or a two-column `alerts | markets-reveal`
grid once an alert is selected.

## State

```
dash: 'normal' | 'loading' | 'empty' | 'ai-down'
selectedAlertId: string | null
```

Alerts (`notifications`) and markets (`markets`) come from the API; `myAlerts` is always
`notifications.filter(n => profile.categories.includes(n.category))` — computed client-side from
whatever the API returns, not a separate endpoint.

## States

| State | Trigger | Rendering |
|---|---|---|
| `loading` | initial fetch in flight | 3 skeleton cards |
| `empty` | no forecast run yet for this operator | "No notifications yet" empty state |
| `normal`, `myAlerts.length === 0` | operator's categories match zero current alerts | "No surge alerts for your categories yet", names the categories, points at Settings to widen coverage |
| `normal`, alerts present, none selected | default | single-column alert feed |
| `normal`, alert selected | user clicked a card | two-column: alert feed (left) + markets reveal (right) |
| `ai-down` | forecast service unreachable | amber banner ("AI Forecast Service Unavailable... reads from your last successful forecast run"), alerts still render from cache, refresh does not produce new predictions |

## Interaction

- **Select alert** — toggles selection (clicking the selected card again deselects it and collapses
  the markets column). Marks the alert read as a side effect of viewing it, not a separate action.
- **Markets reveal** — re-ranks all tracked markets using the selected alert's `category`, sorted
  descending by `matchScore`, each card showing: rank number, market potential progress bar, city +
  distance, direct/via-Manila + flight hours, weekly frequency, and a surge chip if any point in that
  market's chart data is currently spiking. A footer card states the ranking formula:
  `market_score = 0.40·demand₄w + 0.35·seasonality + 0.25·economic_viability`. Clicking a rank card
  opens the [Market Radar drawer](market-radar-drawer.md) for that market.
- **Refresh forecast** — button disables itself with a spinner label during the call, then shows a
  toast confirming how many markets were re-ranked.

## API calls

| Call | When | Endpoint |
|---|---|---|
| `apiClient.listNotifications` | on mount | `GET /api/v1/notifications?profileId=UUID` |
| `apiClient.listMarkets` | on mount | `GET /api/v1/forecasting/markets?profileId=UUID` |
| `apiClient.analyzeMarkets` | Refresh forecast click | `POST /api/v1/forecasting/analyze/{profileId}` |

## Backend requirement

Category-scoped market ranking (the markets reveal) needs the backend to either accept a `category`
parameter on the markets endpoint or attach a pre-scored per-category rank to each notification. See
[`backend/category-scoped-ranking.md`](../backend/category-scoped-ranking.md).

## Child components

`AlertCard` (new — replaces `TrendAlertCard`, gains the selected/unread/surge visual states above),
`MarketRankCard` (existing, reused), `ProgressBar` (existing), `SurgeBadge` (existing).
