// ---- components/module-2/2.1-dashboard/dashboardTypes.ts ----
export interface AlertFeedSlotProps {
  notifications: Notification[] | null   // null = loading
  profileCategories: string[]
  selectedId: string | null
  onSelect(id: string): void
}
export interface MarketsRevealSlotProps { selectedAlert: Notification | null }
export interface AiStatusBannerSlotProps { visible: boolean }
export interface RefreshForecastSlotProps { disabled?: boolean }

// ---- components/module-2/2.1-dashboard/DashboardView.tsx ----
imports: useEffect, useState, apiClient, useProfile, dashboardTypes,
         AlertFeed, MarketsRevealPanel, AiStatusBanner, RefreshForecastButton

function useDashboardState():
  state: notifications ← null (loading), aiDown ← false, selectedId ← null
  on mount → apiClient.notifications.list()
    → success: setNotifications(list)
    → failure: aiDown ← true   // alerts, if any cached ones exist client-side, still render
  select(id): setSelectedId(id => id === id ? null : id)   // clicking same alert again deselects
  returns { notifications, aiDown, selectedId, select }

function DashboardView():
  { profile } ← useProfile()
  { notifications, aiDown, selectedId, select } ← useDashboardState()
  visible ← notifications?.filter(n => profile.categories.includes(n.category)) ?? []
  selectedAlert ← visible.find(n => n.id === selectedId) ?? null

  render: layout grid —
    <AiStatusBanner visible={aiDown}/>
    two-column when selectedAlert is non-null, else single-column:
      <AlertFeed notifications={notifications} profileCategories={profile.categories}
                 selectedId={selectedId} onSelect={select}/>
      <MarketsRevealPanel selectedAlert={selectedAlert}/>
    <RefreshForecastButton/>

// ---- components/module-2/2.1-dashboard/AlertFeed.tsx (stub) ----
// ---- components/module-2/2.1-dashboard/MarketsRevealPanel.tsx (stub) ----
// ---- components/module-2/2.1-dashboard/AiStatusBanner.tsx (stub) ----
// ---- components/module-2/2.1-dashboard/RefreshForecastButton.tsx (stub) ----
each: typed against its Slot interface in dashboardTypes.ts; renders the same
"Not implemented yet — see CARD M2-<n>" placeholder style DashboardView.tsx uses today.
Ownership of each stub transfers whole to the sibling card named in dashboardTypes.ts's comment above it.

// ---- components/module-2/2.2-market-radar/radarTypes.ts ----
export type InsightsTab = 'economy' | 'seasonality'
export interface DrawerChartSlotProps {
  market: Market
  timeframe: '4WK' | '12WK'
  onTimeframeChange(t: '4WK' | '12WK'): void
}
export interface DrawerInsightsSlotProps {
  market: Market
  activeTab: InsightsTab
  onTabChange(t: InsightsTab): void
}

// ---- components/module-2/2.2-market-radar/MarketRadarDrawer.tsx ----
imports: useSearchParams, useNavigate, Drawer, MOCK_MARKETS, radarTypes, DrawerChartPanel, InsightsTabs

function MarketRadarDrawer():
  marketId ← searchParams.get('market')
  market ← MOCK_MARKETS.find(m => m.id === marketId) ?? null
  state: timeframe ← '4WK', activeTab ← 'economy'
  on marketId change → reset timeframe to '4WK', activeTab to 'economy'
  close(): clear ?market= param  // Drawer's scrim/Esc/back also route here
  targetThisMarket(): close(); navigate('/content', {targetedMarketId: market.id, activeMarketId: market.id})
  if !market → render null
  render: Drawer(open=!!market, onClose=close) containing:
    header (owned here): rank badge, name, city→Cebu distance/flight-time, close, "Target this market" CTA
    <DrawerChartPanel market={market} timeframe={timeframe} onTimeframeChange={setTimeframe}/>
    <InsightsTabs market={market} activeTab={activeTab} onTabChange={setActiveTab}/>

// ---- components/module-2/2.2-market-radar/DrawerChartPanel.tsx (stub) ----
// ---- components/module-2/2.2-market-radar/InsightsTabs.tsx (stub) ----
each: typed against its Slot interface in radarTypes.ts; same placeholder style.
Ownership transfers whole to the sibling card named in radarTypes.ts's comment above it.
