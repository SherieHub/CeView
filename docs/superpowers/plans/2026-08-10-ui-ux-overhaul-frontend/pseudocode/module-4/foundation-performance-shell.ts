// ---- components/module-4/4.1-campaign-analytics/campaignTypes.ts ----
import type { CampaignInput, CampaignHistoryEntry, PrescriptiveReport } from '../../../services/fixtures/campaign'

export interface Metrics { ctr: number; cpc: number; convRate: number; roas: number; cac: number }
export type FlaggedMetric = 'CTR' | 'CPC' | 'Conversion rate' | 'ROAS' | 'CAC'

// M4-1
export interface KpiSlotProps { metrics: Metrics; flagged: FlaggedMetric[] }
// M4-2
export interface PesGaugeSlotProps { score: number; label: string; metrics: Metrics }
// M4-3
export interface FunnelSlotProps { input: CampaignInput }
// M4-4
export interface TrendSlotProps { window: CampaignHistoryEntry[]; weeks: 4 | 8; onWeeksChange(w: 4 | 8): void }
// M4-5
export interface ActionPlanSlotProps { report: PrescriptiveReport }

// ---- components/module-4/4.1-campaign-analytics/campaignMetrics.ts ----
function computeMetrics(input: CampaignInput): { metrics: Metrics; flagged: FlaggedMetric[] }
  // each metric guards against a zero denominator by recording its name in `flagged`
  // instead of dividing by zero
  ctr ← impressions===0 ? (flag 'CTR', 0) : clicks/impressions*100
  cpc ← clicks===0 ? (flag 'CPC', 0) : adSpend/clicks
  convRate ← clicks===0 ? (flag 'Conversion rate', 0) : bookings/clicks*100
  roas ← adSpend===0 ? (flag 'ROAS', 0) : revenue/adSpend
  cac ← newCustomers===0 ? (flag 'CAC', 0) : adSpend/newCustomers

function computePes(metrics: Metrics): { score: number; label: string }
  // normalize ROAS/convRate/CAC/CTR/CPC against fixed Cebu-MSME bounds; CAC and CPC inverted
  // (lower raw value → higher normalized score); weights: ROAS 35%, convRate 30%, CAC 15%,
  // CTR 15%, CPC 5%
  score ← weighted sum of normalized values, in [0,1]
  label ← score>=0.8 Excellent : score>=0.6 Good : score>=0.4 Fair : Poor

// ---- components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx ----
imports: useState, useEffect, apiClient, campaignTypes, campaignMetrics,
         IngestionForm, KpiCard, FlaggedMetricBanner, PesGauge, CustomerJourneyFunnel,
         PesTrendChart, EfficiencyTrendChart, CostTrendChart, AiActionPlan,
         PreviouslyPublished

function CampaignAnalyticsView():
  state: campaign ← null (local/session, not persisted), weeks ← 4
         history ← null, report ← null   // both fetched once campaign is set
  handleSubmit(input): campaign ← input
  handleNewSubmission(): campaign ← null   // "New submission" ghost button, rendered here
  on campaign becoming non-null → apiClient.campaign.history() → setHistory,
                                   apiClient.campaign.report() → setReport
  if !campaign → render <IngestionForm onSubmit={handleSubmit}/>

  { metrics, flagged } ← computeMetrics(campaign)
  { score, label } ← computePes(metrics)
  windowSlice ← (history ?? []).slice(-weeks)

  else → render full view:
    <FlaggedMetricBanner flagged={flagged}/>
    5× <KpiCard .../> from metrics, composed via <KpiCard metrics={metrics} flagged={flagged}/> slot
    <PesGauge score={score} label={label} metrics={metrics}/>
    <CustomerJourneyFunnel input={campaign}/>
    <PesTrendChart window={windowSlice} weeks={weeks} onWeeksChange={setWeeks}/>
    <EfficiencyTrendChart window={windowSlice}/>
    <CostTrendChart window={windowSlice}/>
    {report && <AiActionPlan report={report}/>}
    <PreviouslyPublished/>
    "New submission" ghost button → handleNewSubmission

// ---- components/module-4/4.1-campaign-analytics/IngestionForm.tsx ----
const FIELDS: 7 entries — impressions, clicks, adSpend, revenue, conversions, bookings,
                          newCustomers (each with a label + inline hint)

function IngestionForm({ onSubmit }: { onSubmit(input: CampaignInput): void }):
  state: values ← {}, error ← null, submitting ← false
  handleSubmit():
    parsed ← Number() each field
    if any field is not finite or < 0 → error ← "All fields must be non-negative numbers."; stop
    else:
      error ← null; submitting ← true   // "Computing analytics…" spinner label
      (short simulated delay)
      submitting ← false
      onSubmit(parsed)
  render: error banner if set + 7 numeric fields (label + hint) + Submit button

// ---- 4.1-campaign-analytics/KpiCard.tsx (stub) ----
// ---- 4.1-campaign-analytics/FlaggedMetricBanner.tsx (stub) ----
// ---- 4.1-campaign-analytics/PesGauge.tsx (stub) ----
// ---- 4.1-campaign-analytics/CustomerJourneyFunnel.tsx (stub) ----
// ---- 4.1-campaign-analytics/PesTrendChart.tsx (stub) ----
// ---- 4.1-campaign-analytics/EfficiencyTrendChart.tsx (stub) ----
// ---- 4.1-campaign-analytics/CostTrendChart.tsx (stub) ----
// ---- 4.1-campaign-analytics/AiActionPlan.tsx (stub) ----
// ---- 4.1-campaign-analytics/PreviouslyPublished.tsx (stub) ----
// ---- 4.1-campaign-analytics/PostAnalyticsModal.tsx (stub) ----
each: typed against its Slot interface in campaignTypes.ts (PreviouslyPublished/
PostAnalyticsModal take no shell props — they read usePosts() directly, see M4-6); same
"Not implemented yet — see CARD M4-<n>" placeholder style. Ownership transfers whole to the
named sibling card.
