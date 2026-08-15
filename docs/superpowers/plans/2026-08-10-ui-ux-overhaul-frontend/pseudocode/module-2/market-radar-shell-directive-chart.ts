// ---- components/module-2/2.2-market-radar/MarketRadarDrawer.tsx ----
imports: useEffect, useState, useNavigate, useSearchParams, Drawer, MOCK_MARKETS,
         DemandForecastChart, InsightsTabs (Card 14)

function MarketRadarDrawer():
  marketId ← searchParams.get('market')
  market ← MOCK_MARKETS.find(m => m.id === marketId) ?? null
  state: timeframe ← '4WK', activeTab ← 'economy' (Card 14 scope)

  on marketId change → reset timeframe to '4WK', activeTab to 'economy'

  close(): clear ?market= param  // Drawer's scrim/Esc/back also route here
  targetThisMarket(): close(); navigate('/content', {targetedMarketId, activeMarketId})

  if !market → render null
  render: Drawer(open=!!market, onClose=close) containing:
    header: rank badge, name, city→Cebu distance/flight-time, close button, "Target this market" CTA
    surge banner if market.spikeIndicator else neutral no-surge banner
    directive text
    DemandForecastChart(chartData, timeframe, onTimeframeChange)
    InsightsTabs(market, activeTab, onTabChange)

// ---- components/module-2/2.2-market-radar/DemandForecastChart.tsx ----
props: { chartData, timeframe, onTimeframeChange }
const ZONES: [Low, Moderate, High peak] each paired with pricing-action guidance

weeks ← timeframe === '4WK' ? 4 : 12
data ← chartData.slice(-weeks)
render: 4WK/12WK toggle buttons, Recharts LineChart(history + forecast lines), zone-key legend
