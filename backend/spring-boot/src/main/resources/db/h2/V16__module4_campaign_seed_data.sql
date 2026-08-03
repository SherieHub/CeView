-- V16 (H2) — mirror of db/migration/V15__module4_campaign_seed_data.sql.
-- ─────────────────────────────────────────────────────────────────────────────
-- Replaces the original single 10-week global campaign-traction narrative (for one
-- anonymous business) with 9 distinct per-operator campaign histories, one per Cebu
-- MSME seeded in V2/h2-V2 (business_profile_id 20000000-...-0000000000N, N=1..9).
-- Every row is now linked via tbl_campaign_records.business_profile_id (added in
-- V17/h2-V14) — no row here has a NULL business_profile_id.
--
-- Mixed performance distribution (so Module 4 dashboards/alerts/prescriptive
-- reports differ meaningfully per operator, not all success stories):
--   UP   (trending better week over week) : Op1 Moalboal FreeDive Cebu,
--                                            Op2 Oslob Whale Shark Adventures,
--                                            Op3 Bantayan Blue Waters Island Hopping
--   FLAT (bouncing in a narrow band, no trend): Op4 Sugbo Heritage Walks,
--                                            Op5 Sinulog Fiesta Dance & Cultural Show,
--                                            Op6 Nena's Talisay Lechon House
--   DOWN (worsening week over week — ad fatigue / rising CAC / competition):
--                                            Op7 Mactan Sunset Beachfront Resort,
--                                            Op8 IT Park Nightlife & City Tour Co.,
--                                            Op9 Carbon Market Street Food Crawl
--
-- 68 weekly rows total (6-10 weeks per operator), dates staggered across
-- Mar-Jun 2026, each row modeling one Monday-morning operator submission via the
-- DataIngestionForm.
--
-- KPIs match MetricsCalculationService.compute() exactly:
--   CTR       = clicks / impressions × 100
--   CPC       = ad_spend / clicks
--   conv_rate = bookings / clicks × 100
--   roas      = revenue / ad_spend
--   cac       = ad_spend / new_customers
--
-- PES matches PESComputationService.compute() exactly (labels/thresholds too):
--   roasN = clamp01(roas / 8.0)
--   crN   = clamp01(conv_rate / 15.0)
--   cacN  = 1 − clamp01((cac − 1) / 4999)
--   ctrN  = clamp01(ctr / 10.0)
--   cpcN  = 1 − clamp01((cpc − 0.01) / 499.99)
--   PES   = roasN×0.35 + crN×0.30 + cacN×0.15 + ctrN×0.15 + cpcN×0.05
--   label: >=0.80 Excellent | >=0.60 Good | >=0.40 Fair | else Poor Performance
--
-- H2 differences vs Postgres:
--   INSERT .. (implicit)              -> MERGE INTO .. KEY(campaign_id) VALUES (..)
--   TIMESTAMPTZ 'yyyy-MM-dd HH:mm:ss+08' -> TIMESTAMP 'yyyy-MM-dd HH:mm:ss'
--   campaign_id has no seed value in Postgres (DEFAULT gen_random_uuid()); H2 also
--   defaults via RANDOM_UUID(), so we generate fixed UUIDs here
--   (90000000-...-NNNNNNNNNNNN, sequential per row) purely so MERGE has a KEY to
--   dedupe on if this migration is ever re-run against an existing H2 instance.
-- ─────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════
-- Moalboal FreeDive Cebu  (UP trend, 8 weeks, business_profile_id ...0001)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-03-02 — Post launches — broad snorkel/freedive-curious audience, cold-start CTR.
--   ROAS=2.67  CTR=1.78  CR=3.12  CAC=300.0  CPC=3.75  PES≈0.4 (Fair Performance)
    ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
     18000, 320, 1200.00, 3200.00, 22, 10, 4,
     1.78, 3.75, 3.12, 2.67, 300.0,
     0.4, 'Fair Performance',
     4, '2026-03-02', '2026-03-08',
     TIMESTAMP '2026-03-02 09:00:00', TIMESTAMP '2026-03-02 09:45:00'),

-- Week 2 · 2026-03-09 — Creative iterated — underwater photos of the sardine run added.
--   ROAS=3.71  CTR=2.0  CR=3.48  CAC=233.33  CPC=3.04  PES≈0.45 (Fair Performance)
    ('90000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001',
     23000, 460, 1400.00, 5200.00, 33, 16, 6,
     2.0, 3.04, 3.48, 3.71, 233.33,
     0.45, 'Fair Performance',
     4, '2026-03-09', '2026-03-15',
     TIMESTAMP '2026-03-09 09:00:00', TIMESTAMP '2026-03-09 09:45:00'),

-- Week 3 · 2026-03-16 — A/B test winner rolled out across ad sets; CPC easing.
--   ROAS=5.12  CTR=2.24  CR=4.0  CAC=177.78  CPC=2.46  PES≈0.53 (Fair Performance)
    ('90000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001',
     29000, 650, 1600.00, 8200.00, 48, 26, 9,
     2.24, 2.46, 4.0, 5.12, 177.78,
     0.53, 'Fair Performance',
     4, '2026-03-16', '2026-03-22',
     TIMESTAMP '2026-03-16 09:00:00', TIMESTAMP '2026-03-16 09:45:00'),

-- Week 4 · 2026-03-23 — Backpacker travel-forum shares start driving referral clicks.
--   ROAS=7.3  CTR=2.64  CR=4.74  CAC=123.33  CPC=1.95  PES≈0.65 (Good Performance)
    ('90000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001',
     36000, 950, 1850.00, 13500.00, 72, 45, 15,
     2.64, 1.95, 4.74, 7.3, 123.33,
     0.65, 'Good Performance',
     4, '2026-03-23', '2026-03-29',
     TIMESTAMP '2026-03-23 09:00:00', TIMESTAMP '2026-03-23 09:45:00'),

-- Week 5 · 2026-03-30 — Retargeting layer added for site visitors who viewed course pricing.
--   ROAS=9.76  CTR=3.18  CR=5.29  CAC=91.3  CPC=1.5  PES≈0.7 (Good Performance)
    ('90000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001',
     44000, 1400, 2100.00, 20500.00, 105, 74, 23,
     3.18, 1.5, 5.29, 9.76, 91.3,
     0.7, 'Good Performance',
     4, '2026-03-30', '2026-04-05',
     TIMESTAMP '2026-03-30 09:00:00', TIMESTAMP '2026-03-30 09:45:00'),

-- Week 6 · 2026-04-06 — Peak sardine-run season buzz; reviews compounding organic reach.
--   ROAS=12.29  CTR=3.85  CR=5.9  CAC=72.73  CPC=1.2  PES≈0.72 (Good Performance)
    ('90000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001',
     52000, 2000, 2400.00, 29500.00, 150, 118, 33,
     3.85, 1.2, 5.9, 12.29, 72.73,
     0.72, 'Good Performance',
     4, '2026-04-06', '2026-04-12',
     TIMESTAMP '2026-04-06 09:00:00', TIMESTAMP '2026-04-06 09:45:00'),

-- Week 7 · 2026-04-13 — Lookalike audiences from certified divers scale spend efficiently.
--   ROAS=16.3  CTR=5.0  CR=6.61  CAC=54.0  CPC=0.87  PES≈0.76 (Good Performance)
    ('90000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001',
     62000, 3100, 2700.00, 44000.00, 230, 205, 50,
     5.0, 0.87, 6.61, 16.3, 54.0,
     0.76, 'Good Performance',
     4, '2026-04-13', '2026-04-19',
     TIMESTAMP '2026-04-13 09:00:00', TIMESTAMP '2026-04-13 09:45:00'),

-- Week 8 · 2026-04-20 — Dive-shop partner cross-promotion drives best week of the run.
--   ROAS=20.0  CTR=6.0  CR=7.14  CAC=44.12  CPC=0.71  PES≈0.78 (Good Performance)
    ('90000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001',
     70000, 4200, 3000.00, 60000.00, 300, 300, 68,
     6.0, 0.71, 7.14, 20.0, 44.12,
     0.78, 'Good Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- Oslob Whale Shark Adventures  (UP trend, 10 weeks, business_profile_id ...0002)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-03-09 — Post just launched — broad international audience, low CTR, minimal bookings.
--   ROAS=3.2  CTR=2.0  CR=3.25  CAC=333.33  CPC=3.75  PES≈0.42 (Fair Performance)
    ('90000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002',
     40000, 800, 3000.00, 9600.00, 55, 26, 9,
     2.0, 3.75, 3.25, 3.2, 333.33,
     0.42, 'Fair Performance',
     4, '2026-03-09', '2026-03-15',
     TIMESTAMP '2026-03-09 09:00:00', TIMESTAMP '2026-03-09 09:45:00'),

-- Week 2 · 2026-03-16 — First creative iteration — headline copy tweaked. Modest CTR and ROAS lift.
--   ROAS=4.38  CTR=2.12  CR=3.45  CAC=246.15  CPC=2.91  PES≈0.48 (Fair Performance)
    ('90000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000002',
     52000, 1100, 3200.00, 14000.00, 75, 38, 13,
     2.12, 2.91, 3.45, 4.38, 246.15,
     0.48, 'Fair Performance',
     4, '2026-03-16', '2026-03-22',
     TIMESTAMP '2026-03-16 09:00:00', TIMESTAMP '2026-03-16 09:45:00'),

-- Week 3 · 2026-03-23 — A/B test winner applied across all ad sets. CPC dropping, ROAS climbing.
--   ROAS=6.11  CTR=2.35  CR=3.75  CAC=180.0  CPC=2.25  PES≈0.57 (Fair Performance)
    ('90000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000002',
     68000, 1600, 3600.00, 22000.00, 105, 60, 20,
     2.35, 2.25, 3.75, 6.11, 180.0,
     0.57, 'Fair Performance',
     4, '2026-03-23', '2026-03-29',
     TIMESTAMP '2026-03-23 09:00:00', TIMESTAMP '2026-03-23 09:45:00'),

-- Week 4 · 2026-03-30 — Dive-travel KOL features the whale shark encounter. Reach spikes.
--   ROAS=8.75  CTR=2.95  CR=4.0  CAC=117.65  CPC=1.43  PES≈0.67 (Good Performance)
    ('90000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000002',
     95000, 2800, 4000.00, 35000.00, 185, 112, 34,
     2.95, 1.43, 4.0, 8.75, 117.65,
     0.67, 'Good Performance',
     4, '2026-03-30', '2026-04-05',
     TIMESTAMP '2026-03-30 09:00:00', TIMESTAMP '2026-03-30 09:45:00'),

-- Week 5 · 2026-04-06 — Retargeting layer added — past website visitors and enquirers re-engaged.
--   ROAS=11.82  CTR=3.56  CR=4.5  CAC=84.62  CPC=1.05  PES≈0.69 (Good Performance)
    ('90000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000002',
     118000, 4200, 4400.00, 52000.00, 275, 189, 52,
     3.56, 1.05, 4.5, 11.82, 84.62,
     0.69, 'Good Performance',
     4, '2026-04-06', '2026-04-12',
     TIMESTAMP '2026-04-06 09:00:00', TIMESTAMP '2026-04-06 09:45:00'),

-- Week 6 · 2026-04-13 — Encounter reel goes viral internationally — organic amplification drives costs down.
--   ROAS=16.0  CTR=4.52  CR=5.5  CAC=58.82  CPC=0.71  PES≈0.73 (Good Performance)
    ('90000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000002',
     155000, 7000, 5000.00, 80000.00, 455, 385, 85,
     4.52, 0.71, 5.5, 16.0, 58.82,
     0.73, 'Good Performance',
     4, '2026-04-13', '2026-04-19',
     TIMESTAMP '2026-04-13 09:00:00', TIMESTAMP '2026-04-13 09:45:00'),

-- Week 7 · 2026-04-20 — Lookalike audiences built from confirmed bookers. Bid strategy: target ROAS.
--   ROAS=19.07  CTR=5.52  CR=6.0  CAC=45.76  CPC=0.57  PES≈0.75 (Good Performance)
    ('90000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000002',
     172000, 9500, 5400.00, 103000.00, 615, 570, 118,
     5.52, 0.57, 6.0, 19.07, 45.76,
     0.75, 'Good Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00'),

-- Week 8 · 2026-04-27 — Northern-hemisphere summer travel-planning window. High-intent audiences converting fast.
--   ROAS=21.4  CTR=6.56  CR=6.5  CAC=38.51  CPC=0.47  PES≈0.78 (Good Performance)
    ('90000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000002',
     183000, 12000, 5700.00, 122000.00, 775, 780, 148,
     6.56, 0.47, 6.5, 21.4, 38.51,
     0.78, 'Good Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00'),

-- Week 9 · 2026-05-04 — Peak summer travel season. Viral content still compounding. Hits Excellent.
--   ROAS=23.33  CTR=7.63  CR=7.0  CAC=34.29  CPC=0.41  PES≈0.8 (Excellent Performance)
    ('90000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000002',
     190000, 14500, 6000.00, 140000.00, 940, 1015, 175,
     7.63, 0.41, 7.0, 23.33, 34.29,
     0.8, 'Excellent Performance',
     4, '2026-05-04', '2026-05-10',
     TIMESTAMP '2026-05-04 09:00:00', TIMESTAMP '2026-05-04 09:45:00'),

-- Week 10 · 2026-05-11 — Campaign peak. All levers compounding: creative, audience, bidding. Best CAC ever.
--   ROAS=25.81  CTR=8.42  CR=7.6  CAC=31.31  CPC=0.38  PES≈0.83 (Excellent Performance)
    ('90000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000002',
     196000, 16500, 6200.00, 160000.00, 1075, 1254, 198,
     8.42, 0.38, 7.6, 25.81, 31.31,
     0.83, 'Excellent Performance',
     4, '2026-05-11', '2026-05-17',
     TIMESTAMP '2026-05-11 09:00:00', TIMESTAMP '2026-05-11 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- Bantayan Blue Waters Island Hopping  (UP trend, 7 weeks, business_profile_id ...0003)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-03-16 — First sandbar-tour post — small local audience, cold-start CTR.
--   ROAS=2.67  CTR=1.83  CR=3.18  CAC=300.0  CPC=4.09  PES≈0.4 (Fair Performance)
    ('90000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000003',
     12000, 220, 900.00, 2400.00, 15, 7, 3,
     1.83, 4.09, 3.18, 2.67, 300.0,
     0.4, 'Fair Performance',
     4, '2026-03-16', '2026-03-22',
     TIMESTAMP '2026-03-16 09:00:00', TIMESTAMP '2026-03-16 09:45:00'),

-- Week 2 · 2026-03-23 — Sunset-sail add-on promoted alongside sandbar photos.
--   ROAS=3.4  CTR=1.94  CR=3.67  CAC=250.0  CPC=3.33  PES≈0.44 (Fair Performance)
    ('90000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000003',
     15500, 300, 1000.00, 3400.00, 21, 11, 4,
     1.94, 3.33, 3.67, 3.4, 250.0,
     0.44, 'Fair Performance',
     4, '2026-03-23', '2026-03-29',
     TIMESTAMP '2026-03-23 09:00:00', TIMESTAMP '2026-03-23 09:45:00'),

-- Week 3 · 2026-03-30 — Ferry-terminal commuter targeting swapped for interest-based targeting.
--   ROAS=4.7  CTR=2.21  CR=4.19  CAC=191.67  CPC=2.67  PES≈0.52 (Fair Performance)
    ('90000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000003',
     19500, 430, 1150.00, 5400.00, 31, 18, 6,
     2.21, 2.67, 4.19, 4.7, 191.67,
     0.52, 'Fair Performance',
     4, '2026-03-30', '2026-04-05',
     TIMESTAMP '2026-03-30 09:00:00', TIMESTAMP '2026-03-30 09:45:00'),

-- Week 4 · 2026-04-06 — Guest photos from Virgin Island shared as social proof.
--   ROAS=6.62  CTR=2.53  CR=4.84  CAC=144.44  CPC=2.1  PES≈0.62 (Good Performance)
    ('90000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000003',
     24500, 620, 1300.00, 8600.00, 46, 30, 9,
     2.53, 2.1, 4.84, 6.62, 144.44,
     0.62, 'Good Performance',
     4, '2026-04-06', '2026-04-12',
     TIMESTAMP '2026-04-06 09:00:00', TIMESTAMP '2026-04-06 09:45:00'),

-- Week 5 · 2026-04-13 — Retargeting past inquirers who asked about group rates.
--   ROAS=8.8  CTR=3.0  CR=5.56  CAC=115.38  CPC=1.67  PES≈0.7 (Good Performance)
    ('90000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000003',
     30000, 900, 1500.00, 13200.00, 66, 50, 13,
     3.0, 1.67, 5.56, 8.8, 115.38,
     0.7, 'Good Performance',
     4, '2026-04-13', '2026-04-19',
     TIMESTAMP '2026-04-13 09:00:00', TIMESTAMP '2026-04-13 09:45:00'),

-- Week 6 · 2026-04-20 — Small-boat, private-sandbar angle differentiates from big tour buses.
--   ROAS=11.47  CTR=3.61  CR=6.15  CAC=89.47  CPC=1.31  PES≈0.72 (Good Performance)
    ('90000000-0000-0000-0000-000000000024', '20000000-0000-0000-0000-000000000003',
     36000, 1300, 1700.00, 19500.00, 92, 80, 19,
     3.61, 1.31, 6.15, 11.47, 89.47,
     0.72, 'Good Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00'),

-- Week 7 · 2026-04-27 — Peak Bantayan season — lechon-lunch bundle drives higher-value bookings.
--   ROAS=14.1  CTR=4.4  CR=6.59  CAC=75.0  CPC=1.05  PES≈0.75 (Good Performance)
    ('90000000-0000-0000-0000-000000000025', '20000000-0000-0000-0000-000000000003',
     42000, 1850, 1950.00, 27500.00, 130, 122, 26,
     4.4, 1.05, 6.59, 14.1, 75.0,
     0.75, 'Good Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- Sugbo Heritage Walks  (FLAT trend, 6 weeks, business_profile_id ...0004)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-03-23 — Fort San Pedro heritage-walk post promoted to history-interest audience.
--   ROAS=5.17  CTR=3.1  CR=5.48  CAC=100.0  CPC=1.94  PES≈0.58 (Fair Performance)
    ('90000000-0000-0000-0000-000000000026', '20000000-0000-0000-0000-000000000004',
     20000, 620, 1200.00, 6200.00, 40, 34, 12,
     3.1, 1.94, 5.48, 5.17, 100.0,
     0.58, 'Fair Performance',
     4, '2026-03-23', '2026-03-29',
     TIMESTAMP '2026-03-23 09:00:00', TIMESTAMP '2026-03-23 09:45:00'),

-- Week 2 · 2026-03-30 — Slight dip — competing school-trip season narrows discretionary bookings.
--   ROAS=4.87  CTR=2.87  CR=5.18  CAC=115.0  CPC=2.05  PES≈0.56 (Fair Performance)
    ('90000000-0000-0000-0000-000000000027', '20000000-0000-0000-0000-000000000004',
     19500, 560, 1150.00, 5600.00, 36, 29, 10,
     2.87, 2.05, 5.18, 4.87, 115.0,
     0.56, 'Fair Performance',
     4, '2026-03-30', '2026-04-05',
     TIMESTAMP '2026-03-30 09:00:00', TIMESTAMP '2026-03-30 09:45:00'),

-- Week 3 · 2026-04-06 — Casa Gorordo cross-promotion recovers reach slightly.
--   ROAS=5.28  CTR=3.05  CR=5.47  CAC=96.15  CPC=1.95  PES≈0.58 (Fair Performance)
    ('90000000-0000-0000-0000-000000000028', '20000000-0000-0000-0000-000000000004',
     21000, 640, 1250.00, 6600.00, 42, 35, 13,
     3.05, 1.95, 5.47, 5.28, 96.15,
     0.58, 'Fair Performance',
     4, '2026-04-06', '2026-04-12',
     TIMESTAMP '2026-04-06 09:00:00', TIMESTAMP '2026-04-06 09:45:00'),

-- Week 4 · 2026-04-13 — Budget trimmed for a week; performance holds steady, not improving.
--   ROAS=4.82  CTR=2.87  CR=5.0  CAC=122.22  CPC=2.04  PES≈0.55 (Fair Performance)
    ('90000000-0000-0000-0000-000000000029', '20000000-0000-0000-0000-000000000004',
     18800, 540, 1100.00, 5300.00, 34, 27, 9,
     2.87, 2.04, 5.0, 4.82, 122.22,
     0.55, 'Fair Performance',
     4, '2026-04-13', '2026-04-19',
     TIMESTAMP '2026-04-13 09:00:00', TIMESTAMP '2026-04-13 09:45:00'),

-- Week 5 · 2026-04-20 — Custom Sinulog-history tour ad tested; results land in the same band.
--   ROAS=5.0  CTR=2.93  CR=5.33  CAC=110.91  CPC=2.03  PES≈0.57 (Fair Performance)
    ('90000000-0000-0000-0000-000000000030', '20000000-0000-0000-0000-000000000004',
     20500, 600, 1220.00, 6100.00, 39, 32, 11,
     2.93, 2.03, 5.33, 5.0, 110.91,
     0.57, 'Fair Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00'),

-- Week 6 · 2026-04-27 — Steady-state week — heritage-tour demand plateaus at a modest baseline.
--   ROAS=4.96  CTR=2.93  CR=5.17  CAC=118.0  CPC=2.03  PES≈0.56 (Fair Performance)
    ('90000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000004',
     19800, 580, 1180.00, 5850.00, 37, 30, 10,
     2.93, 2.03, 5.17, 4.96, 118.0,
     0.56, 'Fair Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- Sinulog Fiesta Dance & Cultural Show  (FLAT trend, 8 weeks, business_profile_id ...0005)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-03-30 — Nightly Sinulog show promoted to Fuente Osmeña foot traffic + social.
--   ROAS=5.68  CTR=3.0  CR=6.15  CAC=137.5  CPC=2.82  PES≈0.61 (Good Performance)
    ('90000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000005',
     26000, 780, 2200.00, 12500.00, 58, 48, 16,
     3.0, 2.82, 6.15, 5.68, 137.5,
     0.61, 'Good Performance',
     4, '2026-03-30', '2026-04-05',
     TIMESTAMP '2026-03-30 09:00:00', TIMESTAMP '2026-03-30 09:45:00'),

-- Week 2 · 2026-04-06 — Corporate-booking push underperforms slightly vs. tourist segment.
--   ROAS=5.33  CTR=2.94  CR=5.83  CAC=150.0  CPC=2.92  PES≈0.59 (Fair Performance)
    ('90000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000005',
     24500, 720, 2100.00, 11200.00, 52, 42, 14,
     2.94, 2.92, 5.83, 5.33, 150.0,
     0.59, 'Fair Performance',
     4, '2026-04-06', '2026-04-12',
     TIMESTAMP '2026-04-06 09:00:00', TIMESTAMP '2026-04-06 09:45:00'),

-- Week 3 · 2026-04-13 — Group dinner-and-show bundle nudges results back up.
--   ROAS=5.83  CTR=3.02  CR=6.27  CAC=127.78  CPC=2.77  PES≈0.62 (Good Performance)
    ('90000000-0000-0000-0000-000000000034', '20000000-0000-0000-0000-000000000005',
     27500, 830, 2300.00, 13400.00, 62, 52, 18,
     3.02, 2.77, 6.27, 5.83, 127.78,
     0.62, 'Good Performance',
     4, '2026-04-13', '2026-04-19',
     TIMESTAMP '2026-04-13 09:00:00', TIMESTAMP '2026-04-13 09:45:00'),

-- Week 4 · 2026-04-20 — Costume photo add-on tested; net effect roughly flat.
--   ROAS=5.53  CTR=3.0  CR=6.0  CAC=143.33  CPC=2.87  PES≈0.6 (Good Performance)
    ('90000000-0000-0000-0000-000000000035', '20000000-0000-0000-0000-000000000005',
     25000, 750, 2150.00, 11900.00, 55, 45, 15,
     3.0, 2.87, 6.0, 5.53, 143.33,
     0.6, 'Good Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00'),

-- Week 5 · 2026-04-27 — Weekday show attendance recovers to the established band.
--   ROAS=5.69  CTR=2.99  CR=6.25  CAC=132.35  CPC=2.81  PES≈0.61 (Good Performance)
    ('90000000-0000-0000-0000-000000000036', '20000000-0000-0000-0000-000000000005',
     26800, 800, 2250.00, 12800.00, 60, 50, 17,
     2.99, 2.81, 6.25, 5.69, 132.35,
     0.61, 'Good Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00'),

-- Week 6 · 2026-05-04 — Competing festival elsewhere in the city softens the week.
--   ROAS=5.27  CTR=2.92  CR=5.71  CAC=157.69  CPC=2.93  PES≈0.58 (Fair Performance)
    ('90000000-0000-0000-0000-000000000037', '20000000-0000-0000-0000-000000000005',
     24000, 700, 2050.00, 10800.00, 50, 40, 13,
     2.92, 2.93, 5.71, 5.27, 157.69,
     0.58, 'Fair Performance',
     4, '2026-05-04', '2026-05-10',
     TIMESTAMP '2026-05-04 09:00:00', TIMESTAMP '2026-05-04 09:45:00'),

-- Week 7 · 2026-05-11 — Live-band lineup refresh brings numbers back to baseline.
--   ROAS=5.75  CTR=3.0  CR=6.3  CAC=134.12  CPC=2.81  PES≈0.62 (Good Performance)
    ('90000000-0000-0000-0000-000000000038', '20000000-0000-0000-0000-000000000005',
     27000, 810, 2280.00, 13100.00, 61, 51, 17,
     3.0, 2.81, 6.3, 5.75, 134.12,
     0.62, 'Good Performance',
     4, '2026-05-11', '2026-05-17',
     TIMESTAMP '2026-05-11 09:00:00', TIMESTAMP '2026-05-11 09:45:00'),

-- Week 8 · 2026-05-18 — Show settles into a stable, unremarkable demand plateau.
--   ROAS=5.55  CTR=2.98  CR=6.05  CAC=145.33  CPC=2.87  PES≈0.6 (Good Performance)
    ('90000000-0000-0000-0000-000000000039', '20000000-0000-0000-0000-000000000005',
     25500, 760, 2180.00, 12100.00, 56, 46, 15,
     2.98, 2.87, 6.05, 5.55, 145.33,
     0.6, 'Good Performance',
     4, '2026-05-18', '2026-05-24',
     TIMESTAMP '2026-05-18 09:00:00', TIMESTAMP '2026-05-18 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- Nena's Talisay Lechon House  (FLAT trend, 7 weeks, business_profile_id ...0006)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-04-06 — Whole-lechon order post promoted to Talisay/Cebu City food audience.
--   ROAS=5.78  CTR=3.33  CR=5.6  CAC=81.82  CPC=1.8  PES≈0.61 (Good Performance)
    ('90000000-0000-0000-0000-000000000040', '20000000-0000-0000-0000-000000000006',
     15000, 500, 900.00, 5200.00, 34, 28, 11,
     3.33, 1.8, 5.6, 5.78, 81.82,
     0.61, 'Good Performance',
     4, '2026-04-06', '2026-04-12',
     TIMESTAMP '2026-04-06 09:00:00', TIMESTAMP '2026-04-06 09:45:00'),

-- Week 2 · 2026-04-13 — Mid-week dip — fiesta catering orders concentrate on weekends.
--   ROAS=5.53  CTR=3.24  CR=5.22  CAC=94.44  CPC=1.85  PES≈0.59 (Fair Performance)
    ('90000000-0000-0000-0000-000000000041', '20000000-0000-0000-0000-000000000006',
     14200, 460, 850.00, 4700.00, 30, 24, 9,
     3.24, 1.85, 5.22, 5.53, 94.44,
     0.59, 'Fair Performance',
     4, '2026-04-13', '2026-04-19',
     TIMESTAMP '2026-04-13 09:00:00', TIMESTAMP '2026-04-13 09:45:00'),

-- Week 3 · 2026-04-20 — Province-wide delivery radius widened slightly; small lift.
--   ROAS=5.81  CTR=3.33  CR=5.77  CAC=77.5  CPC=1.79  PES≈0.62 (Good Performance)
    ('90000000-0000-0000-0000-000000000042', '20000000-0000-0000-0000-000000000006',
     15600, 520, 930.00, 5400.00, 36, 30, 12,
     3.33, 1.79, 5.77, 5.81, 77.5,
     0.62, 'Good Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00'),

-- Week 4 · 2026-04-27 — Charcoal supply cost nudges spend down; demand tracks with it.
--   ROAS=5.48  CTR=3.24  CR=5.11  CAC=93.33  CPC=1.87  PES≈0.59 (Fair Performance)
    ('90000000-0000-0000-0000-000000000043', '20000000-0000-0000-0000-000000000006',
     13900, 450, 840.00, 4600.00, 29, 23, 9,
     3.24, 1.87, 5.11, 5.48, 93.33,
     0.59, 'Fair Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00'),

-- Week 5 · 2026-05-04 — Wedding catering inquiry post performs in line with baseline.
--   ROAS=5.82  CTR=3.33  CR=5.69  CAC=82.73  CPC=1.78  PES≈0.62 (Good Performance)
    ('90000000-0000-0000-0000-000000000044', '20000000-0000-0000-0000-000000000006',
     15300, 510, 910.00, 5300.00, 35, 29, 11,
     3.33, 1.78, 5.69, 5.82, 82.73,
     0.62, 'Good Performance',
     4, '2026-05-04', '2026-05-10',
     TIMESTAMP '2026-05-04 09:00:00', TIMESTAMP '2026-05-04 09:45:00'),

-- Week 6 · 2026-05-11 — Steady repeat-customer demand, no new growth lever pulled.
--   ROAS=5.63  CTR=3.29  CR=5.42  CAC=87.0  CPC=1.81  PES≈0.6 (Good Performance)
    ('90000000-0000-0000-0000-000000000045', '20000000-0000-0000-0000-000000000006',
     14600, 480, 870.00, 4900.00, 32, 26, 10,
     3.29, 1.81, 5.42, 5.63, 87.0,
     0.6, 'Good Performance',
     4, '2026-05-11', '2026-05-17',
     TIMESTAMP '2026-05-11 09:00:00', TIMESTAMP '2026-05-11 09:45:00'),

-- Week 7 · 2026-05-18 — Closes the run at the same modest, dependable level.
--   ROAS=5.83  CTR=3.34  CR=5.54  CAC=81.82  CPC=1.78  PES≈0.61 (Good Performance)
    ('90000000-0000-0000-0000-000000000046', '20000000-0000-0000-0000-000000000006',
     15100, 505, 900.00, 5250.00, 34, 28, 11,
     3.34, 1.78, 5.54, 5.83, 81.82,
     0.61, 'Good Performance',
     4, '2026-05-18', '2026-05-24',
     TIMESTAMP '2026-05-18 09:00:00', TIMESTAMP '2026-05-18 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- Mactan Sunset Beachfront Resort  (DOWN trend, 9 weeks, business_profile_id ...0007)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-04-13 — Strong start — airport-layover audience converting well on day-use packages.
--   ROAS=8.1  CTR=4.0  CR=4.86  CAC=76.36  CPC=1.17  PES≈0.7 (Good Performance)
    ('90000000-0000-0000-0000-000000000047', '20000000-0000-0000-0000-000000000007',
     90000, 3600, 4200.00, 34000.00, 210, 175, 55,
     4.0, 1.17, 4.86, 8.1, 76.36,
     0.7, 'Good Performance',
     4, '2026-04-13', '2026-04-19',
     TIMESTAMP '2026-04-13 09:00:00', TIMESTAMP '2026-04-13 09:45:00'),

-- Week 2 · 2026-04-20 — Early signs of ad fatigue — same creative running a third week.
--   ROAS=7.2  CTR=3.76  CR=4.69  CAC=87.23  CPC=1.28  PES≈0.66 (Good Performance)
    ('90000000-0000-0000-0000-000000000048', '20000000-0000-0000-0000-000000000007',
     85000, 3200, 4100.00, 29500.00, 185, 150, 47,
     3.76, 1.28, 4.69, 7.2, 87.23,
     0.66, 'Good Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00'),

-- Week 3 · 2026-04-27 — CTR softening; a competitor resort launches an aggressive promo.
--   ROAS=6.0  CTR=3.46  CR=4.52  CAC=105.26  CPC=1.48  PES≈0.6 (Good Performance)
    ('90000000-0000-0000-0000-000000000049', '20000000-0000-0000-0000-000000000007',
     78000, 2700, 4000.00, 24000.00, 155, 122, 38,
     3.46, 1.48, 4.52, 6.0, 105.26,
     0.6, 'Good Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00'),

-- Week 4 · 2026-05-04 — Rising CAC as remaining audience segments convert less easily.
--   ROAS=4.94  CTR=3.12  CR=4.36  CAC=131.67  CPC=1.76  PES≈0.55 (Fair Performance)
    ('90000000-0000-0000-0000-000000000050', '20000000-0000-0000-0000-000000000007',
     72000, 2250, 3950.00, 19500.00, 128, 98, 30,
     3.12, 1.76, 4.36, 4.94, 131.67,
     0.55, 'Fair Performance',
     4, '2026-05-04', '2026-05-10',
     TIMESTAMP '2026-05-04 09:00:00', TIMESTAMP '2026-05-04 09:45:00'),

-- Week 5 · 2026-05-11 — Peso weakens against key inbound currencies — fewer high-value layovers.
--   ROAS=3.97  CTR=2.8  CR=4.11  CAC=169.57  CPC=2.11  PES≈0.49 (Fair Performance)
    ('90000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000007',
     66000, 1850, 3900.00, 15500.00, 104, 76, 23,
     2.8, 2.11, 4.11, 3.97, 169.57,
     0.49, 'Fair Performance',
     4, '2026-05-11', '2026-05-17',
     TIMESTAMP '2026-05-11 09:00:00', TIMESTAMP '2026-05-11 09:45:00'),

-- Week 6 · 2026-05-18 — Creative refresh delayed; engagement continues to erode.
--   ROAS=3.12  CTR=2.5  CR=3.87  CAC=226.47  CPC=2.57  PES≈0.44 (Fair Performance)
    ('90000000-0000-0000-0000-000000000052', '20000000-0000-0000-0000-000000000007',
     60000, 1500, 3850.00, 12000.00, 82, 58, 17,
     2.5, 2.57, 3.87, 3.12, 226.47,
     0.44, 'Fair Performance',
     4, '2026-05-18', '2026-05-24',
     TIMESTAMP '2026-05-18 09:00:00', TIMESTAMP '2026-05-18 09:45:00'),

-- Week 7 · 2026-05-25 — Shoulder-season slowdown compounds the fatigue effect.
--   ROAS=2.42  CTR=2.18  CR=3.58  CAC=292.31  CPC=3.17  PES≈0.4 (Fair Performance)
    ('90000000-0000-0000-0000-000000000053', '20000000-0000-0000-0000-000000000007',
     55000, 1200, 3800.00, 9200.00, 64, 43, 13,
     2.18, 3.17, 3.58, 2.42, 292.31,
     0.4, 'Fair Performance',
     4, '2026-05-25', '2026-05-31',
     TIMESTAMP '2026-05-25 09:00:00', TIMESTAMP '2026-05-25 09:45:00'),

-- Week 8 · 2026-06-01 — Spend held flat into a shrinking audience — efficiency keeps dropping.
--   ROAS=1.87  CTR=1.9  CR=3.26  CAC=416.67  CPC=3.95  PES≈0.36 (Poor Performance)
    ('90000000-0000-0000-0000-000000000054', '20000000-0000-0000-0000-000000000007',
     50000, 950, 3750.00, 7000.00, 49, 31, 9,
     1.9, 3.95, 3.26, 1.87, 416.67,
     0.36, 'Poor Performance',
     4, '2026-06-01', '2026-06-07',
     TIMESTAMP '2026-06-01 09:00:00', TIMESTAMP '2026-06-01 09:45:00'),

-- Week 9 · 2026-06-08 — Campaign now in clear decline; flagged for a creative overhaul.
--   ROAS=1.43  CTR=1.65  CR=2.89  CAC=528.57  CPC=4.87  PES≈0.33 (Poor Performance)
    ('90000000-0000-0000-0000-000000000055', '20000000-0000-0000-0000-000000000007',
     46000, 760, 3700.00, 5300.00, 37, 22, 7,
     1.65, 4.87, 2.89, 1.43, 528.57,
     0.33, 'Poor Performance',
     4, '2026-06-08', '2026-06-14',
     TIMESTAMP '2026-06-08 09:00:00', TIMESTAMP '2026-06-08 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- IT Park Nightlife & City Tour Co.  (DOWN trend, 6 weeks, business_profile_id ...0008)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-04-20 — Rooftop-hopping tour launch post — strong initial IT Park foot traffic.
--   ROAS=5.79  CTR=4.12  CR=4.43  CAC=95.0  CPC=1.36  PES≈0.6 (Good Performance)
    ('90000000-0000-0000-0000-000000000056', '20000000-0000-0000-0000-000000000008',
     34000, 1400, 1900.00, 11000.00, 78, 62, 20,
     4.12, 1.36, 4.43, 5.79, 95.0,
     0.6, 'Good Performance',
     4, '2026-04-20', '2026-04-26',
     TIMESTAMP '2026-04-20 09:00:00', TIMESTAMP '2026-04-20 09:45:00'),

-- Week 2 · 2026-04-27 — Reach narrows as the novelty of the launch post wears off.
--   ROAS=4.65  CTR=3.71  CR=4.17  CAC=124.67  CPC=1.63  PES≈0.54 (Fair Performance)
    ('90000000-0000-0000-0000-000000000057', '20000000-0000-0000-0000-000000000008',
     31000, 1150, 1870.00, 8700.00, 63, 48, 15,
     3.71, 1.63, 4.17, 4.65, 124.67,
     0.54, 'Fair Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00'),

-- Week 3 · 2026-05-04 — A new nightlife operator enters IT Park, splitting the audience.
--   ROAS=3.61  CTR=3.27  CR=3.89  CAC=166.36  CPC=2.03  PES≈0.48 (Fair Performance)
    ('90000000-0000-0000-0000-000000000058', '20000000-0000-0000-0000-000000000008',
     27500, 900, 1830.00, 6600.00, 49, 35, 11,
     3.27, 2.03, 3.89, 3.61, 166.36,
     0.48, 'Fair Performance',
     4, '2026-05-04', '2026-05-10',
     TIMESTAMP '2026-05-04 09:00:00', TIMESTAMP '2026-05-04 09:45:00'),

-- Week 4 · 2026-05-11 — Bar-hopping route creative unchanged for a month; engagement fades.
--   ROAS=2.67  CTR=2.83  CR=3.53  CAC=225.0  CPC=2.65  PES≈0.42 (Fair Performance)
    ('90000000-0000-0000-0000-000000000059', '20000000-0000-0000-0000-000000000008',
     24000, 680, 1800.00, 4800.00, 36, 24, 8,
     2.83, 2.65, 3.53, 2.67, 225.0,
     0.42, 'Fair Performance',
     4, '2026-05-11', '2026-05-17',
     TIMESTAMP '2026-05-11 09:00:00', TIMESTAMP '2026-05-11 09:45:00'),

-- Week 5 · 2026-05-18 — Rainy-season evenings suppress walk-in bookings further.
--   ROAS=1.86  CTR=2.38  CR=3.0  CAC=354.0  CPC=3.54  PES≈0.37 (Poor Performance)
    ('90000000-0000-0000-0000-000000000060', '20000000-0000-0000-0000-000000000008',
     21000, 500, 1770.00, 3300.00, 25, 15, 5,
     2.38, 3.54, 3.0, 1.86, 354.0,
     0.37, 'Poor Performance',
     4, '2026-05-18', '2026-05-24',
     TIMESTAMP '2026-05-18 09:00:00', TIMESTAMP '2026-05-18 09:45:00'),

-- Week 6 · 2026-05-25 — Campaign bottoms out; spend no longer justified at this efficiency.
--   ROAS=1.26  CTR=1.95  CR=2.5  CAC=583.33  CPC=4.86  PES≈0.32 (Poor Performance)
    ('90000000-0000-0000-0000-000000000061', '20000000-0000-0000-0000-000000000008',
     18500, 360, 1750.00, 2200.00, 17, 9, 3,
     1.95, 4.86, 2.5, 1.26, 583.33,
     0.32, 'Poor Performance',
     4, '2026-05-25', '2026-05-31',
     TIMESTAMP '2026-05-25 09:00:00', TIMESTAMP '2026-05-25 09:45:00');

-- ════════════════════════════════════════════════════════════════════════
-- Carbon Market Street Food Crawl  (DOWN trend, 7 weeks, business_profile_id ...0009)
-- ════════════════════════════════════════════════════════════════════════
MERGE INTO tbl_campaign_records (
    campaign_id, business_profile_id,
    impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers,
    ctr, cpc, conv_rate, roas, cac,
    pes_score, pes_label,
    analysis_weeks, period_start, period_end,
    created_at, updated_at
) KEY (campaign_id) VALUES
-- Week 1 · 2026-04-27 — Carbon Market food-crawl post launches strong on foodie social channels.
--   ROAS=6.18  CTR=4.05  CR=4.47  CAC=84.62  CPC=1.29  PES≈0.62 (Good Performance)
    ('90000000-0000-0000-0000-000000000062', '20000000-0000-0000-0000-000000000009',
     21000, 850, 1100.00, 6800.00, 48, 38, 13,
     4.05, 1.29, 4.47, 6.18, 84.62,
     0.62, 'Good Performance',
     4, '2026-04-27', '2026-05-03',
     TIMESTAMP '2026-04-27 09:00:00', TIMESTAMP '2026-04-27 09:45:00'),

-- Week 2 · 2026-05-04 — One featured vendor stall temporarily closes, narrowing the crawl route.
--   ROAS=5.0  CTR=3.65  CR=4.29  CAC=108.0  CPC=1.54  PES≈0.56 (Fair Performance)
    ('90000000-0000-0000-0000-000000000063', '20000000-0000-0000-0000-000000000009',
     19200, 700, 1080.00, 5400.00, 39, 30, 10,
     3.65, 1.54, 4.29, 5.0, 108.0,
     0.56, 'Fair Performance',
     4, '2026-05-04', '2026-05-10',
     TIMESTAMP '2026-05-04 09:00:00', TIMESTAMP '2026-05-04 09:45:00'),

-- Week 3 · 2026-05-11 — Wet-market renovation work disrupts a portion of the usual route.
--   ROAS=3.9  CTR=3.29  CR=3.93  CAC=150.0  CPC=1.88  PES≈0.49 (Fair Performance)
    ('90000000-0000-0000-0000-000000000064', '20000000-0000-0000-0000-000000000009',
     17000, 560, 1050.00, 4100.00, 31, 22, 7,
     3.29, 1.88, 3.93, 3.9, 150.0,
     0.49, 'Fair Performance',
     4, '2026-05-11', '2026-05-17',
     TIMESTAMP '2026-05-11 09:00:00', TIMESTAMP '2026-05-11 09:45:00'),

-- Week 4 · 2026-05-18 — Reduced walkability keeps dragging down conversions week over week.
--   ROAS=2.94  CTR=2.89  CR=3.64  CAC=204.0  CPC=2.32  PES≈0.44 (Fair Performance)
    ('90000000-0000-0000-0000-000000000065', '20000000-0000-0000-0000-000000000009',
     15200, 440, 1020.00, 3000.00, 24, 16, 5,
     2.89, 2.32, 3.64, 2.94, 204.0,
     0.44, 'Fair Performance',
     4, '2026-05-18', '2026-05-24',
     TIMESTAMP '2026-05-18 09:00:00', TIMESTAMP '2026-05-18 09:45:00'),

-- Week 5 · 2026-05-25 — Word-of-mouth slows as the disrupted route dampens reviews.
--   ROAS=2.1  CTR=2.52  CR=3.24  CAC=250.0  CPC=2.94  PES≈0.39 (Poor Performance)
    ('90000000-0000-0000-0000-000000000066', '20000000-0000-0000-0000-000000000009',
     13500, 340, 1000.00, 2100.00, 18, 11, 4,
     2.52, 2.94, 3.24, 2.1, 250.0,
     0.39, 'Poor Performance',
     4, '2026-05-25', '2026-05-31',
     TIMESTAMP '2026-05-25 09:00:00', TIMESTAMP '2026-05-25 09:45:00'),

-- Week 6 · 2026-06-01 — Spend trimmed but efficiency keeps falling alongside demand.
--   ROAS=1.48  CTR=2.17  CR=2.69  CAC=326.67  CPC=3.77  PES≈0.34 (Poor Performance)
    ('90000000-0000-0000-0000-000000000067', '20000000-0000-0000-0000-000000000009',
     12000, 260, 980.00, 1450.00, 13, 7, 3,
     2.17, 3.77, 2.69, 1.48, 326.67,
     0.34, 'Poor Performance',
     4, '2026-06-01', '2026-06-07',
     TIMESTAMP '2026-06-01 09:00:00', TIMESTAMP '2026-06-01 09:45:00'),

-- Week 7 · 2026-06-08 — Campaign at its weakest point; route restoration needed to recover.
--   ROAS=1.02  CTR=1.85  CR=2.0  CAC=480.0  CPC=4.8  PES≈0.3 (Poor Performance)
    ('90000000-0000-0000-0000-000000000068', '20000000-0000-0000-0000-000000000009',
     10800, 200, 960.00, 980.00, 9, 4, 2,
     1.85, 4.8, 2.0, 1.02, 480.0,
     0.3, 'Poor Performance',
     4, '2026-06-08', '2026-06-14',
     TIMESTAMP '2026-06-08 09:00:00', TIMESTAMP '2026-06-08 09:45:00');
