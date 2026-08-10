# Module 2 — Market Radar & Notifications

Screen docs: [`docs/module-2/screens/dashboard.md`](../../../module-2/screens/dashboard.md),
[`market-radar-drawer.md`](../../../module-2/screens/market-radar-drawer.md). Spec files:
`e2e/tests/dashboard.spec.ts` (Cards 10–12), `e2e/tests/market-radar-drawer.spec.ts` (Cards 13–14).

---

### CARD — Dashboard: Alert Feed & Category Filtering

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** `DashboardView.tsx` replaces `HomeView.tsx` — a notification feed filtered to the
operator's own business categories, not a flat unfiltered list.

**Steps:**
- [ ] `components/module-2/2.1-dashboard/DashboardView.tsx` — base layout (page head, alert feed)
- [ ] `AlertCard` component (replaces `TrendAlertCard`) — date, title, alert message, market/category/
      trend chips, unread dot, surge chip
- [ ] Filter: `notifications.filter(n => profile.categories.includes(n.category))`
      (`ui-ux-prototype.html:2376`)
- [ ] Selecting an alert marks it read as a side effect of viewing (not a separate action)

**Milestone (finished state):** `/dashboard` renders only alerts matching the fixture profile's
categories; clicking one marks it read (unread dot disappears) and does not yet reveal markets (Card
11).

**Definition of Done:**
- [ ] `DashboardView.test.tsx` covers the category-filter predicate against a mixed fixture set
- [ ] `dashboard.spec.ts` → "Alert Feed & Category Filtering" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- DashboardView
cd e2e && npx playwright test dashboard.spec.ts -g "Alert Feed & Category Filtering"
```

---

### CARD — Dashboard: Markets Reveal

**Depends on:** Card 10 (Alert Feed & Category Filtering)
**Summary:** Selecting an alert reveals a market ranking computed for that alert's specific category
— the master/detail behavior that is the largest change from `HomeView`.

**Steps:**
- [ ] Two-column layout on selection: alert feed (left) + markets reveal (right); deselecting
      (clicking the same card again) collapses back to single-column
- [ ] `marketsForCategory`-equivalent re-ranking per selected alert's category (fixture-backed for
      now — see [`docs/module-2/backend/category-scoped-ranking.md`](../../../module-2/backend/category-scoped-ranking.md)
      for the real backend requirement this stands in for)
- [ ] Rank cards: rank number, market-potential bar, city + distance, direct/via-Manila + flight
      hours, weekly frequency, surge chip if any chart point is spiking
- [ ] Ranking-formula footer card (`market_score = 0.40·demand₄w + 0.35·seasonality +
      0.25·economic_viability`)
- [ ] Clicking a rank card opens the Market Radar drawer (Card 13) for that market

**Milestone (finished state):** Selecting two alerts of different categories produces visibly
different market rankings in the reveal column.

**Definition of Done:**
- [ ] `DashboardView.test.tsx` extended: re-ranking differs correctly across ≥2 fixture categories
- [ ] `dashboard.spec.ts` → "Markets Reveal" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- DashboardView
cd e2e && npx playwright test dashboard.spec.ts -g "Markets Reveal"
```

---

### CARD — Dashboard: States & Refresh Forecast

**Depends on:** Card 10 (Alert Feed & Category Filtering)
**Summary:** The remaining 4 of 6 dashboard states, plus the Refresh Forecast action.

**Steps:**
- [ ] `loading` — 3 skeleton cards
- [ ] `empty` — "No notifications yet" (no forecast run yet)
- [ ] `normal`, zero matching alerts — "No surge alerts for your categories yet", names the
      categories, points at Settings to widen coverage
- [ ] `ai-down` — amber "AI Forecast Service Unavailable" banner, alerts still render from cache,
      refresh does not produce new predictions
- [ ] "Refresh forecast" button — disables + spinner label during the call, toast on completion

**Milestone (finished state):** All 6 dashboard states (loading/empty/normal-no-alerts/normal-
feed-only/normal-with-reveal/ai-down) are independently reachable via fixture toggles and each renders
its documented content.

**Definition of Done:**
- [ ] `DashboardView.test.tsx` extended: one assertion per state
- [ ] `dashboard.spec.ts` → "States & Refresh Forecast" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- DashboardView
cd e2e && npx playwright test dashboard.spec.ts -g "States & Refresh Forecast"
```

---

### CARD — Market Radar Drawer: Shell, Directive & Demand Chart

**Depends on:** Card 10 (Dashboard must exist to open the drawer from)
**Summary:** `MarketRadarDrawer.tsx` replaces the full-screen `MarketRadarView.tsx` — opens via
`?market=<id>` on `/dashboard`, closable via scrim/Esc/browser back.

**Steps:**
- [ ] `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` — drawer header (rank badge,
      market name, city→Cebu distance/flight-time, close, "Target this market" CTA)
- [ ] Surge/no-surge banner, AI strategic directive card
- [ ] `DemandForecastChart` with 4WK/12WK toggle and the zone-key legend (Low/Moderate/High peak,
      each with a pricing action line)
- [ ] "Target this market" — closes drawer, navigates to `/content`, sets `targetedMarketId` +
      `activeMarketId`

**Milestone (finished state):** Clicking a rank card on the Dashboard opens the drawer at the correct
URL (`?market=<id>`), showing that market's directive and chart; back button closes it.

**Definition of Done:**
- [ ] `MarketRadarDrawer.test.tsx` covers the 4WK/12WK toggle and the surge/no-surge banner branch
- [ ] `market-radar-drawer.spec.ts` → "Shell, Directive & Demand Chart" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- MarketRadarDrawer
cd e2e && npx playwright test market-radar-drawer.spec.ts -g "Shell, Directive & Demand Chart"
```

---

### CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs

**Depends on:** Card 13 (Shell, Directive & Demand Chart)
**Summary:** The two-tab insights card inside the drawer.

**Steps:**
- [ ] "Purchasing power" tab — forex/GDP/avg-flight-price/accessibility KPI tiles, AI economic
      insight paragraph, forex 12-month + GDP 5-year mini trend charts
- [ ] "Seasonal patterns" tab — seasonality score + band, YoY ratio chip (N/A below 59 weeks), 12-
      month peak calendar grid, AI seasonality insight paragraph, full 24-week seasonality chart
- [ ] Route & carriers list below the tabs

**Milestone (finished state):** Switching tabs swaps content without losing the drawer's scroll
position or the open chart timeframe.

**Definition of Done:**
- [ ] `MarketRadarDrawer.test.tsx` extended: tab switch renders the correct panel
- [ ] `market-radar-drawer.spec.ts` → "Economic & Seasonal Insights Tabs" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- MarketRadarDrawer
cd e2e && npx playwright test market-radar-drawer.spec.ts -g "Economic & Seasonal Insights Tabs"
```
