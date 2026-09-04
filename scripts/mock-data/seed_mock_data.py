"""
Seed the local CeView Postgres with synthetic MSME businesses across every table.

This fills the relational tables only.  Embeddings are generated separately by
generate_embeddings.py, which must run inside the ceview-fastapi container where
the E5 model lives.

Idempotent: every insert is ON CONFLICT DO NOTHING against a deterministic
uuid5 primary key, so re-running adds nothing and changes nothing.

Usage (from repo root, with the Docker stack up):

    python scripts/mock-data/seed_mock_data.py --count 120
    python scripts/mock-data/seed_mock_data.py --count 120 --purge   # remove first
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from corpus import CATEGORIES, CATEGORY_COLUMNS, SEED, build_corpus  # noqa: E402

# Docker maps postgres to host port 5433 (backend/docker-compose.yml).
DEFAULT_DSN = os.environ.get(
    "CEVIEW_MOCK_DSN", "postgresql://ceview:ceview@localhost:5433/ceview"
)

# All mock rows derive their UUIDs from this namespace, so they can never
# collide with the fixed-literal UUIDs used by the V2/V15/V18 seed migrations
# and can be identified for purging.
NS = uuid.UUID("6d0c5e2a-1f47-4b8e-9a3d-0c7b5e91f204")

# BCrypt hash of "MoalboalDive2024!" -- lifted verbatim from V2 so every mock
# operator shares one known-good password without needing a bcrypt dependency.
SHARED_PASSWORD = "MoalboalDive2024!"
SHARED_HASH = "$2a$10$UV3Ch0mUwjcRCiO.Y.05buhVpOxxLi2FXi/Q9qJdYpxff6Yuokbtm"

ANCHOR = datetime(2026, 8, 31, 8, 0, tzinfo=timezone(timedelta(hours=8)))

PLATFORMS = ["Instagram", "TikTok", "Facebook"]
MARKET_LABEL = {"korea": "South Korea", "japan": "Japan", "usa": "United States"}


def mid(kind: str, *parts) -> uuid.UUID:
    """Deterministic UUID for a mock row."""
    return uuid.uuid5(NS, kind + ":" + ":".join(str(p) for p in parts))


def clamp01(v: float) -> float:
    return max(0.0, min(1.0, v))


def rnd(v: float, p: int) -> float:
    f = 10 ** p
    return math.floor(v * f + 0.5) / f


def compute_kpis(imp: int, clicks: int, spend: float, revenue: float,
                 bookings: int, new_customers: int) -> dict:
    """Mirror MetricsCalculationService.compute() exactly, including rounding."""
    ctr = 0.0 if clicks == 0 else clicks / imp * 100.0
    cpc = 0.0 if clicks == 0 else spend / clicks
    conv_rate = 0.0 if clicks == 0 else bookings / clicks * 100.0
    roas = 0.0 if spend == 0 else revenue / spend
    cac = 0.0 if new_customers == 0 else spend / new_customers
    return {
        "ctr": rnd(ctr, 1),
        "cpc": rnd(cpc, 2),
        "roas": rnd(roas, 1),
        "conv_rate": rnd(conv_rate, 1),
        "cac": rnd(cac, 2),
    }


def compute_pes(k: dict) -> tuple[float, str]:
    """Mirror PESComputationService.compute() -- weights and bounds verbatim."""
    roas_n = clamp01(k["roas"] / 8.0)
    cr_n = clamp01(k["conv_rate"] / 15.0)
    cac_n = 1.0 - clamp01((k["cac"] - 1.0) / (5000.0 - 1.0))
    ctr_n = clamp01(k["ctr"] / 10.0)
    cpc_n = 1.0 - clamp01((k["cpc"] - 0.01) / (500.0 - 0.01))

    total = roas_n * 0.35 + cr_n * 0.30 + cac_n * 0.15 + ctr_n * 0.15 + cpc_n * 0.05
    total = rnd(total, 2)

    if total >= 0.80:
        label = "Excellent Performance"
    elif total >= 0.60:
        label = "Good Performance"
    elif total >= 0.40:
        label = "Fair Performance"
    else:
        label = "Poor Performance"
    return total, label


# ---------------------------------------------------------------------------
# Row builders -- one function per table, each returning (sql, rows)
# ---------------------------------------------------------------------------

def build_all(corpus: list[dict]) -> list[tuple[str, str, list[tuple]]]:
    """Return [(label, sql, rows), ...] in FK-safe insertion order."""
    operators, profiles, cat_scores, clf_logs = [], [], [], []
    msr, forecasts, mkt_scores, alerts, weekly = [], [], [], [], []
    content, content_logs, creative, creative_logs, assets = [], [], [], [], []
    campaigns, legacy_data, legacy_metrics, legacy_reports = [], [], [], []

    for b in corpus:
        i = b["index"]
        r = random.Random(SEED + i * 104729)
        op_id = mid("operator", i)
        bp_id = mid("profile", i)
        market = b["target_market"]
        created = ANCHOR - timedelta(days=r.randint(120, 900))

        # -- auth + profile --------------------------------------------------
        operators.append((
            str(op_id), b["first_name"], b["last_name"], b["email"],
            SHARED_HASH, b["contact_number"], created, None,
        ))

        uniqueness = round(r.uniform(38.0, 92.0), 1)
        profiles.append((
            str(bp_id), str(op_id), b["business_name"], b["description"], b["uvp"],
            ",".join(b["core_services"]), b["image_url"], ",".join(b["categories"]),
            b["confidence_score"], uniqueness, created, ANCHOR - timedelta(days=r.randint(1, 60)),
        ))

        scores = b["category_scores"]
        cat_scores.append(
            (str(mid("catscore", i)), str(bp_id))
            + tuple(scores[c] for c in CATEGORIES)
        )

        for j in range(2):
            clf_logs.append((
                str(mid("clflog", i, j)), str(bp_id), "SUCCESS",
                b["confidence_score"], created + timedelta(days=j * 3), None,
            ))

        # -- module 2: 12 weeks of signals -----------------------------------
        base_trend = r.uniform(35.0, 70.0)
        drift = {"up": 1.6, "flat": 0.0, "down": -1.4}[b["trend"]]
        series: list[float] = []
        for w in range(12):
            val = base_trend + drift * w + r.uniform(-4.0, 4.0)
            series.append(max(1.0, min(100.0, val)))

        forex = {"korea": 0.0416, "japan": 0.3721, "usa": 56.84}[market]
        gdp = {"korea": 2.1, "japan": 1.2, "usa": 2.6}[market]

        for w in range(12):
            when = ANCHOR - timedelta(weeks=(11 - w))
            window7 = series[max(0, w - 1): w + 1]
            window30 = series[max(0, w - 4): w + 1]
            avg7 = sum(window7) / len(window7)
            avg30 = sum(window30) / len(window30)
            std = (sum((x - avg30) ** 2 for x in window30) / len(window30)) ** 0.5
            spike = series[w] > avg30 + 1.5 * std and std > 0.5
            msr.append((
                str(mid("msr", i, w)), str(bp_id), market,
                round(series[w], 2), forex * r.uniform(0.97, 1.03),
                gdp, round(r.uniform(0.3, 0.95), 3), round(avg7, 2), spike, when,
                round(std, 3), round(avg7, 2), round(avg30, 2),
                round(series[w] / max(series[0], 1.0), 3),
                b["categories"][0], "pytrends", when,
            ))

        fc_id = mid("forecast", i)
        predicted = round(series[-1] * r.uniform(1.02, 1.35), 2)
        forecasts.append((
            str(fc_id), str(bp_id), market, predicted,
            round(r.uniform(0.70, 0.95), 3), round(r.uniform(4.0, 14.0), 2), ANCHOR,
            round(r.uniform(2.0, 8.0), 2), round(r.uniform(3.0, 11.0), 2), 12,
            json.dumps([round(predicted * (1 + drift * 0.01 * x + r.uniform(-0.05, 0.05)), 2)
                        for x in range(12)]),
            b["categories"][0], round(series[-1] / max(series[0], 1.0), 3),
        ))

        ms_id = mid("mktscore", i)
        m_score = round(min(100.0, max(1.0, series[-1] * r.uniform(0.9, 1.25))), 2)
        mkt_scores.append((
            str(ms_id), str(fc_id), m_score, round(r.uniform(0.3, 0.95), 3),
            b["trend"] == "up", ANCHOR, gdp, forex, r.randint(12000, 480000),
            r.randint(1, 3), round(series[-1] / max(series[0], 1.0), 3),
        ))

        if b["trend"] == "up" or r.random() < 0.35:
            level = "CRITICAL" if m_score > 70 else "WARNING"
            alerts.append((
                str(mid("alert", i)), str(ms_id), level,
                f"{MARKET_LABEL[market]} demand for {b['categories'][0]} is trending "
                f"{b['trend']} at index {m_score}. Prepare {MARKET_LABEL[market]}-localized "
                f"content for {b['business_name']} ahead of the booking window.",
                ANCHOR, ANCHOR + timedelta(days=r.randint(7, 35)),
                r.random() < 0.4, b["trend"],
            ))

        for w in range(4):
            when = ANCHOR - timedelta(weeks=(3 - w))
            weekly.append((
                str(mid("weekly", i, w)), when, str(bp_id), market,
                *[round(scores[c], 2) for c in CATEGORIES],
                r.choice(["ICN-CEB direct", "NRT-CEB via MNL", "LAX-CEB via ICN",
                          "KIX-CEB direct", "SFO-CEB via NRT"]),
                m_score,
                r.choice(["Push localized reels", "Bundle island transfers",
                          "Run early-bird discount", "Partner with inbound agency"]),
                round(forex, 4), gdp, r.randint(1, 12),
                "Sustained spike" if b["trend"] == "up" else "No significant spike",
                r.choice(["Refresh menu translations", "Confirm guide availability",
                          "Stock inventory for peak", "Update booking calendar"]),
                r.choice(["Peak season approaching", "Shoulder season",
                          "Off-peak trough", "Holiday surge window"]),
            ))

        # -- module 3 --------------------------------------------------------
        for j, platform in enumerate(PLATFORMS):
            approved = r.random() < 0.6
            content.append((
                str(mid("content", i, j)), str(bp_id), market, platform,
                f"Discover {b['business_name']} in {b['town']}. "
                f"{b['uvp'].split(',')[0]}. Book your {MARKET_LABEL[market]} "
                f"traveller experience this season.",
                f"Lead with the {b['categories'][0].lower()} hook, keep the pacing quick, "
                f"and close on a booking call-to-action tuned for {MARKET_LABEL[market]} audiences.",
                approved, ANCHOR - timedelta(days=r.randint(1, 45)),
                " ".join(f"#{t}" for t in ["Cebu", b["town"].replace(" ", ""),
                                           "TravelPH", platform]),
                r.choice(["Book now", "Reserve your slot", "Message us to book",
                          "Limited slots this week"]),
                r.choice(["Warm and conversational", "Aspirational and cinematic",
                          "Direct and practical", "Playful and energetic"]),
                "AIDA", "groq",
                (ANCHOR - timedelta(days=r.randint(0, 20))) if approved else None,
            ))

        for j in range(2):
            content_logs.append((
                str(mid("contentlog", i, j)), str(bp_id), "SUCCESS",
                json.dumps({"model": "groq/llama-3.3-70b", "latency_ms": r.randint(600, 3200),
                            "tokens": r.randint(220, 900), "market": market}),
                ANCHOR - timedelta(days=r.randint(1, 50)),
            ))
            creative_logs.append((
                str(mid("creativelog", i, j)), str(bp_id), "SUCCESS",
                json.dumps({"model": "groq/llama-3.3-70b", "latency_ms": r.randint(700, 3600),
                            "shots": r.randint(3, 8), "market": market}),
                ANCHOR - timedelta(days=r.randint(1, 50)),
            ))

        for j in range(2):
            approved = r.random() < 0.5
            creative.append((
                str(mid("creative", i, j)), str(bp_id), market,
                f"Open on a wide establishing shot of {b['town']}; cut to three detail shots of "
                f"{b['core_services'][0].lower()}; close on a guest reaction and the logo card.",
                f"Natural saturated colour, no heavy filters, framing that keeps {b['town']} "
                f"recognisable in at least two shots.",
                r.choice(["Golden hour, backlit", "Overcast diffused daylight",
                          "Blue hour with practical lights", "Harsh midday, embraced"]),
                f"Reference boards drawn from {MARKET_LABEL[market]} travel editorial and "
                f"regional tourism campaigns.",
                approved, ANCHOR - timedelta(days=r.randint(1, 45)),
                f"Prioritise {PLATFORMS[j % len(PLATFORMS)]} vertical, then repurpose to the rest.",
                r.choice(["Bright and airy", "Moody and cinematic",
                          "Documentary realism", "Saturated and playful"]),
                (ANCHOR - timedelta(days=r.randint(0, 20))) if approved else None,
            ))

        for j in range(3):
            kind = "video" if j == 0 else "image"
            assets.append((
                str(mid("asset", i, j)), str(bp_id), kind,
                f"/assets/mock/{b['index']:03d}/{kind}-{j}.{'mp4' if kind == 'video' else 'jpg'}",
                r.choice(["processed", "uploaded"]),
                ANCHOR - timedelta(days=r.randint(1, 60)),
            ))

        # -- module 4: 8 weeks of campaign records ---------------------------
        perf = r.uniform(0.35, 1.0)
        for w in range(8):
            step = {"up": 1 + 0.05 * w, "flat": 1.0, "down": 1 - 0.04 * w}[b["trend"]]
            imp = int(r.randint(40_000, 420_000) * step)
            ctr_target = r.uniform(1.1, 6.5) * perf
            clicks = max(1, int(imp * ctr_target / 100.0))
            spend = round(clicks * r.uniform(6.0, 28.0), 2)
            bookings = max(1, int(clicks * r.uniform(1.5, 11.0) / 100.0))
            conversions = bookings + r.randint(0, max(1, bookings // 2))
            new_customers = max(1, int(bookings * r.uniform(0.45, 0.9)))
            revenue = round(spend * r.uniform(1.4, 7.2) * perf, 2)

            k = compute_kpis(imp, clicks, spend, revenue, bookings, new_customers)
            pes, label = compute_pes(k)
            end = ANCHOR - timedelta(weeks=(7 - w))
            start = end - timedelta(days=27)
            campaigns.append((
                str(mid("campaign", i, w)), imp, clicks, spend, revenue, conversions,
                bookings, new_customers, k["ctr"], k["cpc"], k["conv_rate"], k["roas"],
                k["cac"], pes, label, 4,
                start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"),
                end, end, str(bp_id),
            ))

            # Legacy module-4 tables kept populated for completeness.
            if w < 2:
                cd_id = mid("legacydata", i, w)
                cm_id = mid("legacymetrics", i, w)
                legacy_data.append((
                    str(cd_id), str(bp_id), imp, clicks, spend, conversions, bookings,
                    revenue, new_customers, start.date(), end.date(), "mock",
                ))
                legacy_metrics.append((
                    str(cm_id), str(cd_id), k["ctr"], k["cpc"], k["conv_rate"],
                    k["roas"], k["cac"], pes, end,
                ))
                lowest = min(
                    [("ROAS", k["roas"] / 8.0), ("Conversion Rate", k["conv_rate"] / 15.0),
                     ("CTR", k["ctr"] / 10.0)], key=lambda t: t[1],
                )[0]
                legacy_reports.append((
                    str(mid("legacyreport", i, w)), str(cm_id),
                    f"{b['business_name']} scored {pes} ({label}) over the {start:%b %d} to "
                    f"{end:%b %d} window on the {MARKET_LABEL[market]} market.",
                    lowest,
                    f"{lowest} is the weakest contributor to the promotional effectiveness score "
                    f"for this period.",
                    f"Reallocate spend toward the {PLATFORMS[w % len(PLATFORMS)]} placement, tighten "
                    f"the {MARKET_LABEL[market]} audience segment, and re-test the call-to-action.",
                    "Creative refresh cadence; landing page load time; booking form drop-off.",
                    end,
                ))

    return [
        ("tbl_msme_operator", """
            INSERT INTO tbl_msme_operator
              (operator_id, first_name, last_name, email, password_hash,
               contact_number, created_at, google_uid)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (operator_id) DO NOTHING""", operators),

        ("tbl_business_profile", """
            INSERT INTO tbl_business_profile
              (business_profile_id, user_id, business_name, business_description, uvp,
               core_services, image_url, categories, confidence_score, uniqueness_score,
               created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (business_profile_id) DO NOTHING""", profiles),

        ("tbl_business_categories_score", f"""
            INSERT INTO tbl_business_categories_score
              (categories_score_id, business_profile_id, {", ".join(CATEGORY_COLUMNS)})
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (categories_score_id) DO NOTHING""", cat_scores),

        ("tbl_classification_logs", """
            INSERT INTO tbl_classification_logs
              (log_id, business_profile_id, inference_status, confidence_score,
               execution_time, error_message)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (log_id) DO NOTHING""", clf_logs),

        ("tbl_market_signal_record", """
            INSERT INTO tbl_market_signal_record
              (signal_record_id, business_profile_id, target_market, trend_index, forex_rate,
               gdp_growth, seasonality_score, rolling_average, spike_indicator, aggregated_at,
               rolling_std_dev, rolling_average_7d, rolling_average_30d, yoy_ratio,
               category, source, source_fetched_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (signal_record_id) DO NOTHING""", msr),

        ("tbl_forecast_result", """
            INSERT INTO tbl_forecast_result
              (forecast_result_id, business_profile_id, target_market, predicted_demand,
               forecast_confidence, mape_score, generated_at, mae, rmse,
               forecast_horizon_weeks, weekly_forecasts_json, category, yoy_ratio)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (forecast_result_id) DO NOTHING""", forecasts),

        ("tbl_market_score", """
            INSERT INTO tbl_market_score
              (market_score_id, forecast_result_id, market_score, seasonality_score,
               spike_indicator, evaluated_at, gdp_per_capita_growth, forex_vs_php,
               historical_arrivals, market_rank, yoy_ratio)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (market_score_id) DO NOTHING""", mkt_scores),

        ("tbl_demand_alert", """
            INSERT INTO tbl_demand_alert
              (demand_alert_id, market_score_id, alert_level, alert_message, alert_date,
               window_open_date, is_read, trend)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (demand_alert_id) DO NOTHING""", alerts),

        ("tbl_orig_weekly_demand_value", """
            INSERT INTO tbl_orig_weekly_demand_value
              (demand_value_id, week, business_profile_id, target_market,
               beach_category, adventure, cultural, theme_parks, urban, culinary,
               accommodation, connecting_flights, market_score, strategy, forex, gdp,
               market_rank, spike_meaning, current_checklist, seasonality_meaning)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (demand_value_id) DO NOTHING""", weekly),

        ("tbl_localized_promotional_content", """
            INSERT INTO tbl_localized_promotional_content
              (content_id, business_profile_id, selected_market, platform, generated_caption,
               content_direction, approval_status, generated_at, hashtags, cta,
               tone_suggestion, framework, source, approved_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (content_id) DO NOTHING""", content),

        ("tbl_content_generation_log", """
            INSERT INTO tbl_content_generation_log
              (content_log_id, business_profile_id, generation_status, diagnostics, logged_at)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (content_log_id) DO NOTHING""", content_logs),

        ("tbl_creative_direction_output", """
            INSERT INTO tbl_creative_direction_output
              (creative_direction_id, business_profile_id, selected_market,
               shot_list_recommendations, visual_recommendations, lighting_suggestions,
               moodboard_references, approval_status, generated_at,
               platform_recommendations, visual_tone, approved_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (creative_direction_id) DO NOTHING""", creative),

        ("tbl_creative_direction_log", """
            INSERT INTO tbl_creative_direction_log
              (creative_log_id, business_profile_id, generation_status, diagnostics, logged_at)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (creative_log_id) DO NOTHING""", creative_logs),

        ("tbl_promotional_asset", """
            INSERT INTO tbl_promotional_asset
              (asset_id, business_profile_id, asset_type, asset_path, upload_status, uploaded_at)
            VALUES (%s,%s,%s,%s,%s,%s)
            ON CONFLICT (asset_id) DO NOTHING""", assets),

        ("tbl_campaign_records", """
            INSERT INTO tbl_campaign_records
              (campaign_id, impressions, clicks, ad_spend, revenue, conversions, bookings,
               new_customers, ctr, cpc, conv_rate, roas, cac, pes_score, pes_label,
               analysis_weeks, period_start, period_end, created_at, updated_at,
               business_profile_id)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (campaign_id) DO NOTHING""", campaigns),

        ("campaign_data", """
            INSERT INTO campaign_data
              (id, business_profile_id, impressions, clicks, ad_spend, conversions,
               bookings, revenue, new_customers, period_start, period_end, source)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO NOTHING""", legacy_data),

        ("campaign_metrics", """
            INSERT INTO campaign_metrics
              (id, campaign_data_id, ctr, cpc, conversion_rate, roas, cac, pes_score, computed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO NOTHING""", legacy_metrics),

        ("prescriptive_reports", """
            INSERT INTO prescriptive_reports
              (id, campaign_metrics_id, executive_summary, lowest_metric, lowest_metric_meaning,
               recommendations, other_areas_improve, generated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (id) DO NOTHING""", legacy_reports),
    ]


def build_global_rows() -> list[tuple[str, str, list[tuple]]]:
    """Tables that are not per-business: job logs and trend fetch jobs."""
    r = random.Random(SEED)
    jobs, ingest = [], []

    for c_idx, category in enumerate(CATEGORIES):
        for m_idx, market in enumerate(["korea", "japan", "usa"]):
            for w in range(4):
                week_dt = ANCHOR - timedelta(weeks=(3 - w))
                iso_year, iso_week, _ = week_dt.isocalendar()
                week_of = f"{iso_year}-W{iso_week:02d}"
                trend = round(r.uniform(20.0, 90.0), 2)
                avg30 = trend * r.uniform(0.85, 1.1)
                std = round(r.uniform(1.5, 9.0), 3)
                jobs.append((
                    str(mid("trendjob", c_idx, m_idx, w)), category, market, "SUCCESS",
                    week_of, r.randint(1, 3), 3, week_dt, week_dt, trend,
                    round(trend * r.uniform(0.95, 1.05), 2), round(avg30, 2), std,
                    trend > avg30 + 1.5 * std, round(r.uniform(0.85, 1.35), 3),
                    round(r.uniform(0.3, 0.95), 3), r.randint(60, 260), "pytrends", None,
                ))

    for j in range(24):
        started = ANCHOR - timedelta(days=j)
        ok = j % 8 != 0
        ingest.append((
            str(mid("ingestlog", j)),
            r.choice(["weekly-trend-ingest", "economic-trend-refresh", "forecast-rebuild"]),
            "SUCCESS" if ok else "FAILED",
            3, r.randint(40, 260) if ok else 0,
            None if ok else "pytrends rate limit (429) after 3 retries",
            started, started + timedelta(minutes=r.randint(2, 25)),
        ))

    return [
        ("tbl_trend_fetch_job", """
            INSERT INTO tbl_trend_fetch_job
              (job_id, category, market, status, week_of, attempt_count, max_attempts,
               last_attempted_at, completed_at, trend_index, rolling_7d_avg, rolling_30d_avg,
               rolling_7d_std, spike_indicator, yoy_ratio, seasonality_score, data_points,
               source, last_error)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (category, market, week_of) DO NOTHING""", jobs),

        ("tbl_ingestion_job_log", """
            INSERT INTO tbl_ingestion_job_log
              (job_log_id, job_name, status, markets_processed, records_ingested,
               error_message, started_at, completed_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (job_log_id) DO NOTHING""", ingest),
    ]


def purge(cur, count: int) -> None:
    """Delete every mock row. FK cascades handle the children of a profile."""
    op_ids = [str(mid("operator", i)) for i in range(count)]
    cur.execute("DELETE FROM tbl_msme_operator WHERE operator_id = ANY(%s::uuid[])", (op_ids,))
    deleted = cur.rowcount
    # Profiles cascade from operators; these two are not FK-linked to a profile.
    job_ids = [str(mid("trendjob", c, m, w))
               for c in range(len(CATEGORIES)) for m in range(3) for w in range(4)]
    cur.execute("DELETE FROM tbl_trend_fetch_job WHERE job_id = ANY(%s::uuid[])", (job_ids,))
    cur.execute("DELETE FROM tbl_ingestion_job_log WHERE job_log_id = ANY(%s::uuid[])",
                ([str(mid("ingestlog", j)) for j in range(24)],))
    print(f"  purged {deleted} operators (profiles and children cascaded)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--count", type=int, default=120, help="number of businesses (default 120)")
    ap.add_argument("--dsn", default=DEFAULT_DSN, help="postgres DSN")
    ap.add_argument("--purge", action="store_true", help="delete existing mock rows first")
    args = ap.parse_args()

    try:
        import psycopg2
        from psycopg2.extras import execute_batch
    except ImportError:
        print("psycopg2 is required:  pip install psycopg2-binary", file=sys.stderr)
        return 1

    corpus = build_corpus(args.count)
    batches = build_all(corpus) + build_global_rows()

    print(f"Connecting to {args.dsn.rsplit('@', 1)[-1]} ...")
    conn = psycopg2.connect(args.dsn)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            if args.purge:
                print("Purging existing mock rows ...")
                purge(cur, max(args.count, 500))

            total = 0
            for label, sql, rows in batches:
                if not rows:
                    print(f"  {label:<34} 0 rows (skipped)")
                    continue
                execute_batch(cur, sql, rows, page_size=200)
                total += len(rows)
                print(f"  {label:<34} {len(rows):>6} rows")
        conn.commit()
        print(f"\nCommitted {total} rows for {len(corpus)} businesses.")
        print(f"All mock operators share the password: {SHARED_PASSWORD}")
        print("\nNext: generate embeddings so uniqueness scoring has a real corpus:")
        print("  docker exec ceview-fastapi python /tmp/generate_embeddings.py")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
