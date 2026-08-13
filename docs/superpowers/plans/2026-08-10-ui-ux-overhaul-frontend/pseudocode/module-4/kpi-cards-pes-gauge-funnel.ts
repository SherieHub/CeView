// ---- components/module-4/4.1-campaign-analytics/computeMetrics.ts ----
interface Metrics { ctr, cpc, convRate, roas, cac }

function computeMetrics(input): { metrics, flagged }
  // each metric guards against a zero denominator by recording its name in `flagged` instead of dividing by zero
  ctr ← impressions===0 ? (flag 'CTR', 0) : clicks/impressions*100
  cpc ← clicks===0 ? (flag 'CPC', 0) : adSpend/clicks
  convRate ← clicks===0 ? (flag 'Conversion rate', 0) : bookings/clicks*100
  roas ← adSpend===0 ? (flag 'ROAS', 0) : revenue/adSpend
  cac ← newCustomers===0 ? (flag 'CAC', 0) : adSpend/newCustomers

function computePes(metrics): { score, label }
  // normalize ROAS/convRate/CAC/CTR/CPC against fixed Cebu-MSME bounds; CAC and CPC inverted
  // (lower raw value → higher normalized score); weights: ROAS 35%, convRate 30%, CAC 15%, CTR 15%, CPC 5%
  score ← weighted sum of normalized values, in [0,1]
  label ← score>=0.8 Excellent : score>=0.6 Good : score>=0.4 Fair : Poor

// ---- components/module-4/4.1-campaign-analytics/KpiCard.tsx ----
props: { label, value, inverseGood? }  // CPC/CAC: lower is better
render: label, formatted value, trend arrow (direction accounts for inverseGood)

// ---- components/module-4/4.1-campaign-analytics/FlaggedMetricBanner.tsx ----
props: { flagged }
if flagged.length===0 → render nothing
else → banner naming every flagged metric, noting weight was redistributed in PES

// ---- components/module-4/4.1-campaign-analytics/PesGauge.tsx ----
props: { score, label }
render: radial gauge (score+label) + contribution-breakdown bar per weighted metric +
        weighted-sum formula shown verbatim

// ---- components/module-4/4.1-campaign-analytics/CustomerJourneyFunnel.tsx ----
props: { input }
stages: Impressions → Clicks → Conversions → Bookings
for each stage after the first: dropOff ← prev.value>0 ? (prev-curr)/prev*100 : null (render nothing if null)
render: 4 stages, each (after the first) showing its drop-off percentage
