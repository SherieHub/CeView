/**
 * CARD — Performance: Customer Journey Funnel
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-3)
 *
 * TODO:
 * - 4-stage funnel (Impressions -> Clicks -> Conversions -> Bookings) with per-stage drop-off %
 * - No drop-off shown when the previous stage is 0
 *
 * CustomerJourneyFunnel.test.tsx: cover the zero-previous-stage no-drop-off branch.
 */
import type { FunnelSlotProps } from './campaignTypes';

export default function CustomerJourneyFunnel(_props: FunnelSlotProps) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Customer Journey Funnel</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: Customer Journey Funnel in
        05-module-4.md.
      </p>
    </div>
  );
}
