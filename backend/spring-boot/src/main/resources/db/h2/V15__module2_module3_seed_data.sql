-- V15 (H2) — mirror of db/migration/V18__module2_module3_seed_data.sql.
-- Module 2 (market signals/forecasting) and Module 3 (promotional content/
-- creative direction) per-operator seed data, for the 9 Cebu MSME operators
-- seeded in V2 (business_profile_id 20000000-...-0000000000N, N=1..9).
--
-- H2 differences vs Postgres:
--   INSERT .. ON CONFLICT DO NOTHING  -> MERGE INTO .. KEY(pk) VALUES (..)
--   TIMESTAMPTZ 'yyyy-MM-dd HH:mm:ss+08'  -> TIMESTAMP 'yyyy-MM-dd HH:mm:ss'
--     (all tables here use plain H2 TIMESTAMP columns, no offset stored)
--   except tbl_market_economic_trend.fetched_at, which is
--     TIMESTAMP WITH TIME ZONE (see h2/V11) -> literal keeps the +08:00 offset.
--
-- tbl_market_economic_trend already has an H2 mirror table (created in
-- h2/V11__module2_market_economic_trend.sql), so no CREATE TABLE is needed
-- here — this file only inserts into it.
--
-- See db/migration/V18 for the full operator -> target_market map and the
-- fixed UUID scheme (identical here; N = operator index 1..9):
--   50000000-...-00000000000N : tbl_market_signal_record, most-recent-week row
--   51000000-...-00000000000N : tbl_market_signal_record, prior-week row
--   60000000-...-00000000000N : tbl_forecast_result
--   70000000-...-00000000000N : tbl_market_score
--   80000000-...-00000000000N : tbl_demand_alert (operators 1, 3, 5, 7, 9 only)
--   90000000-...-000000000001/2/3 : tbl_market_economic_trend (korea/japan/usa)
--   a0000000-...-00000000000N : tbl_localized_promotional_content
--   b0000000-...-00000000000N : tbl_creative_direction_output
--   c0000000-...-00000000000N : tbl_promotional_asset
--
-- Out of scope (per task): tbl_orig_weekly_demand_value, tbl_ingestion_job_log,
-- tbl_content_generation_log, tbl_creative_direction_log (audit-trail tables),
-- and the compliance tables (dropped in h2/V13 — do not reference).

-- ════════════════════════════════════════════════════════════════════════════
-- Module 2 — Market Signals & Forecasting
-- ════════════════════════════════════════════════════════════════════════════

-- ── tbl_market_signal_record: 2 rows/operator (prior week + most recent) ─────
MERGE INTO tbl_market_signal_record (
    signal_record_id, business_profile_id, target_market,
    trend_index, forex_rate, gdp_growth, seasonality_score, rolling_average,
    spike_indicator, rolling_std_dev, rolling_average_7d, rolling_average_30d,
    yoy_ratio, aggregated_at
) KEY (signal_record_id) VALUES
    -- Op 1 — Moalboal FreeDive Cebu (korea)
    ('51000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'korea', 58, 0.0413, 2.1, 0.62, 55, FALSE, 4.2, 55, 50, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'korea', 76, 0.0416, 2.1, 0.62, 61, TRUE,  7.8, 61, 52, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 2 — Oslob Whale Shark Adventures (usa)
    ('51000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'usa', 61, 58.42, 2.6, 0.55, 60, FALSE, 3.1, 60, 58, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'usa', 64, 58.65, 2.6, 0.55, 62, FALSE, 3.4, 62, 59, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 3 — Bantayan Blue Waters Island Hopping (japan)
    ('51000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'japan', 45, 0.384, 0.9, 0.70, 44, FALSE, 3.8, 44, 41, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'japan', 63, 0.387, 0.9, 0.70, 50, TRUE,  6.9, 50, 43, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 4 — Sugbo Heritage Walks (japan)
    ('51000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'japan', 39, 0.384, 0.9, 0.40, 38, FALSE, 2.0, 38, 37, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'japan', 41, 0.387, 0.9, 0.40, 40, FALSE, 2.2, 40, 38, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 5 — Sinulog Fiesta Dance & Cultural Show (usa)
    ('51000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'usa', 50, 58.42, 2.6, 0.45, 49, FALSE, 3.5, 49, 46, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'usa', 70, 58.65, 2.6, 0.45, 56, TRUE,  7.1, 56, 48, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 6 — Nena's Talisay Lechon House (korea)
    ('51000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'korea', 55, 0.0413, 2.1, 0.58, 54, FALSE, 2.6, 54, 52, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'korea', 57, 0.0416, 2.1, 0.58, 56, FALSE, 2.8, 56, 53, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 7 — Mactan Sunset Beachfront Resort (korea)
    ('51000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'korea', 60, 0.0413, 2.1, 0.68, 58, FALSE, 4.0, 58, 55, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'korea', 79, 0.0416, 2.1, 0.68, 64, TRUE,  8.2, 64, 57, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 8 — IT Park Nightlife & City Tour Co. (usa)
    ('51000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'usa', 48, 58.42, 2.6, 0.42, 47, FALSE, 2.2, 47, 46, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'usa', 50, 58.65, 2.6, 0.42, 49, FALSE, 2.4, 49, 47, NULL, TIMESTAMP '2026-07-27 09:00:00'),
    -- Op 9 — Carbon Market Street Food Crawl (japan)
    ('51000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'japan', 42, 0.384, 0.9, 0.50, 41, FALSE, 3.3, 41, 39, NULL, TIMESTAMP '2026-07-20 09:00:00'),
    ('50000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'japan', 68, 0.387, 0.9, 0.50, 48, TRUE,  7.6, 48, 41, NULL, TIMESTAMP '2026-07-27 09:00:00');

-- ── tbl_forecast_result: 1 row/operator ───────────────────────────────────────
MERGE INTO tbl_forecast_result (
    forecast_result_id, business_profile_id, target_market,
    predicted_demand, forecast_confidence, mape_score, mae, rmse,
    forecast_horizon_weeks, generated_at
) KEY (forecast_result_id) VALUES
    ('60000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'korea', 79.4, 0.84, 8.2,  3.1, 4.0, 4, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'usa',   66.8, 0.81, 9.6,  3.6, 4.5, 8, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'japan', 66.2, 0.78, 10.4, 4.0, 5.1, 4, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'japan', 42.5, 0.87, 6.9,  2.2, 2.9, 8, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'usa',   73.1, 0.76, 11.8, 4.4, 5.6, 4, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'korea', 59.0, 0.85, 7.4,  2.5, 3.2, 8, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'korea', 82.6, 0.79, 10.9, 4.6, 5.9, 4, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'usa',   51.7, 0.83, 8.0,  2.4, 3.0, 8, TIMESTAMP '2026-07-27 10:00:00'),
    ('60000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'japan', 70.9, 0.77, 12.1, 4.3, 5.4, 4, TIMESTAMP '2026-07-27 10:00:00');

-- ── tbl_market_score: 1 row/operator, FK'd to forecast_result ────────────────
MERGE INTO tbl_market_score (
    market_score_id, forecast_result_id, market_score, seasonality_score,
    spike_indicator, gdp_per_capita_growth, forex_vs_php, historical_arrivals,
    market_rank, evaluated_at
) KEY (market_score_id) VALUES
    ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 0.81, 0.62, TRUE,  2.1, 0.0416, 128000, 1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', 0.74, 0.55, FALSE, 2.6, 58.65,  96000,  1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003', 0.77, 0.70, TRUE,  0.9, 0.387,  41000,  1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004', 0.68, 0.40, FALSE, 0.9, 0.387,  35000,  1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000005', 0.71, 0.45, TRUE,  2.6, 58.65,  88000,  1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006', 0.79, 0.58, FALSE, 2.1, 0.0416, 132000, 1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000007', 0.83, 0.68, TRUE,  2.1, 0.0416, 121000, 1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000008', '60000000-0000-0000-0000-000000000008', 0.66, 0.42, FALSE, 2.6, 58.65,  79000,  1, TIMESTAMP '2026-07-27 10:05:00'),
    ('70000000-0000-0000-0000-000000000009', '60000000-0000-0000-0000-000000000009', 0.75, 0.50, TRUE,  0.9, 0.387,  38000,  1, TIMESTAMP '2026-07-27 10:05:00');

-- ── tbl_demand_alert: operators with a notable spike this cycle (1,3,5,7,9) ──
MERGE INTO tbl_demand_alert (
    demand_alert_id, market_score_id, alert_level, alert_message, is_read,
    trend, window_open_date, alert_date
) KEY (demand_alert_id) VALUES
    ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'WARNING',
     'Demand window opening for Korea — Moalboal FreeDive Cebu search interest is 31% above the 30-day baseline. Target Korean-market promotion within the next 4 weeks.',
     FALSE, 'Rising demand window', TIMESTAMP '2026-08-03 10:10:00', TIMESTAMP '2026-07-27 10:10:00'),
    ('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'WARNING',
     'Demand window opening for Japan — Bantayan Blue Waters Island Hopping search interest is 40% above the 30-day baseline, likely tied to sandbar-season travel planning.',
     TRUE, 'Rising demand window', TIMESTAMP '2026-08-03 10:10:00', TIMESTAMP '2026-07-27 10:10:00'),
    ('80000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000005', 'CRITICAL',
     'Sharp demand spike detected for USA — Sinulog Fiesta Dance & Cultural Show interest is 40% above baseline; push US-market ad spend now before the window closes.',
     FALSE, 'Sudden interest spike', TIMESTAMP '2026-08-03 10:10:00', TIMESTAMP '2026-07-27 10:10:00'),
    ('80000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000007', 'CRITICAL',
     'Sharp demand spike detected for Korea — Mactan Sunset Beachfront Resort search interest is 32% above baseline heading into peak season.',
     TRUE, 'Sudden interest spike', TIMESTAMP '2026-08-03 10:10:00', TIMESTAMP '2026-07-27 10:10:00'),
    ('80000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000009', 'WARNING',
     'Demand window opening for Japan — Carbon Market Street Food Crawl interest is 62% above the 30-day baseline following recent social virality.',
     FALSE, 'Rising demand window', TIMESTAMP '2026-08-03 10:10:00', TIMESTAMP '2026-07-27 10:10:00');

-- ── tbl_market_economic_trend: 3 global/shared rows (one per market) ─────────
-- Table already created in h2/V11__module2_market_economic_trend.sql.
MERGE INTO tbl_market_economic_trend (
    trend_id, market, gdp_trend_json, forex_trend_json, gdp_latest, forex_latest,
    currency_code, gdp_points, forex_points, fetched_at
) KEY (trend_id) VALUES
    ('90000000-0000-0000-0000-000000000001', 'korea',
     '[{"year":2022,"value":2.6},{"year":2023,"value":1.4},{"year":2024,"value":2.0},{"year":2025,"value":2.2},{"year":2026,"value":2.1}]',
     '[{"date":"2026-04","value":0.0409},{"date":"2026-05","value":0.0411},{"date":"2026-06","value":0.0414},{"date":"2026-07","value":0.0416}]',
     2.1, 0.0416, 'KRW', 5, 4, TIMESTAMP WITH TIME ZONE '2026-07-27 08:00:00+08:00'),
    ('90000000-0000-0000-0000-000000000002', 'japan',
     '[{"year":2022,"value":1.0},{"year":2023,"value":1.9},{"year":2024,"value":0.1},{"year":2025,"value":0.6},{"year":2026,"value":0.9}]',
     '[{"date":"2026-04","value":0.379},{"date":"2026-05","value":0.381},{"date":"2026-06","value":0.384},{"date":"2026-07","value":0.387}]',
     0.9, 0.387, 'JPY', 5, 4, TIMESTAMP WITH TIME ZONE '2026-07-27 08:00:00+08:00'),
    ('90000000-0000-0000-0000-000000000003', 'usa',
     '[{"year":2022,"value":2.5},{"year":2023,"value":2.9},{"year":2024,"value":2.8},{"year":2025,"value":2.7},{"year":2026,"value":2.6}]',
     '[{"date":"2026-04","value":57.9},{"date":"2026-05","value":58.1},{"date":"2026-06","value":58.4},{"date":"2026-07","value":58.65}]',
     2.6, 58.65, 'USD', 5, 4, TIMESTAMP WITH TIME ZONE '2026-07-27 08:00:00+08:00');

-- ════════════════════════════════════════════════════════════════════════════
-- Module 3 — Promotional Content & Creative Direction
-- ════════════════════════════════════════════════════════════════════════════

-- ── tbl_localized_promotional_content: 1 row/operator ─────────────────────────
MERGE INTO tbl_localized_promotional_content (
    content_id, business_profile_id, selected_market, platform, generated_caption,
    content_direction, hashtags, cta, tone_suggestion, framework, source,
    approval_status, approved_at, generated_at
) KEY (content_id) VALUES
    ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'korea', 'Instagram',
     '모알보알의 전설적인 정어리 떼와 함께 헤엄치세요 🐟🌊 PADI 공인 프리다이빙 자격증 취득부터 바다거북 스노클링까지, 팡가사마 비치에서 특별한 하루를 시작하세요!',
     'Lead with underwater sardine-run footage shot from below looking up at the bait ball, cut to a certification-badge overlay, close with turtle-encounter b-roll to build a skill-plus-adventure narrative for Korean divers researching Moalboal.',
     '#세부여행 #모알보알 #정어리떼 #프리다이빙 #세부다이빙 #필리핀여행',
     '지금 예약하고 프리다이빙 자격증까지 취득하세요 (DM으로 문의)',
     'Adventurous, aspirational, slightly technical to reassure certification-seeking divers',
     'AIDA', 'gemini', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'usa', 'Facebook',
     'Swim beside gentle giants at sunrise. Our small-group whale shark encounters in Oslob follow strict conservation guidelines, then wind down with a countryside ride to Tumalog Falls — one unforgettable Cebu morning, done right.',
     'Open on a drone shot of a whale shark silhouette beneath the boat, cut to guest reactions in the water, close on the waterfall to show the full half-day arc; emphasize the ethical/small-group angle for conservation-minded American travelers.',
     '#WhaleSharkOslob #CebuPhilippines #BucketListTravel #TumalogFalls #ResponsibleTourism',
     'Book your morning encounter — limited daily slots to protect the whale sharks.',
     'Awe-inspiring, trustworthy, conservation-forward',
     'PAS', 'gemini', FALSE, NULL, TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'japan', 'TikTok',
     'バンタヤン島の隠れたサンドバーへ🏖️小さな伝統ボートだから、大型ツアーが来ない静かなヴァージン島とヒランタガアンを独り占め。夕日を見ながらのセーリングも人気です。',
     'Quick-cut TikTok montage: boat launch, drone over the turquoise sandbar, feet-in-sand shot, ending on a golden-hour sail; overlay text emphasizing "no crowds" since Japanese travelers value uncrowded, serene experiences.',
     '#セブ島 #バンタヤン島 #アイランドホッピング #フィリピン旅行 #サンドバー',
     'プロフィールのリンクからご予約ください',
     'Serene, intimate, nature-forward',
     'AIDA', 'gemini', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'japan', 'Instagram',
     'セブの歴史を歩く旅へ。サン・ペドロ要塞からマゼラン・クロス、サント・ニーニョ聖堂まで、地元の歴史家がご案内します。ガイドブックにはない物語がここに。',
     'Sequence heritage sites in walking order with the historian guide narrating on-camera; subtitle key historical facts to appeal to Japanese travelers'' strong interest in curated cultural/historical narratives.',
     '#セブ観光 #サンペドロ要塞 #マゼランクロス #フィリピン歴史 #セブ島旅行',
     '少人数ガイドツアーの予約はこちらから',
     'Scholarly, respectful, storytelling',
     'PAS', 'gemini', FALSE, NULL, TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'usa', 'Facebook',
     'Feel the beat of Sinulog every single night. Live drums, festival costumes, and an audience street-dance finale bring Cebu''s biggest festival to your evening — no January flight required.',
     'Open on the full-costume drum line entrance, cut to close-ups of festival attire detail, end on the audience joining the street-dance segment; frame as "festival energy on demand" for US travelers who can''t time a trip to January.',
     '#SinulogFestival #CebuNightlife #PhilippineCulture #FiestaCebu #ThingsToDoInCebu',
     'Reserve your dinner-and-show table for tonight''s performance.',
     'High-energy, festive, immersive',
     'AIDA', 'gemini', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'korea', 'TikTok',
     '3대째 이어온 탈리사이 레촌 맛집🐖🔥 8시간 동안 숯불에 정성껏 구운 바삭한 껍질, 세부에 오면 꼭 먹어야 할 그 맛.',
     'Show a whole-pig roasting-over-charcoal timelapse, a crackling-skin close-up sound bite, then a plated serving shot; lean into ASMR-style crackling audio, which performs well with Korean TikTok food audiences.',
     '#세부맛집 #레촌 #필리핀음식 #탈리사이 #세부여행',
     '매장 방문 또는 세부 전역 배달 주문 가능',
     'Warm, indulgent, heritage-proud',
     'PAS', 'gemini', FALSE, NULL, TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'korea', 'Instagram',
     '공항에서 단 10분, 프라이빗 코브가 있는 막탄 선셋 리조트 🌅 인피니티 풀에서 노을을 바라보며 진짜 휴양을 경험하세요.',
     'Drone shot of the private cove and infinity pool at golden hour, cut to a room reveal, close on the sunset-cruise add-on; emphasize proximity to the airport for Korean layover/short-stay travelers.',
     '#막탄리조트 #세부여행 #인피니티풀 #막탄선셋 #필리핀휴양',
     '지금 예약하고 선셋 크루즈 패키지 혜택 받기',
     'Luxurious, relaxing, aspirational',
     'AIDA', 'gemini', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'usa', 'Facebook',
     'Rooftop bars, street eats, and Cebu''s best nightlife — all on foot. Our IT Park to Escario circuit is built for digital nomads and business travelers who want a real night out without renting a car.',
     'Sequence a rooftop-bar arrival, food-strip vendor shots, and a closing group photo on a rooftop skyline view; position as the no-car-needed nightlife answer for US remote workers/business travelers staying in IT Park.',
     '#CebuITPark #CebuNightlife #DigitalNomadCebu #ThingsToDoInCebu #RooftopBars',
     'Message us to lock in tonight''s small-group crawl.',
     'Social, upbeat, insider-access',
     'PAS', 'gemini', FALSE, NULL, TIMESTAMP '2026-07-28 09:00:00'),

    ('a0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'japan', 'TikTok',
     '地元民しか知らないカーボンマーケットの裏路地へ。プソ、ンゴヒオン、ドライマンゴー…10年来の付き合いだから入れる屋台をご案内します。',
     'Rapid-fire street-food montage cutting between vendor prep and reaction bites, ending on a group tasting table; highlight "insider access earned over a decade" to appeal to Japanese travelers seeking authentic, non-touristy food experiences.',
     '#セブグルメ #カーボンマーケット #フィリピン屋台飯 #セブ島旅行 #ストリートフード',
     '少人数ツアーの予約はDMまたはリンクから',
     'Authentic, curious, community-rooted',
     'AIDA', 'gemini', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:00:00');

-- ── tbl_creative_direction_output: 1 row/operator ─────────────────────────────
MERGE INTO tbl_creative_direction_output (
    creative_direction_id, business_profile_id, selected_market,
    shot_list_recommendations, visual_recommendations, lighting_suggestions,
    moodboard_references, platform_recommendations, visual_tone,
    approval_status, approved_at, generated_at
) KEY (creative_direction_id) VALUES
    ('b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'korea',
     'Underwater wide shot of the sardine bait ball; diver descent POV; turtle close-up; certification-card overlay; beach launch establishing shot.',
     'Cool blue-teal grading, high-contrast sunlight shafts through the water.',
     'Natural midday sun for underwater clarity; golden-hour beach shots for launch/return sequences.',
     'PADI campaign imagery, National Geographic underwater photography, Palawan dive-tourism reels.',
     'Instagram Reels primary, YouTube Shorts secondary for certification-course detail.',
     'Crisp, adventurous, trust-building', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'usa',
     'Aerial boat approach; whale shark silhouette from the surface; snorkeler POV alongside the shark; Tumalog Falls wide shot; guest smiling post-swim.',
     'Bright turquoise water tones, natural color grading, minimal saturation boost.',
     'Early-morning soft light for water clarity and calmer seas.',
     'Conservation-tourism campaigns, Discovery Channel wildlife cinematography.',
     'Facebook video ads targeting US 25-54 travel-intent audience; Instagram carousel for itinerary detail.',
     'Awe-driven, respectful, documentary-style', FALSE, NULL, TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'japan',
     'Bangka launch from Santa Fe pier; drone over Virgin Island sandbar; snorkeling POV at Hilantagaan; sunset-sail silhouette.',
     'Warm pastel sunset tones balanced with saturated turquoise daytime shots.',
     'Golden hour prioritized for sailing shots; overhead sun for sandbar drone shots.',
     'Boutique island-hopping reels, Palawan lagoon content, minimalist travel photography.',
     'TikTok short-form primary; Instagram Reels cross-post.',
     'Serene, uncrowded, intimate', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'japan',
     'Fort San Pedro walking entrance; Magellan''s Cross close-up; Basilica interior pan; guide storytelling to-camera; Colon Street heritage signage.',
     'Warm sepia-leaning grade evoking historical depth without looking dated.',
     'Soft diffused daylight; avoid harsh midday shadows on stone facades.',
     'Kyoto heritage-walk travel content, museum documentary style, NHK travel segments.',
     'Instagram Reels with on-screen historical captions; YouTube for longer narrated walkthroughs.',
     'Scholarly, respectful, immersive', FALSE, NULL, TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'usa',
     'Drumline entrance wide shot; costume detail macro; dancer footwork sequence; audience street-dance finale.',
     'Saturated festival colors — reds, golds, deep blues.',
     'Stage spotlighting with warm amber wash; controlled venue lighting.',
     'Sinulog festival archival footage, Rio carnival show reels, live-band concert cinematography.',
     'Facebook video for US diaspora and travel-intent audiences; Instagram Reels teaser cuts.',
     'High-energy, festive, celebratory', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'korea',
     'Charcoal-pit timelapse; hand-basting close-up; crackling-skin slice shot; family serving plated lechon; storefront signage.',
     'Warm, appetite-driven amber and red tones.',
     'Practical charcoal-glow lighting for authenticity; bright even light for plated food shots.',
     'Korean mukbang/ASMR food content, Filipino lechon documentary segments.',
     'TikTok primary for ASMR crackling audio; Instagram Reels for plated food shots.',
     'Warm, indulgent, heritage-proud', FALSE, NULL, TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'korea',
     'Drone over private cove; infinity-pool sunset wide shot; villa interior reveal; sunset-cruise departure.',
     'Warm golden-hour grade, high dynamic range for sky/water contrast.',
     'Golden hour mandatory for pool/cove hero shots; soft interior lighting for room reveal.',
     'Boutique resort campaigns, Amanpulo-style luxury travel content.',
     'Instagram Reels and carousel; Facebook for layover-package targeting.',
     'Luxurious, relaxing, aspirational', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'usa',
     'Rooftop bar arrival wide shot; cocktail pour close-up; Escario food-strip vendor interaction; group rooftop skyline photo.',
     'Cool neon-accented night grading with warm skin tones preserved.',
     'Practical bar/neon lighting; avoid harsh flash, lean into ambient venue light.',
     'Digital-nomad nightlife reels, Bangkok rooftop-bar content, city-tour vlogs.',
     'Facebook event-style video; Instagram Reels for nightlife circuit teaser.',
     'Social, upbeat, insider-access', FALSE, NULL, TIMESTAMP '2026-07-28 09:30:00'),

    ('b0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'japan',
     'Vendor stall prep close-up; puso/ngohiong cooking action; guest reaction bite; back-alley market wide shot; group tasting table.',
     'Vibrant, slightly desaturated documentary-style grading.',
     'Available market lighting for authenticity; supplemental fill for close-up food shots.',
     'Anthony Bourdain-style street-food documentary, Japanese gourmet travel vlogs.',
     'TikTok primary; Instagram Reels cross-post with translated captions.',
     'Authentic, curious, community-rooted', TRUE, TIMESTAMP '2026-07-29 09:15:00', TIMESTAMP '2026-07-28 09:30:00');

-- ── tbl_promotional_asset: 1 row/operator ─────────────────────────────────────
MERGE INTO tbl_promotional_asset (
    asset_id, business_profile_id, asset_type, asset_path, upload_status, uploaded_at
) KEY (asset_id) VALUES
    ('c0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'video', '/assets/promo/op1-moalboal-freedive-sardine-run.mp4', 'processed', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'image', '/assets/promo/op2-oslob-whaleshark-sunrise.jpg', 'uploaded', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'video', '/assets/promo/op3-bantayan-sandbar-hopping.mp4', 'processed', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'image', '/assets/promo/op4-sugbo-heritage-fortsanpedro.jpg', 'uploaded', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', 'video', '/assets/promo/op5-sinulog-dance-show.mp4', 'processed', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 'image', '/assets/promo/op6-nena-lechon-charcoal.jpg', 'uploaded', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'video', '/assets/promo/op7-mactan-sunset-resort-cove.mp4', 'processed', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000008', 'image', '/assets/promo/op8-itpark-rooftop-nightlife.jpg', 'uploaded', TIMESTAMP '2026-07-28 09:30:00'),
    ('c0000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'video', '/assets/promo/op9-carbon-market-streetfood.mp4', 'processed', TIMESTAMP '2026-07-28 09:30:00');
