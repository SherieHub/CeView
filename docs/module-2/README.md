# Module 2 — Market Radar & Notifications

Forecasts inbound-traveler demand surges into Cebu from tracked international markets (South Korea,
Japan, United States) and surfaces them as alerts scoped to each operator's business categories.

## Screens

| Screen | Route | Doc |
|---|---|---|
| Dashboard | `/dashboard` | [`screens/dashboard.md`](screens/dashboard.md) |
| Market Radar (drawer) | `/dashboard?market=<id>` | [`screens/market-radar-drawer.md`](screens/market-radar-drawer.md) |

## Backend

| Component | Doc |
|---|---|
| Category-scoped ranking requirement | [`backend/category-scoped-ranking.md`](backend/category-scoped-ranking.md) |

Full existing backend detail (controllers, services, entities, DTOs, FastAPI internal endpoints) is
documented in [`MODULE2_SYSTEM_DOCUMENTATION.md`](MODULE2_SYSTEM_DOCUMENTATION.md) and the companion
diagrams below — unchanged by the overhaul except for the category-scoping requirement above.

## Diagrams and submodule detail

- [`class.puml`](class.puml) / [`class.mmd`](class.mmd) — Spring Boot + FastAPI class diagram
- [`sequence.puml`](sequence.puml) / [`sequence.mmd`](sequence.mmd) — `GET /markets` and `POST /analyze` flows
- [`er.puml`](er.puml) / [`er.mmd`](er.mmd) — all 7 Module 2 database tables
- [`module-2.1/`](module-2.1/) — Market Data Ingestion (scheduled cron jobs)
- [`module-2.2/`](module-2.2/) — On-demand AI forecasting pipeline
- [`m2.2ERD+Components/COMPONENTS.md`](m2.2ERD+Components/COMPONENTS.md) — submodule 2.2 component detail

## Changed in the UI/UX overhaul

Source of truth: [`ui-ux-prototype.html`](../../ui-ux-prototype.html). Full rationale and card-by-card
build plan: [`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md)
(Dashboard and Market Radar Drawer cards: [`03-module-2.md`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md)).

- `HomeView.tsx` is replaced by [`DashboardView`](screens/dashboard.md) — a master/detail alert
  command center scoped to the operator's own categories, not a flat notification list.
- `MarketRadarView.tsx` is no longer a full screen; it becomes the
  [Market Radar drawer](screens/market-radar-drawer.md), opened from a rank card and addressed by
  `?market=<id>`.
- Market ranking becomes category-scoped: selecting an alert re-ranks markets for that alert's
  specific category rather than showing one fixed global top-3. See
  [`backend/category-scoped-ranking.md`](backend/category-scoped-ranking.md) for the backend work
  this requires.
