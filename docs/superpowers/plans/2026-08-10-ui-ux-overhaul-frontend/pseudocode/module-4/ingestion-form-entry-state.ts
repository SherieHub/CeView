// ---- components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx ----
imports: useState, apiClient, CampaignInput type, IngestionForm

function CampaignAnalyticsView():
  state: campaign ← null (local/session, not persisted)
  handleNewSubmission(): campaign ← null  // "New submission" ghost button, rendered by Card 25
  if !campaign → render IngestionForm(onSubmit=setCampaign)
  else → render Card 25's full view (mounts once campaign is set)

// ---- components/module-4/4.1-campaign-analytics/IngestionForm.tsx ----
const FIELDS: 7 entries — impressions, clicks, adSpend, revenue, conversions, bookings,
                          newCustomers (each with a label + inline hint)

function IngestionForm({onSubmit}):
  state: values ← {}, error ← null, submitting ← false

  handleSubmit():
    parsed ← Number() each field
    if any field is not finite or < 0 → error ← "All fields must be non-negative numbers."; stop
    else:
      error ← null; submitting ← true  // "Computing analytics…" spinner label
      (short simulated delay)
      submitting ← false
      onSubmit(parsed)

  render: error banner if set + 7 numeric fields (label + hint) + Submit button
