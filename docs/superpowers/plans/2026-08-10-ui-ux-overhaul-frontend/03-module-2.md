# Module 2 — Market Radar & Notifications

Frontend-track paths (M2-F, M2-1..M2-5) are relative to `frontend/` (see `00-index.md`'s "Target
directory" note). Backend-track paths (M2-B1, M2-B2) are relative to the repo root. Any DoD item below
referencing a Playwright spec passing is deferred until `frontend/` is wired into `e2e/` — see
`00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen docs: [`docs/module-2/screens/dashboard.md`](../../../module-2/screens/dashboard.md),
[`market-radar-drawer.md`](../../../module-2/screens/market-radar-drawer.md). Spec files:
`e2e/tests/dashboard.spec.ts` (M2-F, M2-1, M2-2, M2-3), `e2e/tests/market-radar-drawer.spec.ts`
(M2-F, M2-4, M2-5).

**Component diagram:** [`diagrams/module-2.mmd`](diagrams/module-2.mmd)

**Parallelism:** M2-F is the only card every other frontend card in this file depends on — M2-1
through M2-5 can all be built simultaneously once M2-F merges, since each owns disjoint files. M2-B1
is the backend track's own root (no dependency on anything in this file); M2-B2 depends only on M2-B1.
Neither backend card blocks nor is blocked by any frontend card.

---

### CARD — Foundation: Dashboard & Radar Shell

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** The page shells, state hooks, and typed slot contracts for both the Dashboard and the
Market Radar drawer, so every other Module 2 frontend card can be built in parallel against a stable
interface instead of all editing the same files.
**Prototype reference:** screen-dashboard / `renderDashboard()` — `ui-ux-prototype.html:2359–2417`;
`renderRadar()` (shell only) — `ui-ux-prototype.html:2521–2793`

**Project files to add/implement:**
- `components/module-2/2.1-dashboard/DashboardView.tsx` — layout grid, `useDashboardState()` hook,
  category-filter context wiring; composes 4 named slot components by fixed import path
- `components/module-2/2.1-dashboard/dashboardTypes.ts` — the 4 slot prop contracts
  (`AlertFeedSlotProps`, `MarketsRevealSlotProps`, `AiStatusBannerSlotProps`, `RefreshForecastSlotProps`)
- `components/module-2/2.1-dashboard/AlertFeed.tsx`, `MarketsRevealPanel.tsx`, `AiStatusBanner.tsx`,
  `RefreshForecastButton.tsx` — **stub placeholders only**; ownership of each transfers whole to one
  sibling card below
- `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` — drawer shell: `?market=` URL mount,
  scrim/Esc/back-button close, header, owns `activeInsightsTab`/`timeframe` state, composes 2 body
  slot components by fixed import path
- `components/module-2/2.2-market-radar/radarTypes.ts` — the 2 body slot prop contracts
  (`DrawerChartSlotProps`, `DrawerInsightsSlotProps`)
- `components/module-2/2.2-market-radar/DrawerChartPanel.tsx`, `InsightsTabs.tsx` — stub placeholders;
  ownership transfers whole to sibling cards below

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `notifications.list()`, `markets.list()`
- `services/profileContext.tsx` (Foundation — Shell & Routing) — `profile.categories`
- `components/shared/Drawer.tsx` (Foundation — Shell & Routing) — the overlay primitive the radar
  drawer is built on

**Flow:** [`diagrams/cards/module-2/foundation-dashboard-radar-shell.mmd`](diagrams/cards/module-2/foundation-dashboard-radar-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/foundation-dashboard-radar-shell.ts`](pseudocode/module-2/foundation-dashboard-radar-shell.ts)

**Milestone (finished state):** `/dashboard` renders the shell with all 4 slot placeholders visible;
navigating to `/dashboard?market=<id>` opens the drawer shell with its 2 slot placeholders and closes
correctly via scrim/Esc/browser back — before any sibling card fills in real content.

**Definition of Done:**
- [ ] `DashboardView.test.tsx` covers `useDashboardState()`'s loading/success/failure transitions
- [ ] `MarketRadarDrawer.test.tsx` covers URL-driven open/close and the timeframe/tab state reset on
      market change
- [ ] `dashboard.spec.ts` / `market-radar-drawer.spec.ts` shell coverage — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- DashboardView MarketRadarDrawer
```

---

### CARD — Dashboard: Alert Feed & Category Filtering

**Depends on:** Foundation — Dashboard & Radar Shell
**Summary:** A notification feed filtered to the operator's own business categories, owning all of
the feed's own states (loading/empty/zero-match/populated) — not a flat unfiltered list.
**Prototype reference:** screen-dashboard / `renderDashboard()` — `ui-ux-prototype.html:2359–2417`

**Project files to add/implement:**
- `components/module-2/2.1-dashboard/AlertFeed.tsx` — replaces the Foundation stub; page head + alert
  feed, all 4 feed-owned states
- `components/module-2/2.1-dashboard/AlertCard.tsx` — one alert row

**Related files:**
- `components/module-2/2.1-dashboard/dashboardTypes.ts` (Foundation — Dashboard & Radar Shell) —
  `AlertFeedSlotProps`, the contract this card implements
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `notifications.markRead()`, backed by
  `services/fixtures/notifications.ts`'s `MOCK_NOTIFICATIONS`

**Flow:** [`diagrams/cards/module-2/alert-feed-category-filtering.mmd`](diagrams/cards/module-2/alert-feed-category-filtering.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/alert-feed-category-filtering.ts`](pseudocode/module-2/alert-feed-category-filtering.ts)

**Milestone (finished state):** `/dashboard` renders only alerts matching the fixture profile's
categories; clicking one marks it read (unread dot disappears) and does not yet reveal markets
(Markets Reveal card).

**Definition of Done:**
- [ ] `AlertFeed.test.tsx` covers the category-filter predicate and all 4 feed states against a mixed
      fixture set
- [ ] `dashboard.spec.ts` → "Alert Feed & Category Filtering" — deferred, not wired for `frontend/`
      yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AlertFeed
```

---

### CARD — Dashboard: Markets Reveal

**Depends on:** Foundation — Dashboard & Radar Shell
**Summary:** Selecting an alert reveals a market ranking computed for that alert's specific category
— the master/detail behavior that is the largest change from `HomeView`.
**Prototype reference:** screen-dashboard / `renderDashboard()` (markets section) —
`ui-ux-prototype.html:2419–2466`

**Project files to add/implement:**
- `components/module-2/2.1-dashboard/MarketsRevealPanel.tsx` — replaces the Foundation stub; the
  two-column reveal content
- `components/module-2/2.1-dashboard/RankCard.tsx` — one ranked-market row in the reveal column
- `components/module-2/2.1-dashboard/RankingFormulaCard.tsx` — the static formula-explainer footer
  card

**Related files:**
- `components/module-2/2.1-dashboard/dashboardTypes.ts` (Foundation — Dashboard & Radar Shell) —
  `MarketsRevealSlotProps`, the contract this card implements
- `services/fixtures/markets.ts` (Foundation — Fixture Data Layer) — `marketsForCategory()`, the
  re-ranking function this card calls
- [`docs/module-2/backend/category-scoped-ranking.md`](../../../module-2/backend/category-scoped-ranking.md),
  [Category-Scoped Market Ranking — Query & Endpoint](#card--category-scoped-market-ranking-query--endpoint)
  — the real backend this fixture stands in for; swapping to it is a later, non-blocking integration
  task, not part of this card

**Flow:** [`diagrams/cards/module-2/markets-reveal.mmd`](diagrams/cards/module-2/markets-reveal.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/markets-reveal.ts`](pseudocode/module-2/markets-reveal.ts)

**Milestone (finished state):** Selecting two alerts of different categories produces visibly
different market rankings in the reveal column.

**Definition of Done:**
- [ ] `MarketsRevealPanel.test.tsx`: re-ranking differs correctly across ≥2 fixture categories
- [ ] `dashboard.spec.ts` → "Markets Reveal" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- MarketsRevealPanel
```

---

### CARD — Dashboard: AI Status Banner & Refresh Forecast

**Depends on:** Foundation — Dashboard & Radar Shell
**Summary:** The AI-down degradation banner and the Refresh Forecast action — the 2 of the dashboard's
6 states not owned by the Alert Feed card.
**Prototype reference:** screen-dashboard / `renderDashboard()` (ai-down branch) + `refreshForecast()`
— `ui-ux-prototype.html:2385–2398`, `:2468–2516`

**Project files to add/implement:**
- `components/module-2/2.1-dashboard/AiStatusBanner.tsx` — replaces the Foundation stub; amber
  degradation banner
- `components/module-2/2.1-dashboard/RefreshForecastButton.tsx` — replaces the Foundation stub; the
  refresh action + its own loading state

**Related files:**
- `components/module-2/2.1-dashboard/dashboardTypes.ts` (Foundation — Dashboard & Radar Shell) —
  `AiStatusBannerSlotProps`, `RefreshForecastSlotProps`, the contracts this card implements

**Flow:** [`diagrams/cards/module-2/states-refresh-forecast.mmd`](diagrams/cards/module-2/states-refresh-forecast.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/states-refresh-forecast.ts`](pseudocode/module-2/states-refresh-forecast.ts)

**Milestone (finished state):** With the fixture's AI-down flag toggled on, the amber banner appears
independent of alert content; "Refresh forecast" disables + shows a spinner label during the call and
toasts on completion.

**Definition of Done:**
- [ ] `AiStatusBanner.test.tsx` / `RefreshForecastButton.test.tsx`: one assertion per state
- [ ] `dashboard.spec.ts` → "AI Status Banner & Refresh Forecast" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AiStatusBanner RefreshForecastButton
```

---

### CARD — Market Radar Drawer: Directive & Demand Chart

**Depends on:** Foundation — Dashboard & Radar Shell
**Summary:** The surge banner, AI directive, and demand chart body content — one of two independent
slot-fillers inside the drawer shell.
**Prototype reference:** `renderRadar()` (directive + chart) — `ui-ux-prototype.html:2521–2793`
(narrow to the directive/chart portion; tabs are the sibling Insights Tabs card)

**Project files to add/implement:**
- `components/module-2/2.2-market-radar/DrawerChartPanel.tsx` — replaces the Foundation stub; surge
  banner, directive text, chart mount
- `components/module-2/2.2-market-radar/DemandForecastChart.tsx` — the Recharts-based demand chart
  with a 4WK/12WK toggle

**Related files:**
- `components/module-2/2.2-market-radar/radarTypes.ts` (Foundation — Dashboard & Radar Shell) —
  `DrawerChartSlotProps`, the contract this card implements
- `services/fixtures/markets.ts` (Foundation — Fixture Data Layer) — `MOCK_MARKETS`'s per-market
  `chartData`, `directive`, `spikeIndicator` fields this card renders

**Flow:** [`diagrams/cards/module-2/market-radar-directive-demand-chart.mmd`](diagrams/cards/module-2/market-radar-directive-demand-chart.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/market-radar-directive-demand-chart.ts`](pseudocode/module-2/market-radar-directive-demand-chart.ts)

**Milestone (finished state):** Opening the drawer for a market shows its directive and chart; the
4WK/12WK toggle re-slices the chart data without affecting the (sibling) Insights Tabs card.

**Definition of Done:**
- [ ] `DrawerChartPanel.test.tsx` covers the 4WK/12WK toggle and the surge/no-surge banner branch
- [ ] `market-radar-drawer.spec.ts` → "Directive & Demand Chart" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- DrawerChartPanel
```

---

### CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs

**Depends on:** Foundation — Dashboard & Radar Shell
**Summary:** The two-tab insights card inside the drawer — the other of two independent slot-fillers;
a true sibling of the Directive & Demand Chart card since the shell owns the active-tab state.
**Prototype reference:** `renderRadar()` (insights tabs) — `ui-ux-prototype.html:2532–2793`

**Project files to add/implement:**
- `components/module-2/2.2-market-radar/InsightsTabs.tsx` — replaces the Foundation stub; the two-tab
  container
- `components/module-2/2.2-market-radar/PurchasingPowerTab.tsx` — "Purchasing power" tab content
- `components/module-2/2.2-market-radar/SeasonalPatternsTab.tsx` — "Seasonal patterns" tab content

**Related files:**
- `components/module-2/2.2-market-radar/radarTypes.ts` (Foundation — Dashboard & Radar Shell) —
  `DrawerInsightsSlotProps`, the contract this card implements; `activeTab`/`onTabChange` are owned by
  the shell, not this card or its sibling
- `services/fixtures/markets.ts` (Foundation — Fixture Data Layer) — per-market forex/GDP/
  seasonality/airline fields both tabs render

**Flow:** [`diagrams/cards/module-2/market-radar-insights-tabs.mmd`](diagrams/cards/module-2/market-radar-insights-tabs.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/market-radar-insights-tabs.ts`](pseudocode/module-2/market-radar-insights-tabs.ts)

**Milestone (finished state):** Switching tabs swaps content without losing the drawer's scroll
position or the (sibling-owned) open chart timeframe.

**Definition of Done:**
- [ ] `InsightsTabs.test.tsx`: tab switch renders the correct panel
- [ ] `market-radar-drawer.spec.ts` → "Economic & Seasonal Insights Tabs" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- InsightsTabs
```

---

### CARD — Category-Scoped Market Ranking: Query & Endpoint

**Depends on:** —
**Summary:** `GET /forecasting/markets` accepts a `category` query param and re-ranks the existing
per-market results using the same category-preference signal `CategoryRankNotificationService` already
uses for notifications, instead of the flat global `market_score` order. Root of Module 2's backend
track — independent of every frontend card above.
**Prototype reference:** none — pure backend; implements
[`docs/module-2/backend/category-scoped-ranking.md`](../../../module-2/backend/category-scoped-ranking.md)'s
recommended option 1.

**Project files to add/implement:**
- `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/CategoryMarketRanker.java` —
  reorders + renumbers an existing `MarketDto` list per a category's ranking

**Related files:**
- `backend/spring-boot/src/main/java/com/ceview/module2/ForecastingController.java` — `markets()`
  gains the `category` query param
- `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java` — new
  `loadMarketsFromDb(profileId, category)` overload
- `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/CategoryRankNotificationService.java`
  — existing `ai.rankMarketsForCategory(category)` call this card reuses (read-only reference)

**Flow:** [`diagrams/cards/module-2/category-scoped-ranking-query.mmd`](diagrams/cards/module-2/category-scoped-ranking-query.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/category-scoped-ranking-query.ts`](pseudocode/module-2/category-scoped-ranking-query.ts)

**Milestone (finished state):** `GET /forecasting/markets?category=Culinary%20%26%20Gastronomy&profileId=<seeded>`
returns the 3 markets in a different order than `GET /forecasting/markets?profileId=<seeded>` (no
category) for at least one seeded profile/category pair.

**Definition of Done:**
- [ ] `ForecastingServiceTest` extended: `loadMarketsFromDb(profileId, category)` changes rank order
      for ≥2 categories against the same profile
- [ ] `ForecastingControllerTest` extended: `category` query param round-trips to the service overload
- [ ] Code review approved

**Verification:**
```
cd backend/spring-boot && ./mvnw test -Dtest=ForecastingControllerTest,ForecastingServiceTest
```

---

### CARD — Category-Scoped Market Ranking: Alert-Time Rank Embed

**Depends on:** Category-Scoped Market Ranking — Query & Endpoint
**Summary:** Embeds `categoryMarketRanks` on each keyword-trend notification at generation time, so the
Dashboard's Markets Reveal doesn't need a second round-trip once it swaps off the fixture. Corrects
`category-scoped-ranking.md`'s "Option 2" premise — see the pseudocode's note.
**Prototype reference:** none — pure backend.

**Project files to add/implement:**
- none new — this card only extends existing files

**Related files:**
- `backend/spring-boot/src/main/java/com/ceview/module2/dto/NotificationDtos.java` — `DetailsDto`
  gains `categoryMarketRanks: List<MarketDto>`
- `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/CategoryRankNotificationService.java`
  — `buildForCategories()` gains a `profileId` param and calls Query & Endpoint's service overload
- `backend/spring-boot/src/main/java/com/ceview/module2/submodule22/NotificationService.java` —
  threads `profileId` through to `buildForCategories()`; its `buildDetails()` call site also needs
  updating for `DetailsDto`'s new trailing `categoryMarketRanks` positional arg, since record
  constructors require every field

**Flow:** [`diagrams/cards/module-2/category-scoped-ranking-alert-embed.mmd`](diagrams/cards/module-2/category-scoped-ranking-alert-embed.mmd)

**Steps (pseudocode):** [`pseudocode/module-2/category-scoped-ranking-alert-embed.ts`](pseudocode/module-2/category-scoped-ranking-alert-embed.ts)

**Milestone (finished state):** A keyword-trend notification's JSON response includes a non-empty
`categoryMarketRanks` array whose order matches `GET /forecasting/markets?category=<that category>`
for the same profile.

**Definition of Done:**
- [ ] `CategoryRankNotificationServiceTest` extended: `categoryMarketRanks` present and correctly
      ordered for a seeded profile+category
- [ ] `NotificationServiceTest` extended: `profileId` reaches `buildForCategories()` unchanged
- [ ] Code review approved

**Verification:**
```
cd backend/spring-boot && ./mvnw test -Dtest=NotificationServiceTest,CategoryRankNotificationServiceTest
```
