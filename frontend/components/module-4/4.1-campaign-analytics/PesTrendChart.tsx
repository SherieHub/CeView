/**
 * CARD — Performance: Trend Charts
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-4)
 *
 * TODO:
 * - PES-over-time line chart with label-threshold dashed reference lines
 * - The shell owns slicing MOCK_HISTORY to the current `weeks` and the 4/8-week
 *   toggle control itself; this card only renders `window`
 *
 * PesTrendChart.test.tsx: cover rendering against a 4-week and an 8-week window.
 */
import type { TrendSlotProps } from './campaignTypes';

export default function PesTrendChart(_props: TrendSlotProps) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">PES Trend</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: Trend Charts in 05-module-4.md.
      </p>
    </div>
  );
}
