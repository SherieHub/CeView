/**
 * CARD — Performance: Ingestion Form Entry State
 *   + Performance: KPI Cards, PES Gauge & Funnel
 *   + Performance: Trend Charts & AI Action Plan
 *   + Performance: Previously Published & Post Analytics Modal
 * Depends on: Foundation — Shell & Routing (Cards 25–27 build on Card 24 in turn)
 * Screen doc: docs/module-4/screens/performance.md
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md
 *
 * Route: /performance — re-skin of the legacy CampaignAnalyticsView
 *
 * TODO (Ingestion Form Entry State):
 * - No-campaign state: 7-field ingestion form (impressions, clicks, adSpend, revenue,
 *   conversions, bookings, newCustomers), inline hint per field
 * - "New submission" ghost button clears `campaign` and returns to this state from the
 *   full view
 *
 * TODO (KPI Cards, PES Gauge & Funnel):
 * - 5 KPI cards (CTR, CPC inverse-good, ROAS, CR, CAC inverse-good) with trend arrows
 * - Flagged-metric banner — names any zero-denominator metric, states weight redistribution
 * - PES radial gauge, qualitative label, contribution-breakdown bars, formula footer
 *   (computePes, ui-ux-prototype.html:3772–3794)
 * - Customer journey funnel (Impressions->Clicks->Conversions->Bookings, drop-off %)
 *
 * TODO (Trend Charts & AI Action Plan):
 * - PES trend (4/8-week toggle) with label-threshold dashed reference lines
 * - Efficiency trend chart (ROAS/CTR/CR) and cost trend chart (CPC/CAC)
 * - AI action plan — executive summary card, 3 funnel diagnostics ranked by business
 *   impact (not raw drop-size), each paired with a recommendation card + urgency chip
 *
 * TODO (Previously Published & Post Analytics Modal):
 * - "Previously published" section — All/TikTok/Instagram/Facebook filter tabs over
 *   published posts (reads the shared post store Content Studio Card 19 writes to)
 * - Opens PostAnalyticsModal.tsx on click
 *
 * CampaignAnalyticsView.test.tsx: form validation + submit->full-view transition,
 * computePes/computeMetrics flagged-metric path, diagnostics ranked by impact not raw drop.
 */
export default function CampaignAnalyticsView() {
  return (
    <div className="empty flex h-full flex-col items-center justify-center gap-1 text-center">
      <h2 className="h-lg">Performance</h2>
      <p className="body-sm">
        Not implemented yet — see CARD — Performance: Ingestion Form Entry State in
        05-module-4.md.
      </p>
    </div>
  );
}
