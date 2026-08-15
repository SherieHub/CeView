// ---- components/module-2/2.1-dashboard/DashboardView.tsx (additions) ----
imports: useNavigate, useSearchParams, marketsForCategory, RankCard, RankingFormulaCard

selectedAlert ← visible.find(n => n.id === selectedId) ?? null
  // a stale selection (e.g. from before categories changed) is only non-null if still in `visible`

rankedMarkets ← (selectedAlert AND mode in ['normal','ai-down'])
  ? marketsForCategory(selectedAlert.category) : null

selectAlert(alert):  // extends Card 10's version
  setSelectedId(id => id === alert.id ? null : alert.id)  // clicking same alert again deselects
  // ...mark-read side effect from Card 10

openMarket(marketId): navigate(`/dashboard?market=${marketId}`)  // opens Card 13's drawer

render: if rankedMarkets → two-column layout (feed | rankedMarkets.map(RankCard) + RankingFormulaCard)
        else → Card 10's single column

// ---- components/module-2/2.1-dashboard/RankCard.tsx ----
props: { market, onClick }
surgeActive ← market.chartData.some(p => p.spike === 1)
render: rank number, 0-100 market-potential bar, city+distance, direct/via-Manila + flight hours +
        frequency, surge chip if surgeActive

// ---- components/module-2/2.1-dashboard/RankingFormulaCard.tsx ----
render: static formula text "market_score = 0.40·demand₄w + 0.35·seasonality + 0.25·economic_viability"
