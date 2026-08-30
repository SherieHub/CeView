/**
 * Module 4 campaign analytics fixtures — transcribed from
 * ui-ux-prototype.html:1431–1466 (ManualIngestResponse, PrescriptiveReport).
 */

import type {
  CampaignInput,
  CampaignHistoryEntry,
  FunnelDiagnostic,
  Recommendation,
  PrescriptiveReport,
} from '../../types';

export type { CampaignInput, CampaignHistoryEntry, FunnelDiagnostic, Recommendation, PrescriptiveReport };

export const DEFAULT_CAMPAIGN_INPUT: CampaignInput = {
  impressions: 95000, clicks: 2800, adSpend: 4000, revenue: 35000,
  conversions: 185, bookings: 112, newCustomers: 34,
};

export const MOCK_HISTORY: CampaignHistoryEntry[] = [
  { periodStart: '2026-06-08', periodEnd: '2026-06-14', pesScore: 0.42, pesLabel: 'Fair Performance', ctr: 2.00, cpc: 3.75, roas: 3.20, convRate: 3.25, cac: 333.33 },
  { periodStart: '2026-06-15', periodEnd: '2026-06-21', pesScore: 0.49, pesLabel: 'Fair Performance', ctr: 2.20, cpc: 3.10, roas: 4.10, convRate: 3.40, cac: 280.00 },
  { periodStart: '2026-06-22', periodEnd: '2026-06-28', pesScore: 0.57, pesLabel: 'Fair Performance', ctr: 2.45, cpc: 2.40, roas: 5.60, convRate: 3.60, cac: 210.00 },
  { periodStart: '2026-06-29', periodEnd: '2026-07-05', pesScore: 0.67, pesLabel: 'Good Performance', ctr: 2.95, cpc: 1.43, roas: 8.75, convRate: 4.00, cac: 117.65 },
  { periodStart: '2026-07-06', periodEnd: '2026-07-12', pesScore: 0.69, pesLabel: 'Good Performance', ctr: 3.10, cpc: 1.32, roas: 8.90, convRate: 4.30, cac: 104.00 },
  { periodStart: '2026-07-13', periodEnd: '2026-07-19', pesScore: 0.73, pesLabel: 'Good Performance', ctr: 3.40, cpc: 1.18, roas: 9.40, convRate: 4.90, cac: 92.00 },
  { periodStart: '2026-07-20', periodEnd: '2026-07-26', pesScore: 0.78, pesLabel: 'Good Performance', ctr: 3.90, cpc: 1.02, roas: 10.20, convRate: 5.60, cac: 78.00 },
  { periodStart: '2026-07-27', periodEnd: '2026-08-02', pesScore: 0.81, pesLabel: 'Excellent Performance', ctr: 4.30, cpc: 0.94, roas: 11.10, convRate: 6.20, cac: 66.00 },
];

export const MOCK_REPORT: PrescriptiveReport = {
  executiveSummary:
    'Your campaign scored 0.67 / 1.00 (Good Performance). ROAS is the standout at 8.75× — every ₱1 of ad spend returned ₱8.75, and it is capped in the PES calculation because it exceeds the 8× ceiling calibrated for Cebu tourism. The drag is mid-funnel: only 4.0% of clicks became confirmed bookings, so the traffic you are paying for arrives interested and leaves unconverted. Fix the Clicks → Conversions transition before increasing spend.',
  recommendedPlatform: 'Naver Blog',
  funnelDiagnostics: [
    { stage: 'Clicks → Conversions', rank: 'Weakest', dropRate: '93.4%', insight: 'Visitors who clicked showed real intent but the landing page did not sustain it — the ad promises the sardine run and unstructured rest, while the landing page opens with room rates. That mismatch between ad promise and destination experience is where the money leaks.' },
    { stage: 'Conversions → Bookings', rank: 'Moderate', dropRate: '39.5%', insight: 'High-intent leads reached the enquiry step and then abandoned. For Korean travellers this usually means payment-method friction and missing social proof — no visible review count, no live booking indicator, no instalment option.' },
    { stage: 'Impressions → Clicks', rank: 'Alright', dropRate: '97.1%', insight: 'A large absolute drop here is normal — 2.95% CTR sits comfortably within the healthy 2–8% band for awareness-stage social advertising in this market. This is the least urgent of the three despite having the biggest raw number.' },
  ],
  recommendations: [
    { stage: 'Clicks → Conversions', urgency: 'Most Urgent', title: 'Align Landing Page to Ad Promise', action: 'Rebuild the top of the landing page around the sardine run: lead with the underwater hero frame and the "30 metres from breakfast" line from your best-performing caption, and push the rate table below the fold. Mirror the ad headline word-for-word so arriving visitors recognise where they landed.' },
    { stage: 'Conversions → Bookings', urgency: 'Urgent', title: 'Remove Booking-Path Friction', action: 'Add trust signals directly above the booking CTA — verified guest review count, a live "N booked this week" counter, and the marine-biologist credential. Enable Korean payment methods (KakaoPay / Naver Pay) and add an instalment option; both are standard expectations for this market.' },
    { stage: 'Impressions → Clicks', urgency: 'Not Very Urgent', title: 'Sharpen Creative Targeting', action: 'Shift roughly 25% of spend from broad interest targeting to lookalikes built from your converters, and rotate in the underwater footage as the primary creative. Hold total spend flat until the mid-funnel fix lands — more traffic into a leaking funnel just costs more.' },
  ],
};
