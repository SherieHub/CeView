// ---- components/module-2/2.2-market-radar/DrawerChartPanel.tsx ----
// Replaces the M2-F stub. Implements DrawerChartSlotProps from radarTypes.ts.
props: { market, timeframe, onTimeframeChange }
imports: DemandForecastChart

render: surge banner if market.spikeIndicator else neutral no-surge banner,
        AI strategic directive text (market.directive),
        <DemandForecastChart chartData={market.chartData} timeframe={timeframe}
                              onTimeframeChange={onTimeframeChange}/>

// ---- components/module-2/2.2-market-radar/DemandForecastChart.tsx ----
props: { chartData, timeframe, onTimeframeChange }
const ZONES: [Low, Moderate, High peak] each paired with pricing-action guidance

weeks ← timeframe === '4WK' ? 4 : 12
data ← chartData.slice(-weeks)
render: 4WK/12WK toggle buttons, Recharts LineChart(history + forecast lines), zone-key legend
