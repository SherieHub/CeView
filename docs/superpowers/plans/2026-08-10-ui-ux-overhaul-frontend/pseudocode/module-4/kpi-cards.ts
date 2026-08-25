// ---- components/module-4/4.1-campaign-analytics/KpiCard.tsx ----
props: { label: string; value: number; inverseGood?: boolean }   // CPC/CAC: lower is better
render: label, formatted value, trend arrow (direction accounts for inverseGood)

// ---- components/module-4/4.1-campaign-analytics/FlaggedMetricBanner.tsx ----
import type { KpiSlotProps } from './campaignTypes'
function FlaggedMetricBanner({ flagged }: Pick<KpiSlotProps, 'flagged'>):
  if flagged.length === 0 → render nothing
  else → banner naming every flagged metric, noting weight was redistributed in PES

// Both mounted by the shell (M4-F) against the same KpiSlotProps { metrics, flagged } —
// five <KpiCard> instances (one per metric) plus one <FlaggedMetricBanner>.
