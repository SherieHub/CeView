/**
 * CARD — Market Radar Drawer: Shell, Directive & Demand Chart
 *   + Market Radar Drawer: Economic & Seasonal Insights Tabs
 * Depends on: Card 10 (Dashboard must exist to open the drawer from)
 * Screen doc: docs/module-2/screens/market-radar-drawer.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 *
 * Replaces the full-screen MarketRadarView.tsx. Opens via ?market=<id> on /dashboard,
 * closable via scrim/Esc/browser back.
 *
 * TODO (Shell, Directive & Demand Chart):
 * - Drawer header (rank badge, market name, city->Cebu distance/flight-time, close,
 *   "Target this market" CTA)
 * - Surge/no-surge banner, AI strategic directive card
 * - DemandForecastChart.tsx with 4WK/12WK toggle and the zone-key legend
 *   (Low/Moderate/High peak, each with a pricing action line)
 * - "Target this market" — closes drawer, navigates to /content, sets
 *   targetedMarketId + activeMarketId
 *
 * TODO (Economic & Seasonal Insights Tabs):
 * - "Purchasing power" tab — forex/GDP/avg-flight-price/accessibility KPI tiles, AI
 *   economic insight paragraph, forex 12-month + GDP 5-year mini trend charts
 * - "Seasonal patterns" tab — seasonality score + band, YoY ratio chip (N/A below 59
 *   weeks), 12-month peak calendar grid, AI seasonality insight paragraph, full 24-week
 *   seasonality chart
 * - Route & carriers list below the tabs
 * - Switching tabs must not lose the drawer's scroll position or the open chart timeframe
 *
 * MarketRadarDrawer.test.tsx: 4WK/12WK toggle, surge/no-surge banner branch, tab switch
 * rendering the correct panel.
 */
export default function MarketRadarDrawer() {
  return (
    <div className="drawer empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Market Radar</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Market Radar Drawer: Shell, Directive &amp; Demand
        Chart in 03-module-2.md.
      </p>
    </div>
  );
}
