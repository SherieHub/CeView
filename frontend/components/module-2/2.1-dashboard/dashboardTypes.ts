/**
 * CARD — Foundation: Dashboard & Radar Shell
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/03-module-2.md
 *
 * The prop contracts DashboardView composes its slot components against, so
 * each sibling card can be built without editing the shell.
 *
 * SCOPE NOTE: 03-module-2.md lists four contracts. There are five here —
 * SignalSummarySlotProps is the added Signal Summary strip, which is not in the
 * prototype. See the plan's IA section for why it earns its place.
 */
import type { DashMode, FeedFilter } from './useDashboardState';
import type { Market } from '@/types';
import type { DemandAlert } from '@/types';

export interface AlertFeedSlotProps {
  mode: DashMode;
  /** Post-filter — what to render. */
  alerts: DemandAlert[];
  /** Pre-filter — distinguishes "no alerts for your categories" from "the
   *  filter hid them all", which are different empty states. */
  totalForProfile: number;
  categories: string[];
  selectedAlertId: string | null;
  isRead: (id: string) => boolean;
  onSelect: (id: string) => void;
  filter: FeedFilter;
  onFilterChange: (filter: FeedFilter) => void;
  unreadCount: number;
  surgeCount: number;
}

export interface MarketsRevealSlotProps {
  /** Null in the resting state, where the panel explains the interaction. */
  selectedAlert: DemandAlert | null;
  markets: Market[];
  onOpenMarket: (marketId: string) => void;
}

export interface AiStatusBannerSlotProps {
  visible: boolean;
}

export interface RefreshForecastSlotProps {
  isRefreshing: boolean;
  /** Switches the completion toast between refreshed and still-cached copy. */
  degraded: boolean;
  onRefresh: () => Promise<void>;
}

export interface SignalSummarySlotProps {
  loading: boolean;
  /** Renders the "cached" qualifier when the forecast service is unreachable. */
  degraded: boolean;
  unreadCount: number;
  surgeCount: number;
  /** Markets named by the confirmed-surge alerts, for the sub-line. */
  surgeMarkets: string[];
  topMarket: { id: string; name: string; matchScore: number; category: string } | null;
  onOpenMarket: (marketId: string) => void;
}
