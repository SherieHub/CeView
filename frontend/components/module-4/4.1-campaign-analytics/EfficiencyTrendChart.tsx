/**
 * CARD — Performance: Trend Charts
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-4)
 *
 * TODO:
 * - ROAS/CTR/CR over time, sharing the shell's `window` slice
 *
 * EfficiencyTrendChart.test.tsx: cover rendering against a 4-week and an 8-week window.
 */
import type { TrendSlotProps } from './campaignTypes';

export default function EfficiencyTrendChart(_props: TrendSlotProps) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Efficiency Trend</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: Trend Charts in 05-module-4.md.
      </p>
    </div>
  );
}
