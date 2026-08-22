// ---- components/module-2/2.1-dashboard/MarketsRevealPanel.tsx ----
// Replaces the M2-F stub. Implements MarketsRevealSlotProps from dashboardTypes.ts.
props: { selectedAlert }
imports: useNavigate, marketsForCategory, RankCard, RankingFormulaCard

rankedMarkets ← selectedAlert ? marketsForCategory(selectedAlert.category) : null
  // marketsForCategory is the Foundation — Fixture Data Layer fixture stand-in for the real
  // GET /forecasting/markets?category= endpoint (backend track M2-B1/M2-B2) — swap-in is a
  // separate, later, non-blocking integration task, not part of this card

openMarket(marketId): navigate(`/dashboard?market=${marketId}`)  // opens M2-F's drawer shell

if !rankedMarkets → render null   // DashboardView's grid (M2-F) collapses to single-column automatically
render: rankedMarkets.map(m => <RankCard market={m} onClick={() => openMarket(m.id)}/>) + <RankingFormulaCard/>

// ---- components/module-2/2.1-dashboard/RankCard.tsx ----
props: { market, onClick }
surgeActive ← market.chartData.some(p => p.spike === 1)
render: rank number, 0-100 market-potential bar, city+distance, direct/via-Manila + flight hours +
        frequency, surge chip if surgeActive

// ---- components/module-2/2.1-dashboard/RankingFormulaCard.tsx ----
render: static formula text "market_score = 0.40·demand₄w + 0.35·seasonality + 0.25·economic_viability"
