# Module 2 — Market Radar & Notifications

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note). Any
DoD item below referencing a Playwright spec passing is deferred until `frontend/` is wired into
`e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen docs: [`docs/module-2/screens/dashboard.md`](../../../module-2/screens/dashboard.md),
[`market-radar-drawer.md`](../../../module-2/screens/market-radar-drawer.md). Spec files:
`e2e/tests/dashboard.spec.ts` (Cards 10–12), `e2e/tests/market-radar-drawer.spec.ts` (Cards 13–14).

---

### CARD — Dashboard: Alert Feed & Category Filtering

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** A notification feed filtered to the operator's own business categories, not a flat
unfiltered list.
**Prototype reference:** screen-dashboard / `renderDashboard()` — `ui-ux-prototype.html:2359–2417`

**Project files to add/implement:**
- `components/module-2/2.1-dashboard/DashboardView.tsx` — page head + alert feed
- `components/module-2/2.1-dashboard/AlertCard.tsx` — one alert row

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `notifications.list()`, backed by
  `services/fixtures/notifications.ts`'s `MOCK_NOTIFICATIONS`
- `services/profileContext.tsx` (Foundation — Shell & Routing) — `profile.categories`, the filter key

**Steps (pseudocode):**
1. Load notifications via `apiClient.notifications.list()`.
2. Filter the list to only those whose `category` is in the current profile's `categories`
   (`notifications.filter(n => profile.categories.includes(n.category))`) — there is no
   undifferentiated "all alerts" view.
3. Render each surviving notification as an `AlertCard`:
   - Date, title, alert message.
   - Market / category / trend chips.
   - An unread dot if `isRead` is false.
   - A "Surge" chip if `alertLevel` is `WARNING`.
4. Selecting a card marks it read as a side effect of the click itself (not a separate "mark read"
   action) and records it as the "selected" alert (consumed by Card 11's markets reveal).

**Milestone (finished state):** `/dashboard` renders only alerts matching the fixture profile's
categories; clicking one marks it read (unread dot disappears) and does not yet reveal markets (Card
11).

**Definition of Done:**
- [ ] `DashboardView.test.tsx` covers the category-filter predicate against a mixed fixture set
- [ ] `dashboard.spec.ts` → "Alert Feed & Category Filtering" — deferred, not wired for `frontend/`
      yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- DashboardView
```

---

### CARD — Dashboard: Markets Reveal

**Depends on:** Card 10 (Alert Feed & Category Filtering)
**Summary:** Selecting an alert reveals a market ranking computed for that alert's specific category
— the master/detail behavior that is the largest change from `HomeView`.
**Prototype reference:** screen-dashboard / `renderDashboard()` (markets section) —
`ui-ux-prototype.html:2419–2466`

**Project files to add/implement:**
- (extends `DashboardView.tsx` from Card 10) — adds the two-column layout and markets column
- `components/module-2/2.1-dashboard/RankCard.tsx` — one ranked-market row in the reveal column
- `components/module-2/2.1-dashboard/RankingFormulaCard.tsx` — the static formula-explainer footer
  card

**Related files:**
- `services/fixtures/markets.ts` (Foundation — Fixture Data Layer) — `marketsForCategory()`, the
  re-ranking function this card calls
- [`docs/module-2/backend/category-scoped-ranking.md`](../../../module-2/backend/category-scoped-ranking.md)
  — the real backend requirement `marketsForCategory()` stands in for until that service exists

**Steps (pseudocode):**
1. When an alert is selected (from Card 10) and the dashboard is in a state that allows it
   (`normal` or `ai-down`, and the selection is still valid against the current alert list — a stale
   selection, e.g. from before the operator's categories changed, never reveals markets):
   - Call `marketsForCategory(selectedAlert.category)` to get that category's re-ranked market list.
   - Switch the layout to two columns: alert feed on the left, markets reveal on the right.
2. Clicking the same alert card again deselects it, collapsing the layout back to a single column.
3. Render each ranked market as a `RankCard`:
   - Rank number, market-potential bar (0–100).
   - City + distance to Cebu.
   - Direct flight or "via Manila", flight hours, weekly frequency.
   - A "Surge active" chip if any of that market's chart data points has `spike === 1`.
4. Below the rank cards, render `RankingFormulaCard` — a static explainer showing
   `market_score = 0.40·demand₄w + 0.35·seasonality + 0.25·economic_viability`.
5. Clicking a rank card opens the Market Radar drawer (Card 13) for that market.

**Milestone (finished state):** Selecting two alerts of different categories produces visibly
different market rankings in the reveal column.

**Definition of Done:**
- [ ] `DashboardView.test.tsx` extended: re-ranking differs correctly across ≥2 fixture categories
- [ ] `dashboard.spec.ts` → "Markets Reveal" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- DashboardView
```

---

### CARD — Dashboard: States & Refresh Forecast

**Depends on:** Card 10 (Alert Feed & Category Filtering)
**Summary:** The remaining 4 of 6 dashboard states, plus the Refresh Forecast action.
**Prototype reference:** screen-dashboard / `renderDashboard()` (state branches) +
`refreshForecast()` — `ui-ux-prototype.html:2385–2398`, `:2468–2516`

**Project files to add/implement:**
- (extends `DashboardView.tsx` from Cards 10–11) — adds the remaining state branches
- `components/module-2/2.1-dashboard/RefreshForecastButton.tsx` — the refresh action + its own
  loading state

**Related files:**
- none new — this card only adds branches to files Cards 10–11 already created

**Steps (pseudocode):**
1. Dashboard has 6 mutually exclusive states, driven by a `mode` flag plus the alert list's actual
   contents:
   - `loading` — render 3 skeleton cards in place of the alert feed.
   - `empty` — no forecast has ever run: render an empty state, "No notifications yet".
   - `normal`, zero matching alerts — the feed loaded but nothing matches the profile's categories:
     render an empty state naming those categories and pointing at Settings to widen coverage.
   - `normal`, feed only (no alert selected) — Card 10's single-column view.
   - `normal`, with reveal (an alert selected) — Card 11's two-column view.
   - `ai-down` — render an amber "AI Forecast Service Unavailable" banner above the feed; alerts
     still render from the last successful fetch (cache), and Refresh Forecast will not produce new
     predictions while in this state.
2. `RefreshForecastButton`: on click, disable the button and swap its label for a spinner + "Running
   pipeline…"; after the call resolves, restore the button and show a completion toast (e.g. "Forecast
   refreshed — N markets re-ranked").

**Milestone (finished state):** All 6 dashboard states (loading/empty/normal-no-alerts/normal-
feed-only/normal-with-reveal/ai-down) are independently reachable via fixture toggles and each renders
its documented content.

**Definition of Done:**
- [ ] `DashboardView.test.tsx` extended: one assertion per state
- [ ] `dashboard.spec.ts` → "States & Refresh Forecast" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- DashboardView
```

---

### CARD — Market Radar Drawer: Shell, Directive & Demand Chart

**Depends on:** Card 10 (Dashboard must exist to open the drawer from)
**Summary:** The Market Radar drawer opens via `?market=<id>` on `/dashboard`, closable via
scrim/Esc/browser back.
**Prototype reference:** `renderRadar()` (header + directive + chart) —
`ui-ux-prototype.html:2521–2793` (narrow to the header/directive/chart portion; tabs are Card 14)

**Project files to add/implement:**
- `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` — drawer shell, header, directive,
  and chart, mounted via URL state (`?market=<id>`) rather than a dedicated route
- `components/module-2/2.2-market-radar/DemandForecastChart.tsx` — the Recharts-based demand chart
  with a 4WK/12WK toggle

**Related files:**
- `components/shared/Drawer.tsx` (Foundation — Shell & Routing) — the overlay primitive this drawer
  is built on
- `services/fixtures/markets.ts` (Foundation — Fixture Data Layer) — `MOCK_MARKETS`'s per-market
  `chartData`, `directive`, `spikeIndicator` fields this card renders

**Steps (pseudocode):**
1. Opening a market (from a Dashboard rank card, Card 11) sets `?market=<id>` in the URL and resets
   the drawer's local state: timeframe to `4WK`, active insights tab to `economy` (tabs are Card
   14's scope).
2. Look up the active market by id; render the drawer header: rank badge, market name, city →
   Cebu distance/flight-time, a close button, and a "Target this market" CTA.
3. Render a surge banner if the market's `spikeIndicator` is true, otherwise a neutral no-surge
   state; render the AI strategic directive text below it.
4. Render `DemandForecastChart` for the active market's `chartData`:
   - A 4WK/12WK toggle switches how many forecast weeks are plotted.
   - Render the zone-key legend (Low / Moderate / High peak), each zone paired with its pricing
     action guidance.
5. "Target this market": close the drawer, navigate to `/content`, and set both `targetedMarketId`
   and `activeMarketId` to the market that was open.
6. The drawer closes (clearing `?market=`) via the shared overlay stack's scrim click, Esc, or the
   browser back button — no bespoke close handling beyond what `components/shared/Drawer.tsx`
   already provides.

**Milestone (finished state):** Clicking a rank card on the Dashboard opens the drawer at the correct
URL (`?market=<id>`), showing that market's directive and chart; back button closes it.

**Definition of Done:**
- [ ] `MarketRadarDrawer.test.tsx` covers the 4WK/12WK toggle and the surge/no-surge banner branch
- [ ] `market-radar-drawer.spec.ts` → "Shell, Directive & Demand Chart" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- MarketRadarDrawer
```

---

### CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs

**Depends on:** Card 13 (Shell, Directive & Demand Chart)
**Summary:** The two-tab insights card inside the drawer.
**Prototype reference:** `renderRadar()` (insights tabs) — `ui-ux-prototype.html:2532–2793`

**Project files to add/implement:**
- `components/module-2/2.2-market-radar/InsightsTabs.tsx` — the two-tab container
- `components/module-2/2.2-market-radar/PurchasingPowerTab.tsx` — "Purchasing power" tab content
- `components/module-2/2.2-market-radar/SeasonalPatternsTab.tsx` — "Seasonal patterns" tab content

**Related files:**
- `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` (Card 13) — mounts `InsightsTabs`
  below the demand chart, and owns the active-tab state this card reads
- `services/fixtures/markets.ts` (Foundation — Fixture Data Layer) — per-market forex/GDP/
  seasonality/airline fields both tabs render

**Steps (pseudocode):**
1. Render a two-tab switcher ("Purchasing power" / "Seasonal patterns") whose active tab is drawer
   state (Card 13), not local — so it persists correctly if the drawer re-renders.
2. "Purchasing power" tab:
   - KPI tiles: forex rate, GDP value, average flight price, accessibility score.
   - AI-generated economic insight paragraph.
   - Two mini trend charts: 12-month forex history, 5-year GDP history.
3. "Seasonal patterns" tab:
   - Seasonality score with its qualitative band (weak/emerging/likely/confirmed).
   - YoY ratio chip — render "N/A" when the market has under 59 weeks of history instead of a
     computed ratio.
   - A 12-month peak calendar grid highlighting the market's peak months.
   - AI-generated seasonality insight paragraph.
   - The full 24-week seasonality chart (history + forecast).
4. Below both tabs (not tab-specific): render the route & carriers list for the active market.
5. Switching tabs swaps only the tab content — it must not reset the drawer's scroll position or the
   demand chart's 4WK/12WK selection from Card 13.

**Milestone (finished state):** Switching tabs swaps content without losing the drawer's scroll
position or the open chart timeframe.

**Definition of Done:**
- [ ] `MarketRadarDrawer.test.tsx` extended: tab switch renders the correct panel
- [ ] `market-radar-drawer.spec.ts` → "Economic & Seasonal Insights Tabs" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- MarketRadarDrawer
```
