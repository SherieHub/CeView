// ---- components/module-2/2.2-market-radar/InsightsTabs.tsx ----
props: { market, activeTab, onTabChange }  // activeTab owned by Card 13's drawer, not local state
imports: PurchasingPowerTab, SeasonalPatternsTab

render: two-tab switcher ("Purchasing power"/"Seasonal patterns") +
        activeTab === 'economy' ? PurchasingPowerTab(market) : SeasonalPatternsTab(market) +
        route & carriers list (market.airlines) below both tabs, not tab-specific

// ---- components/module-2/2.2-market-radar/PurchasingPowerTab.tsx ----
props: { market }
render: KPI tiles (forex rate, GDP, avg flight price, accessibility score) +
        AI economic insight paragraph + 12-month forex trend chart + 5-year GDP trend chart

// ---- components/module-2/2.2-market-radar/SeasonalPatternsTab.tsx ----
props: { market }

function seasonalityBand(score): 'weak'|'emerging'|'likely'|'confirmed'  // threshold mapping

render: seasonality score + band + YoY ratio chip (N/A if market.yoyRatio is null, i.e. <59 weeks
        history) + 12-month peak calendar grid (highlights market.peakMonths) +
        AI seasonality insight paragraph + full 24-week chart (history + forecast)
