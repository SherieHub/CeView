// ---- components/module-4/4.1-campaign-analytics/PesGauge.tsx ----
import type { PesGaugeSlotProps } from './campaignTypes'
function PesGauge({ score, label, metrics }: PesGaugeSlotProps):
  render: radial gauge (score + label) + contribution-breakdown bar per weighted metric
          (ROAS 35%, convRate 30%, CAC 15%, CTR 15%, CPC 5%) + the weighted-sum formula
          shown verbatim
  // score/label already computed by computePes() in the shell (M4-F); this card only renders.
