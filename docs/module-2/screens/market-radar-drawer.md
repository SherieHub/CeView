# Screen (drawer) — Market Radar

**Route:** overlay on `/dashboard?market=<id>` (not a route of its own) · **Module:** 2 · **Access:**
authenticated.

**Prototype reference:** [`ui-ux-prototype.html:2518–2667`](../../../ui-ux-prototype.html#L2518)
(`openRadar`, `renderRadar`, `targetThisMarket`).

**Component:** `components/module-2/2.2-market-radar/MarketRadarDrawer.tsx` (replaces
`MarketRadarView.tsx` as a full screen).

## Why this is now a drawer, not a screen

The prototype opens Market Radar as a right-side drawer over the Dashboard rather than routing to a
separate page — the operator arrived here by drilling into one market from one alert's ranked list,
and a drawer keeps that context (the alert feed, the other ranked markets) visible and one click away
via the scrim. State is carried in the URL (`?market=<id>`) so it is linkable, shareable, and
survives a refresh, and the browser back button closes it (per the
[Shell & Routing card's overlay stack rules](../../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md#card--foundation-shell--routing)).

## Layout

Drawer header: rank badge, market name, city → Cebu distance/flight-time, close button, "Target this
market" CTA (full-width, gold). Drawer body, top to bottom: surge/no-surge banner, AI strategic
directive card, demand forecast chart with a 4WK/12WK timeframe toggle and a zone-key legend (Low
0–30 / Moderate 31–70 / High peak 71–100, each with a one-line pricing action), a two-tab economic
insights card (Purchasing power / Seasonal patterns), and a route & carriers list.

## State

```
activeMarketId: string          // which market's data is loaded
radarTf: '4WK' | '12WK'
radarTab: 'economy' | 'season'
```

## Tabs

- **Purchasing power** — forex rate, GDP growth, average flight price, accessibility score as four
  KPI tiles; a paragraph of AI-generated economic insight; forex 12-month and GDP 5-year mini trend
  charts.
- **Seasonal patterns** — seasonality score + band (Strong ≥0.85 / Moderate ≥0.70 / Weak-Emerging
  ≥0.40 / No seasonal basis below), YoY ratio chip (N/A below 59 weeks of history), a 12-month peak
  calendar grid, an AI-generated seasonality insight paragraph, and the full 24-week seasonality index
  chart.

## Interaction

- **Target this market** — closes the drawer, navigates to `/content`, and (per the current content
  generation flow) triggers content generation scoped to this market. Sets `targetedMarketId` and
  `activeMarketId` in shared state.

## API calls

Reuses the Dashboard's already-loaded `markets` list — no separate fetch on drawer open, per the
prototype (`marketById` is a pure lookup against data already in memory). If markets data needs
refreshing independently of the Dashboard mount, that is out of scope for this drawer.

## Child components

`DemandForecastChart`, `EconomicInsightsBoard`, `StrategicDirectivePanel`, `MetricHighlight` — all
existing, reused with the timeframe/tab state now owned by the drawer instead of a full-page view.
