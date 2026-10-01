# Market Radar Drawer — Implementation Plan

**Scope:** `frontend/` only. UI/UX only — no backend, no Spring Boot, no FastAPI. All data comes
from fixtures.

Builds on the existing cards **M2-F**, **M2-4** and **M2-5** in
[`03-module-2.md`](2026-08-10-ui-ux-overhaul-frontend/03-module-2.md), which already specify the
drawer's deliverables. This plan adds what those cards predate: the design language established by
the Dashboard, and the mock-data quarantine.

---

## Context

The Market Radar drawer is the last unbuilt piece of Module 2's frontend. Four files exist as stubs:
`MarketRadarDrawer.tsx`, `DemandForecastChart.tsx`, and the two slot placeholders.

It opens as an overlay on `/dashboard?market=<id>` — deliberately not its own route. The operator
arrived by drilling into one market from one alert's ranked list, and a drawer keeps that context
one click away. The Dashboard already calls `openMarket()` from two places (rank cards and the
top-market tile), so the entry points are wired and currently go nowhere.

**Outcome:** clicking any market opens a drawer that reads as the same product as the Dashboard —
same chips, same cards, same type scale, same spacing — with every element from
[`market-radar-drawer.md`](../../module-2/screens/market-radar-drawer.md) present.

---

## Part 1 — Mock data quarantine (do this first)

Requested as part of this work, and it should land before the drawer so new fixtures follow the
settled convention rather than being retrofitted.

### What the audit found

`services/fixtures/` is in good shape: 8 files, every one reached through `apiClient`'s
`USE_FIXTURES` branch, so a single flag swaps the whole app between mock and real. That is the
pattern to preserve.

Three things sit outside it:

| Leak | Where | Problem |
|---|---|---|
| `DEMO_BUSINESS` | `components/module-1/onboarding/steps/BasicInfoStep.tsx:33` | Demo data in a screen file — **and it powers a "Fill with demo business" button that ships to production** |
| `DEMO_OB_DRAFT` | `components/module-1/onboarding/obDraft.tsx:54` | Demo data in a state module |
| `MOCK_CONNECTIONS`, `MOCK_POST_METRICS` | `services/apiClient.ts:44,51` | Defined inline in the client instead of imported from `fixtures/` |

**The same business is defined three times** — `DEMO_BUSINESS`, `DEMO_OB_DRAFT`, and
`fixtures/profile.ts`'s `DEMO_PROFILE` — all "Sunset Cove Beach Resort", with **three different
descriptions and UVPs**. They have already drifted.

### Steps

1. **Create `services/fixtures/demoBusiness.ts`** — one Sunset Cove definition, exported as the
   `ObDraft` shape. Pick whichever description reads best; the other two go.
2. **Re-export from `obDraft.tsx` and `BasicInfoStep.tsx`** rather than redefining, or update their
   importers. `DEMO_OB_DRAFT` is used by `App.tsx`'s preview route and 6 assertions in
   `OnboardingWizard.test.tsx`; `DEMO_BUSINESS` by the button and `BasicInfoStep.test.tsx`.
3. **Move `MOCK_CONNECTIONS` and `MOCK_POST_METRICS`** into `fixtures/connections.ts` and
   `fixtures/postMetrics.ts`, imported like every other fixture.
4. **Gate the "Fill with demo business" button behind `import.meta.env.DEV`**, the same guard the
   preview routes use. It is a development affordance; today a real operator sees it on step 1 of
   onboarding and can overwrite their own profile with a fictional resort.
5. **Add a header block to `fixtures/index.ts`** (new barrel) stating that deleting this directory
   plus the `USE_FIXTURES` branches in `apiClient.ts` removes all mock data — so the deployment step
   is one documented action rather than a hunt.

**Done when:** `grep -rn "DEMO_\|MOCK_" components/ layout/ services/*.ts` returns only imports, no
definitions.

---

## Part 2 — Design consistency with the Dashboard

The drawer must not look like a different app. These are the rules the Dashboard now follows; the
drawer inherits all of them rather than inventing its own.

**Reuse, do not rebuild:** `.chip` (+ `--accent` / `--attention` / `--critical` / `--success`),
`.bar` / `.bar--lead`, `.banner` (+ `--warn` / `--info`), `.seg`, `.skel`, `.spinner`, `.card`,
`.empty`, `.stat-*`, `.btn-cta` / `.btn-outline`, `.eyebrow`, `.num`, `.heading-*`, `.body-*`,
`.text-meta`.

| Concern | Rule |
|---|---|
| Section headings | `.heading-md` at 20px, Title Case ("Demand Forecast", "Purchasing Power") |
| Body copy | 14px / 1.55, `--color-text-body`. **Never `--color-text-muted` for anything that must be read** — it is 2.98:1 on white |
| Card padding | `var(--space-md)` (24px) |
| Stack gaps | `gap-4` (16px) between cards, `--space-lg` between major zones |
| Chips | 13px, `padding: 5px 12px` — one `.chip` definition, do not add a second rule |
| KPI tiles | Reuse the Dashboard's `.stat-tile` structure (icon block, right-aligned label + value, ruled footer) |
| Timeframe toggle | `.seg` with `aria-pressed`, same control as the feed filter |
| Motion | Everything decorative behind `prefers-reduced-motion` |
| Contrast | Every new colour pairing measured before use. Coral and mint are **fill** tones — `--color-coral-text` / `--color-navy-dark` for text on them |

### Two shell problems to fix first

**`components/shared/Drawer.tsx` is still on legacy tokens** — `bg-panel`, `bg-panel-sunk`,
`shadow-3`. It is one of the last three files referencing them (with `Modal.tsx` and
`RoutePlaceholder.tsx`) and will visibly clash with the branded Dashboard behind it. Give it the
same treatment the sidebar got: `--color-white` surface, `--shadow-overlay`, `--radius-md`, and an
`.icon-btn` close control.

**`max-w-md` (448px) is too narrow.** The spec puts four KPI tiles, two mini trend charts, a
24-week chart and a 12-month calendar grid in this drawer. Widen to ~560px, and make it full-width
below 640px.

---

## Part 3 — The drawer

### 3a. Shell — `MarketRadarDrawer.tsx` (M2-F)

Replaces the stub. Mounted from `DashboardView`, driven by `?market=<id>`.

- Reads `searchParams.get('market')`, resolves against the already-loaded markets — **no fetch on
  open**, per the screen doc; `marketById` is a pure lookup
- Closes via scrim, Esc and browser back — the `useOverlayStack` primitive already handles the first
  two; back is `setSearchParams({})`
- Owns `timeframe: '4WK' | '12WK'` and `activeTab: 'economy' | 'season'`, passed down as the two
  slot contracts in `radarTypes.ts`
- **Resets both on market change** — opening a second market must not inherit the first one's tab
- Header: rank badge, market name, city → Cebu distance and flight time, close button, and a
  full-width **"Target this market"** CTA (`.btn-cta`)
- An unknown or missing `?market=` id closes rather than rendering an empty drawer

### 3b. Directive & demand chart — `DrawerChartPanel.tsx` + `DemandForecastChart.tsx` (M2-4)

- **Surge banner** — `.banner--critical` when `spikeIndicator`, `.banner--info` otherwise
- **AI strategic directive** — `.card` holding the market's `directive` string
- **Demand chart** — Recharts (already a dependency, v3.5.1). `chartData` is 24 points: 12 history
  (`history` set, `forecast` null) then 12 forecast (the reverse). The 4WK/12WK toggle slices the
  forecast half; history is always shown
- **Zone-key legend** — Low 0–30 / Moderate 31–70 / High peak 71–100, each with its one-line pricing
  action. Use `--color-mint-pale` / `--color-teal-accent` / `--color-coral-cta` as bands, not the
  semantic state colours
- **"Target this market"** closes the drawer, navigates to `/content`, sets `targetedMarketId` and
  `activeMarketId`. `/content` is still `RoutePlaceholder` — navigate anyway; the placeholder is the
  correct destination

### 3c. Insights tabs — `InsightsTabs.tsx` + two panels (M2-5)

`.seg`-style tab control, `role="tablist"`, panels with `role="tabpanel"`.

**Purchasing power** — four KPI tiles (forex rate, GDP growth, avg flight price, accessibility
score) reusing `.stat-tile`; the `economyInsight` paragraph; forex 12-month and GDP 5-year mini
trend charts from `forexTrend` / `gdpTrend`.

**Seasonal patterns** — seasonality score with its band (Strong ≥0.85 / Moderate ≥0.70 /
Weak-Emerging ≥0.40 / no basis below); YoY ratio chip, **rendered "N/A" when `yoyRatio` is null**
(the fixture has one such market — that branch is real, not hypothetical); a 12-month peak calendar
grid from `peakMonths`; the `seasonalityInsight` paragraph; the full 24-week seasonality chart.

**Route & carriers list** below the tabs — `airlines[]` with name, code, frequency, direct flag.

> Switching tabs must not lose the drawer's scroll position or the sibling-owned chart timeframe.
> That is the milestone for this card, and it is easy to break by remounting the panel.

### Data — already complete, no new fixtures needed

`fixtures/markets.ts`'s `Market` interface carries every field the drawer needs: `directive`,
`chartData` (24 pts), `seasonalityScore`, `yoyRatio`, `spikeIndicator`, `economyInsight`,
`seasonalityInsight`, `gdpTrend`, `forexTrend`, `peakMonths`, `airlines`, `avgFlightPrice`,
`accessibilityScore`, `forexLabel`, `nearestAirport`, `destinationAirport`. **Nothing new to
author** — a good sign the fixture layer was designed for this screen.

---

## Build order

| # | Commit |
|---|---|
| 1 | `refactor(fixtures): consolidate demo data into services/fixtures` — Part 1, steps 1–3, 5 |
| 2 | `fix(module-1): gate the demo-fill button behind DEV` — Part 1, step 4 |
| 3 | `feat(shared): port Drawer and Modal onto brand tokens` — retires the last legacy usages |
| 4 | `feat(module-2): market radar drawer shell` — M2-F |
| 5 | `feat(module-2): surge banner, directive and demand chart` — M2-4 |
| 6 | `feat(module-2): purchasing power and seasonal patterns tabs` — M2-5 |

1–3 are independent of the drawer and can land first on their own. 5 and 6 are siblings — the shell
owns the shared state, so they touch disjoint files.

---

## Verification

**Tests** (current baseline: 23 files / 173 passing)

- `MarketRadarDrawer.test.tsx` — URL-driven open/close; timeframe and tab **reset on market change**;
  unknown id closes rather than rendering empty
- `DrawerChartPanel.test.tsx` — 4WK/12WK slices the forecast; surge vs no-surge banner branch
- `InsightsTabs.test.tsx` — tab switch renders the correct panel; `aria-selected` follows
- `SeasonalPatternsTab.test.tsx` — the four band thresholds; **`yoyRatio: null` renders "N/A"**
- `fixtures.test.ts` — one Sunset Cove definition, and no `DEMO_`/`MOCK_` outside `fixtures/`

Gates: `npm run test`, `npx tsc --noEmit`, `npm run build`.

**Manual** — `VITE_USE_FIXTURES=true npm run dev`, then `/preview/dashboard`

1. Open the drawer from a rank card **and** from the top-market tile — both call `openMarket()`
2. Close via scrim, Esc, and browser back
3. Switch market without closing — tab and timeframe must reset
4. Toggle 4WK/12WK, then switch tabs — the timeframe must survive
5. Open the market whose `yoyRatio` is null and confirm "N/A"
6. Side by side with the Dashboard: chips, cards, headings and spacing must be indistinguishable
7. 1440 → 1200 → 900 → 500, keyboard-only, and `prefers-reduced-motion`

---

## Out of scope

- **All backend work.** M2-B1 and M2-B2 (the category-scoped ranking endpoint) stay unbuilt; the
  drawer reads fixtures only
- Wiring `/content` — "Target this market" navigates to the existing placeholder
- Deleting the fixtures. Part 1 makes that a one-step action later; it is not this plan's job
