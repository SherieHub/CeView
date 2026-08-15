# Module 2 — Market Radar & Notifications

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note). Any
DoD item below referencing a Playwright spec passing is deferred until `frontend/` is wired into
`e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen docs: [`docs/module-2/screens/dashboard.md`](../../../module-2/screens/dashboard.md),
[`market-radar-drawer.md`](../../../module-2/screens/market-radar-drawer.md). Spec files:
`e2e/tests/dashboard.spec.ts` (Cards 10–12), `e2e/tests/market-radar-drawer.spec.ts` (Cards 13–14).

**Component diagram:** [`diagrams/module-2.mmd`](diagrams/module-2.mmd)

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

**Flow:** [`diagrams/cards/module-2/alert-feed-category-filtering.mmd`](diagrams/cards/module-2/alert-feed-category-filtering.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/alert-feed-category-filtering.ts`](pseudocode/module-2/alert-feed-category-filtering.ts)

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

**Flow:** [`diagrams/cards/module-2/markets-reveal.mmd`](diagrams/cards/module-2/markets-reveal.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/markets-reveal.ts`](pseudocode/module-2/markets-reveal.ts)

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

**Flow:** [`diagrams/cards/module-2/states-refresh-forecast.mmd`](diagrams/cards/module-2/states-refresh-forecast.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/states-refresh-forecast.ts`](pseudocode/module-2/states-refresh-forecast.ts)

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

**Flow:** [`diagrams/cards/module-2/market-radar-shell-directive-chart.mmd`](diagrams/cards/module-2/market-radar-shell-directive-chart.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/market-radar-shell-directive-chart.ts`](pseudocode/module-2/market-radar-shell-directive-chart.ts)

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

**Flow:** [`diagrams/cards/module-2/market-radar-insights-tabs.mmd`](diagrams/cards/module-2/market-radar-insights-tabs.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/market-radar-insights-tabs.ts`](pseudocode/module-2/market-radar-insights-tabs.ts)

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
