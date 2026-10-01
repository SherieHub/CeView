// ---- components/module-4/4.1-campaign-analytics/CustomerJourneyFunnel.tsx ----
import type { FunnelSlotProps } from './campaignTypes'
function CustomerJourneyFunnel({ input }: FunnelSlotProps):
  stages ← Impressions → Clicks → Conversions → Bookings
  for each stage after the first:
    dropOff ← prev.value > 0 ? (prev - curr) / prev * 100 : null   // render nothing if null
  render: 4 stages, each (after the first) showing its drop-off percentage
