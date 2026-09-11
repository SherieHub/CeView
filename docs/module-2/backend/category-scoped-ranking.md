# Backend requirement — category-scoped market ranking

The Dashboard ranks markets for the selected alert's **persisted category**.
There is no `categoryMarketRanks` response field and no alert-time embedded
market list. The active path is deliberately simpler:

```text
DemandAlert.category
  → apiClient.markets.forCategory(category)
  → GET /api/forecasting/markets?category=<category>
  → ForecastingService.listMarkets(profile, category)
  → MarketDto[] sorted for that category
```

`DemandAlert` carries `business_profile_id` and `category` (V29), so the
notification read is tenant-scoped before the category value reaches the
frontend. `ForecastingService` uses the category-scoped signal and forecast
records; it does not maintain a separate `(category, market)` score table.

The endpoint returns the ordinary `MarketDto` shape — rank, match score, real
chart points, forecast provenance, insights and route facts. This makes the
drawer receive exactly the same data that rendered the rank card, with no
second hidden contract or alert-side snapshot to go stale.

The fixture-only `marketsForCategory()` function mirrors this endpoint for
development previews. It is not a production data source.
