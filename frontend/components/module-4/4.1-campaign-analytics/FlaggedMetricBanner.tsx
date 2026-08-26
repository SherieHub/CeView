/**
 * CARD — Performance: KPI Cards & Flagged Metrics
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-1)
 *
 * The zero-denominator warning banner. `flagged` arrives already computed by
 * campaignMetrics.ts — this card only renders it: nothing when empty,
 * otherwise a banner naming every flagged metric by name. Styled to match
 * IngestionForm's existing validation banner (role="alert",
 * border-critical/bg-critical-bg/text-critical) for visual consistency
 * within this same module.
 */
import { AlertTriangle } from 'lucide-react';
import type { KpiSlotProps } from './campaignTypes';

export default function FlaggedMetricBanner({ flagged }: Pick<KpiSlotProps, 'flagged'>) {
  if (flagged.length === 0) return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md border border-critical bg-critical-bg px-4 py-3 text-sm text-critical"
    >
      <AlertTriangle size={18} className="shrink-0" />
      <p>
        {flagged.length} metric(s) could not be computed: {flagged.join(', ')}.
      </p>
    </div>
  );
}
