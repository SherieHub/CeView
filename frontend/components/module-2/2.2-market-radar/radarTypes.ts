/**
 * CARD — Foundation: Dashboard & Radar Shell
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 *
 * Prop contracts for the two body slots inside MarketRadarDrawer, so each can
 * be built without editing the shell. The shell owns the timeframe and the
 * active tab; the slots receive them and report changes back.
 */
import type { Market } from '../../../services/fixtures/markets';

export type Timeframe = '4WK' | '12WK';
export type InsightsTab = 'economy' | 'season';

export interface DrawerChartSlotProps {
  market: Market;
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

export interface DrawerInsightsSlotProps {
  market: Market;
  activeTab: InsightsTab;
  onTabChange: (tab: InsightsTab) => void;
}
