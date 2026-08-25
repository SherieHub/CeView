// ---- components/module-4/4.1-campaign-analytics/PesTrendChart.tsx ----
import type { TrendSlotProps } from './campaignTypes'
function PesTrendChart({ window, weeks, onWeeksChange }: TrendSlotProps):
  render: PES-over-time line for `window` + dashed horizontal reference lines at
          0.40/0.60/0.80 + a 4WK/8WK toggle calling onWeeksChange
  // window is already sliced to `weeks` by the shell; this card owns the toggle control but
  // the shell (M4-F) owns the actual slicing.

// ---- components/module-4/4.1-campaign-analytics/EfficiencyTrendChart.tsx ----
function EfficiencyTrendChart({ window }: Pick<TrendSlotProps, 'window'>):
  render: ROAS, CTR, conversion rate plotted together over `window`

// ---- components/module-4/4.1-campaign-analytics/CostTrendChart.tsx ----
// identical shape to EfficiencyTrendChart, plots CPC and CAC together instead
function CostTrendChart({ window }: Pick<TrendSlotProps, 'window'>): ...
