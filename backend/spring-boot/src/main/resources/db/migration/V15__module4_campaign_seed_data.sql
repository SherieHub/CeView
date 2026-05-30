-- V15 — Module 4: Campaign Seed Data (10-week traction progression)
-- ─────────────────────────────────────────────────────────────────────────────
-- Simulates a Cebu MSME hospitality business whose Korean-market social media
-- post gains traction over 10 weeks (Mar – May 2026). Each row represents one
-- weekly operator input via the DataIngestionForm, as if the user submitted
-- their campaign numbers every Monday.
--
-- Traction narrative:
--   Weeks 1–3  : Fair  (0.42 → 0.57) — cold-start, broad audience, A/B testing
--   Week  4    : Good  (0.67)         — KOL collaboration boosts reach overnight
--   Weeks 5–8  : Good  (0.69 → 0.78) — retargeting + lookalike audiences scale up
--   Weeks 9–10 : Excellent (0.80–0.83)— peak Korean summer travel season
--
-- KPIs match MetricsCalculationService.compute() exactly:
--   CTR       = clicks / impressions × 100
--   CPC       = ad_spend / clicks
--   conv_rate = bookings / clicks × 100
--   roas      = revenue / ad_spend
--   cac       = ad_spend / new_customers
--
-- PES matches PESComputationService.compute() exactly:
--   roasN = clamp01(roas / 8.0)
--   crN   = clamp01(conv_rate / 15.0)
--   cacN  = 1 − clamp01((cac − 1) / 4999)
--   ctrN  = clamp01(ctr / 10.0)
--   cpcN  = 1 − clamp01((cpc − 0.01) / 499.99)
--   PES   = roasN×0.35 + crN×0.30 + cacN×0.15 + ctrN×0.15 + cpcN×0.05
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO tbl_campaign_records (
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) VALUES

-- ── Week 1 · 2026-03-09 ────────────────────────────────────────────────────
-- Post just launched — broad Korean tourist audience, low CTR, minimal bookings.
-- ROAS=3.20  CTR=2.00  CR=3.25  CAC=333.33  CPC=3.75  PES≈0.42
(
    40000, 800, 3000.00, 9600.00, 55, 26, 9,
    2.00, 3.75, 3.25, 3.20, 333.33,
    0.42, 'Fair Performance',
    4, '2026-03-09', '2026-03-15',
    '2026-03-09 09:00:00+08', '2026-03-09 09:45:00+08'
),

-- ── Week 2 · 2026-03-16 ────────────────────────────────────────────────────
-- First creative iteration — headline copy tweaked. Modest CTR and ROAS lift.
-- ROAS=4.38  CTR=2.12  CR=3.45  CAC=246.15  CPC=2.91  PES≈0.48
(
    52000, 1100, 3200.00, 14000.00, 75, 38, 13,
    2.12, 2.91, 3.45, 4.38, 246.15,
    0.48, 'Fair Performance',
    4, '2026-03-16', '2026-03-22',
    '2026-03-16 09:00:00+08', '2026-03-16 09:45:00+08'
),

-- ── Week 3 · 2026-03-23 ────────────────────────────────────────────────────
-- A/B test winner applied across all ad sets. CPC dropping, ROAS climbing.
-- ROAS=6.11  CTR=2.35  CR=3.75  CAC=180.00  CPC=2.25  PES≈0.57
(
    68000, 1600, 3600.00, 22000.00, 105, 60, 20,
    2.35, 2.25, 3.75, 6.11, 180.00,
    0.57, 'Fair Performance',
    4, '2026-03-23', '2026-03-29',
    '2026-03-23 09:00:00+08', '2026-03-23 09:45:00+08'
),

-- ── Week 4 · 2026-03-30 ────────────────────────────────────────────────────
-- KOL collaboration — Korean travel influencer features the resort. Reach spikes.
-- ROAS crosses 8× so roasN caps at 1.0. First week in Good Performance.
-- ROAS=8.75  CTR=2.95  CR=4.00  CAC=117.65  CPC=1.43  PES≈0.67
(
    95000, 2800, 4000.00, 35000.00, 185, 112, 34,
    2.95, 1.43, 4.00, 8.75, 117.65,
    0.67, 'Good Performance',
    4, '2026-03-30', '2026-04-05',
    '2026-03-30 09:00:00+08', '2026-03-30 09:45:00+08'
),

-- ── Week 5 · 2026-04-06 ────────────────────────────────────────────────────
-- Retargeting layer added — past website visitors and enquirers re-engaged.
-- ROAS=11.82  CTR=3.56  CR=4.50  CAC=84.62  CPC=1.05  PES≈0.69
(
    118000, 4200, 4400.00, 52000.00, 275, 189, 52,
    3.56, 1.05, 4.50, 11.82, 84.62,
    0.69, 'Good Performance',
    4, '2026-04-06', '2026-04-12',
    '2026-04-06 09:00:00+08', '2026-04-06 09:45:00+08'
),

-- ── Week 6 · 2026-04-13 ────────────────────────────────────────────────────
-- Resort reel goes viral on TikTok Korea — organic amplification drives costs down.
-- ROAS=16.00  CTR=4.52  CR=5.50  CAC=58.82  CPC=0.71  PES≈0.73
(
    155000, 7000, 5000.00, 80000.00, 455, 385, 85,
    4.52, 0.71, 5.50, 16.00, 58.82,
    0.73, 'Good Performance',
    4, '2026-04-13', '2026-04-19',
    '2026-04-13 09:00:00+08', '2026-04-13 09:45:00+08'
),

-- ── Week 7 · 2026-04-20 ────────────────────────────────────────────────────
-- Lookalike audiences built from confirmed bookers. Bid strategy: target ROAS.
-- ROAS=19.07  CTR=5.52  CR=6.00  CAC=45.76  CPC=0.57  PES≈0.75
(
    172000, 9500, 5400.00, 103000.00, 615, 570, 118,
    5.52, 0.57, 6.00, 19.07, 45.76,
    0.75, 'Good Performance',
    4, '2026-04-20', '2026-04-26',
    '2026-04-20 09:00:00+08', '2026-04-20 09:45:00+08'
),

-- ── Week 8 · 2026-04-27 ────────────────────────────────────────────────────
-- Korean Golden Week travel planning window. High-intent audiences converting fast.
-- ROAS=21.40  CTR=6.56  CR=6.50  CAC=38.51  CPC=0.48  PES≈0.78
(
    183000, 12000, 5700.00, 122000.00, 775, 780, 148,
    6.56, 0.48, 6.50, 21.40, 38.51,
    0.78, 'Good Performance',
    4, '2026-04-27', '2026-05-03',
    '2026-04-27 09:00:00+08', '2026-04-27 09:45:00+08'
),

-- ── Week 9 · 2026-05-04 ────────────────────────────────────────────────────
-- Peak Korean summer travel season. Viral content still compounding. Hits Excellent.
-- ROAS=23.33  CTR=7.63  CR=7.00  CAC=34.29  CPC=0.41  PES≈0.80
(
    190000, 14500, 6000.00, 140000.00, 940, 1015, 175,
    7.63, 0.41, 7.00, 23.33, 34.29,
    0.80, 'Excellent Performance',
    4, '2026-05-04', '2026-05-10',
    '2026-05-04 09:00:00+08', '2026-05-04 09:45:00+08'
),

-- ── Week 10 · 2026-05-11 ───────────────────────────────────────────────────
-- Campaign peak. All levers compounding: creative, audience, bidding. Best CAC ever.
-- ROAS=25.81  CTR=8.42  CR=7.60  CAC=31.31  CPC=0.38  PES≈0.83
(
    196000, 16500, 6200.00, 160000.00, 1075, 1254, 198,
    8.42, 0.38, 7.60, 25.81, 31.31,
    0.83, 'Excellent Performance',
    4, '2026-05-11', '2026-05-17',
    '2026-05-11 09:00:00+08', '2026-05-11 09:45:00+08'
);
