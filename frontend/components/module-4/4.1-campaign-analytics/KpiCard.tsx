/**
 * CARD — Performance: KPI Cards & Flagged Metrics
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-1)
 *
 * TODO:
 * - One KPI card per metric (CTR, CPC inverse-good, ROAS, Conversion rate, CAC inverse-good)
 *   with a trend arrow against a fixed benchmark
 * - Still renders a value (0) rather than NaN/Infinity for a flagged metric
 *
 * KpiCard.test.tsx: cover the inverse-good trend-arrow branch.
 */
import type { KpiSlotProps } from './campaignTypes';

export default function KpiCard(_props: KpiSlotProps) {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="heading-lg">KPI Cards</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: KPI Cards &amp; Flagged Metrics in
        05-module-4.md.
      </p>
    </div>
  );
}
