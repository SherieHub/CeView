// ---- components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx (additions) ----
state: weeks ← 4|8 (shared toggle across all 3 trend charts)
history ← apiClient.campaign.history() result (MOCK_HISTORY)
report ← apiClient.campaign.report() result (MOCK_REPORT)
window ← history.slice(-weeks)

// ---- components/module-4/4.1-campaign-analytics/PesTrendChart.tsx ----
props: { window }
render: PES-over-time line + dashed horizontal reference lines at 0.40/0.60/0.80

// ---- components/module-4/4.1-campaign-analytics/EfficiencyTrendChart.tsx ----
props: { window }
render: ROAS, CTR, conversion rate plotted together over `window`

// ---- CostTrendChart.tsx ----
// identical shape to EfficiencyTrendChart, plots CPC and CAC together instead

// ---- components/module-4/4.1-campaign-analytics/AiActionPlan.tsx ----
props: { report }
render: executive summary text +
        report.funnelDiagnostics.map (rendered AS-GIVEN — already ranked Weakest→Moderate→Alright
        by business impact, NOT re-sorted by raw drop-off percentage) →
          diagnostic stage/rank/insight paired with report.recommendations[i]
          (title, action text, urgency chip: Most Urgent/Urgent/Not Very Urgent)
