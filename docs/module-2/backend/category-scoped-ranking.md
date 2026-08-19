# Backend requirement — category-scoped market ranking

The [Dashboard](../screens/dashboard.md)'s markets reveal ranks the three tracked markets
**per the selected alert's category**, using distinct affinity scores per (category, market) pair —
not one fixed top-3 ranking reused everywhere. This is a **specification**, not yet implemented.

## Current behavior

`ForecastingService` computes one `market_score` per market
(`demand₄w × 0.40 + seasonality × 0.35 + economic_viability × 0.25`, per
`tbl_market_score`) and one global rank (1–3), independent of business category.
`GET /api/v1/forecasting/markets` returns that single ranking for every caller.

## Required behavior

Ranking must vary by the business's category so that, e.g., Korea ranks differently for
"Culinary & Gastronomy" (Korean food-tourism searches are high) than for "Cultural & Heritage"
(where Japan leads). Two implementation options, either acceptable:

1. **Parameterize the endpoint.** `GET /api/v1/forecasting/markets?category=<name>` computes or looks
   up a `market_score` specific to that category. Requires either a `(category, market)` composite
   scoring table, or a category-weighted adjustment applied to the existing per-market signals at
   request time.
2. **Carry the score on the alert.** Each `DemandAlert` already has exactly one `category` (it's
   generated per `(category, market)` combination — see `TrendFetchSchedulerService`'s 21-job grid,
   7 categories × 3 markets). Extend `NotificationDto` to carry a `categoryMarketRanks: MarketDto[]`
   field computed at alert-generation time, so the Dashboard doesn't need a second round-trip when an
   alert is selected.

Option 2 matches how the alert is already scoped in the data model and avoids a new query path on
selection; option 1 is more general if markets need to be ranked for a category the operator hasn't
received an alert for yet (e.g. from Settings after adding a category). Recommend implementing option
1 as the primary mechanism and having alert generation call it, satisfying both.

## Frontend contract

Whichever is chosen, the Dashboard needs, for a given category: the same `MarketDto` shape already
returned by `listMarkets` (rank, matchScore, chart data, insights, flight/route data), just re-scored
and re-sorted for that category. No new fields are needed on `MarketDto` itself.

## Implementation status

Implemented by [M2-B1](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md#card--category-scoped-market-ranking-query--endpoint)
and [M2-B2](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md#card--category-scoped-market-ranking-alert-time-rank-embed)
as option 1 above (parameterized endpoint), re-ranking the existing per-market results via
`CategoryRankNotificationService`'s existing `rankMarketsForCategory()` call rather than a new
`(category, market)` scoring table. **Correction to "Option 2" above:** `DemandAlert` has no
`category` column in the actual schema — alerts are generated per `(profile, market)` only, not per
`(category, market)`; there is no 21-job category×market grid feeding `DemandAlert` — that grid,
`TrendFetchSchedulerService`'s, feeds `TrendFetchJob`/keyword-trend notifications instead. M2-B2
embeds `categoryMarketRanks` on the keyword-trend `NotificationDto` — which already is generated once
per profile category — achieving the same round-trip savings without a schema change.

## Fixture stand-in

Until built, the frontend computes this client-side against fixture data using the same
`(category, market) → matchScore` lookup table the prototype hand-authors
(`CATEGORY_MARKET_SCORES`, [`ui-ux-prototype.html:1199–1220`](../../../ui-ux-prototype.html#L1199)) —
see the [Fixture Data Layer card](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-fixture-data-layer)
and the [Dashboard: Markets Reveal card](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md#card--dashboard-markets-reveal).
