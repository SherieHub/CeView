# Module 2 task-card revamp: parallel-first structure

## Context

Module 2 ("Market Radar & Notifications") currently has 5 frontend task cards (Cards 10-14 in
`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md`), none of them built yet
(both target files — `DashboardView.tsx` and `MarketRadarDrawer.tsx` — are stub placeholders today).
Their declared dependencies (`Card 10`, `Card 10`, `Card 10`, `Card 13`) look parallel-ish on paper,
but the real blocker is undeclared: Cards 10, 11, and 12 all extend the same `DashboardView.tsx`
file, so building them "in parallel" would mean merge conflicts in practice. Card 14 also
legitimately depends on Card 13 today for shared tab state. Separately, Module 2 has a real backend
gap — category-scoped market ranking (`docs/module-2/backend/category-scoped-ranking.md`) — that's
spec-only today and stood in for by a frontend fixture, with no task card tracking it at all.

The goal of this revamp: (1) restructure Module 2's cards so a single foundation/prerequisite card is
the only blocker, after which every other Module 2 card — including new backend cards — can proceed
fully in parallel; and (2) write this "foundation card gates everything else in the module" pattern
into the shared card-authoring convention (`00-index.md`) as a binding rule for all modules going
forward, without rewriting Modules 1/3/4's existing card content in this pass.

## Numbering scheme change (repo-wide, minimal edit surface)

Replace global sequential card numbers (0-27) with module-scoped IDs: `M<n>-F[k]` for foundation
cards, `M<n>-<k>` for regular cards, `M<n>-B<k>` for a module's backend track. This makes card counts
immune to renumbering ripples when a module's card count changes later — exactly the problem this
revamp hits today (adding cards to Module 2 would otherwise force renumbering Modules 3 and 4).

Scope of this change:

- **Edit:** `00-index.md`'s dependency-graph table — convert all rows (Foundation, Modules 1-4) to
  the new ID format — and its Card template / Field guide section, which gets the new binding rule
  below.
- **Do not edit:** the body content of `01-foundation.md`, `02-module-1.md`, `04-module-3.md`,
  `05-module-4.md`. Their in-file "Card N" references stay as legacy local numbers; each is already
  paired with a card name, so nothing breaks — retrofitting their IDs is future work, not this pass.
- **Rewrite:** `03-module-2.md` fully, using the new ID scheme end to end. Module 2 is the one file
  this pass fully owns.

New binding rule to add to `00-index.md`'s Card template / Field guide section:

> Every module file must open with one or more `Foundation — <Module>` card(s) that every other card
> in that module depends on directly, and — aside from a module's own independent track roots (e.g. a
> backend track parallel to the frontend track) — that is the *only* thing sibling cards may depend
> on within the module. Sibling cards must never list the same file under "Project files to
> add/implement"; if two features would naturally share a file, the foundation card owns that file
> (creating typed stubs/slots for the pieces sibling cards will fill in) and each sibling card fully
> owns replacing its one assigned stub.

## Module 2 new card structure

### Frontend track (`frontend/`)

All target files are stubs today, so this is a clean split with no migration risk.

**M2-F — Foundation: Dashboard & Radar Shell**
Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer.
Creates the two page shells and the typed contracts every sibling card fills in:

- `components/module-2/2.1-dashboard/DashboardView.tsx` — layout grid, `useDashboardState()` 6-state
  hook, category-filter context wiring; composes three named slot components by fixed import path.
- `components/module-2/2.1-dashboard/dashboardTypes.ts` — the 6-state discriminated union + each
  slot's prop contract.
- `components/module-2/2.1-dashboard/AlertFeed.tsx`, `MarketsRevealPanel.tsx`,
  `RefreshForecastButton.tsx` — **stub placeholders only** (same style as today's stub files);
  ownership of each transfers whole to one sibling card below.
- `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` — drawer shell: `?market=` URL mount,
  scrim/Esc/back-button close, header, owns `activeInsightsTab` state, composes two body slot
  components by fixed import path.
- `components/module-2/2.2-market-radar/radarTypes.ts` — drawer slot prop contracts.
- `components/module-2/2.2-market-radar/DrawerChartPanel.tsx`, `InsightsTabs.tsx` — stub
  placeholders; ownership transfers whole to sibling cards below.

Milestone: `/dashboard` renders the shell with slot placeholders visible; the drawer opens/closes
correctly via URL state — before any feature card fills in real content.

**M2-1 — Dashboard: Alert Feed & Category Filtering**
Depends on: M2-F only. Replaces the `AlertFeed.tsx` stub; adds `AlertCard.tsx`. (Old Card 10's
feature content, minus the shell.)

**M2-2 — Dashboard: Markets Reveal**
Depends on: M2-F only — not M2-1, a true sibling now. Replaces the `MarketsRevealPanel.tsx` stub;
adds `RankCard.tsx`, `RankingFormulaCard.tsx`. Consumes the `marketsForCategory()` fixture today;
swaps to the real `GET /forecasting/markets?category=` endpoint from the backend track (M2-B1) later
— a future non-blocking swap-in, not a hard dependency.

**M2-3 — Dashboard: States & Refresh Forecast**
Depends on: M2-F only. Replaces the `RefreshForecastButton.tsx` stub; implements the remaining 4
dashboard states using `dashboardTypes.ts`'s union — no shared-file edits to `DashboardView.tsx`.

**M2-4 — Market Radar Drawer: Directive & Demand Chart**
Depends on: M2-F only — not M2-5. Replaces the `DrawerChartPanel.tsx` stub; adds
`DemandForecastChart.tsx`.

**M2-5 — Market Radar Drawer: Economic & Seasonal Insights Tabs**
Depends on: M2-F only — not M2-4, a true sibling now, since M2-F owns the shared tab state. Replaces
the `InsightsTabs.tsx` stub; adds `PurchasingPowerTab.tsx`, `SeasonalPatternsTab.tsx`.

All five (M2-1..M2-5) can be built simultaneously once M2-F merges — no cross-dependencies, no shared
files.

### Backend track (repo root / `backend/`)

Parallel to the entire frontend track. Implements
`docs/module-2/backend/category-scoped-ranking.md`'s recommended option 1 (parameterized endpoint) as
primary, plus option 2 (alert-time embed) on top of it.

**M2-B1 — Category-Scoped Market Ranking: Query & Endpoint**
Depends on: — (root; builds only on already-merged `ForecastingService`/`tbl_market_score`). Adds
`GET /api/forecasting/markets?category=` — a category-weighted score computed from existing
per-(category, market) signal data (the 21-job grid `TrendFetchSchedulerService` already produces),
returned via the existing `MarketDto` shape.

**M2-B2 — Category-Scoped Market Ranking: Alert-Time Rank Embed**
Depends on: M2-B1. Extends `NotificationDto`/`DemandAlert` generation to call M2-B1's service at
alert-creation time and embed `categoryMarketRanks: MarketDto[]`, avoiding a second round-trip when
the Dashboard selects an alert.

M2-B1 can start the moment this design is approved — no dependency on anything else in this revamp.
M2-B2 follows M2-B1. Neither blocks nor is blocked by any frontend card: M2-2 keeps using the fixture
until a later, separate integration swap.

## Files this revamp touches

- `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md` — dependency-graph table →
  module-scoped IDs; Card template/Field guide → add the foundation-card binding rule; Playwright spec
  ↔ card map row for Module 2 updated to new IDs.
- `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md` — full rewrite: 8 cards
  (M2-F, M2-1..M2-5, M2-B1, M2-B2) per the structure above, each following the existing card template
  (Depends on / Summary / Prototype reference / Project files / Related files / Flow / Steps /
  Milestone / DoD / Verification). Backend cards use repo-root-relative paths and Spring
  Boot/JUnit-flavored verification commands instead of the frontend template's `npm run test:unit`.
- New Mermaid flow/pseudocode stub files under `diagrams/cards/module-2/` and `pseudocode/module-2/`
  for the cards that don't already have one (M2-F, M2-B1, M2-B2) — same pattern as existing cards.
- No changes to `01-foundation.md`, `02-module-1.md`, `04-module-3.md`, `05-module-4.md`, or any
  frontend/backend source code in this pass — this is a planning-document revamp only.

## Testing / verification

Documentation-only change — no code to run. Verify by:

- Confirming `00-index.md`'s dependency table has no dangling/duplicate IDs, and every "Depends on"
  reference in the new `03-module-2.md` resolves to a real card ID in that table.
- Confirming no two sibling cards in the new `03-module-2.md` list the same file under "Project files
  to add/implement" — the rule this whole redesign exists to enforce.
- Re-reading `03-module-2.md` end to end for internal consistency once written.

## Out of scope

- Rewriting Modules 1, 3, or 4's existing cards to the new ID scheme or foundation-card pattern —
  noted as future work, not done here.
- Actually implementing any of the 8 cards (frontend components, backend endpoint/DTO changes) — this
  spec only restructures the task-card documents.
- Wiring `frontend/` into the Playwright e2e suite — stays deferred per `00-index.md`'s existing
  Testing Strategy, unchanged by this revamp.
