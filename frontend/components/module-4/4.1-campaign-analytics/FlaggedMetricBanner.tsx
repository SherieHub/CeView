/**
 * CARD — Performance: KPI Cards & Flagged Metrics
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-1)
 *
 * TODO:
 * - Zero-denominator warning banner, names exactly which metric(s) couldn't be computed
 *
 * FlaggedMetricBanner.test.tsx: cover the flagged-vs-empty banner branch.
 */
import type { KpiSlotProps } from './campaignTypes';

export default function FlaggedMetricBanner(_props: Pick<KpiSlotProps, 'flagged'>) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">Flagged Metrics</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: KPI Cards &amp; Flagged Metrics in
        05-module-4.md.
      </p>
    </div>
  );
}
