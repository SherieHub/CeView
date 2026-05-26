"""Google Trends data fetcher and SeasonalShift math engine — Module 2.1 (FR2.2).

Public API:
    fetch_and_process(market: str, category: str) -> dict

Pipeline per request:
    1. Resolve localized keywords from MACRO_TREND_MAPPING
       (native Hangul for KR, Kanji/Kana for JP — English proxies return near-zero
       volume for Asian markets and must NOT be used there)
    2. Initialize pytrends with market-specific geo/hl/tz from MARKET_CONFIG
    3. Fetch "today 5-y" (~260 weekly data points)
    4. Apply randomized jitter sleep after EVERY fetch (4–12 s) to mimic human
       browsing cadence and prevent HTTP 429 from Google Trends
    5. Delegate the full SeasonalShift computation to seasonal_shift_detector.compute()
       — rolling 7d/30d averages, population std-dev, spike indicator (mean+2σ),
         YoY ratio, and composite seasonality score
    6. Return structured dict matching TrendsFetchResponse schema

Fallback:
    When pytrends is unavailable (ImportError) or any request fails, a
    deterministic stub result is returned so the endpoint always responds
    without raising.  source="stub" signals callers to treat the data as
    a placeholder until a live fetch succeeds.
"""
from __future__ import annotations

import hashlib
import logging
import random
import time
from datetime import datetime, timezone

from app.config.keyword_mapping import MACRO_TREND_MAPPING, MARKET_CONFIG
from app.services.seasonal_shift_detector import compute as seasonal_compute

logger = logging.getLogger(__name__)

# ── Optional pytrends import (fail-safe) ─────────────────────────────────────
_TrendReq = None

try:
    from pytrends.request import TrendReq as _TrendReqClass
    _TrendReq = _TrendReqClass
    logger.info("pytrends loaded successfully")
except Exception as _exc:  # noqa: BLE001
    logger.warning(
        "pytrends unavailable — trend_service will return deterministic stub values: %s",
        _exc,
    )

# ── Constants ─────────────────────────────────────────────────────────────────

JITTER_MIN_S:    float      = 4.0    # minimum sleep per fetch (rate-limit mitigation)
JITTER_MAX_S:    float      = 12.0   # maximum sleep per fetch
TIMEFRAME:       str        = "today 5-y"   # ~260 weekly points; satisfies 52w YoY requirement
REQUEST_TIMEOUT: tuple      = (10, 30)      # (connect_s, read_s) for pytrends TrendReq

# Deterministic base indices per market used when pytrends is unavailable
_STUB_BASE: dict[str, float] = {
    "korea": 72.0,
    "japan": 58.0,
    "usa":   44.0,
}


# ─── Public API ───────────────────────────────────────────────────────────────

def fetch_and_process(market: str, category: str) -> dict:
    """Fetch Google Trends data for one (market, category) pair and run SeasonalShift math.

    Args:
        market:   "korea" | "japan" | "usa"
        category: Must match a key in MACRO_TREND_MAPPING / CATEGORY_LABELS in ml_classifier.py

    Rate-limit mitigation (jitter):
        After every single pytrends payload request the thread sleeps for a
        uniformly random interval in [JITTER_MIN_S, JITTER_MAX_S] seconds.
        This mimics human browsing cadence.  Callers should expect 4–12 s of
        natural latency per request — this is intentional and expected.

    SeasonalShift pipeline (CeView_SeasonalShift_Detection.md):
        Step 1 — 7d and 30d rolling averages (§2)
        Step 2 — Rolling population std-dev + spike indicator: current > μ + 2σ  (§3)
        Step 3 — Year-over-Year ratio: rolling_7d(t) / rolling_7d(t-52w)          (§4)
        Step 4 — Composite seasonality score (0–1)                                 (§5)

    Returns:
        {
          market, category, keywords_used,
          trend_index,       rolling_7d_avg,  rolling_30d_avg,  rolling_7d_std,
          spike_indicator,   yoy_ratio,        seasonality_score,
          data_points,       fetched_at,       source
        }

    Raises:
        ValueError: if market is not in MARKET_CONFIG
    """
    market_key = market.strip().lower()
    config     = MARKET_CONFIG.get(market_key)
    if config is None:
        raise ValueError(
            f"Unknown market '{market}'. Valid values: {list(MARKET_CONFIG.keys())}"
        )

    geo_code   = config["geo"]    # "KR" | "JP" | "US"
    hl         = config["hl"]
    tz_offset  = config["tz"]

    # ── 1. Resolve localized keywords ─────────────────────────────────────────
    cat_map  = MACRO_TREND_MAPPING.get(category, {})
    keywords = cat_map.get(geo_code, [])

    if not keywords:
        logger.warning(
            "No keyword mapping for category='%s' geo='%s' — using generic fallback",
            category, geo_code,
        )
        keywords = _generic_keywords(market_key)

    # ── 2. Early-exit when pytrends unavailable ───────────────────────────────
    if _TrendReq is None:
        logger.warning(
            "pytrends not installed — returning stub for market=%s category=%s",
            market_key, category,
        )
        return _stub_result(market_key, category, keywords)

    # ── 3. Fetch from Google Trends ───────────────────────────────────────────
    try:
        pt = _TrendReq(hl=hl, tz=tz_offset, timeout=REQUEST_TIMEOUT)
        pt.build_payload(
            kw_list   = keywords[:5],   # Google Trends max: 5 keywords per request
            timeframe = TIMEFRAME,
            geo       = geo_code,
        )

        # ── Jitter sleep: MUST run after build_payload/before reading result ──
        # This is the primary HTTP 429 mitigation.  Do not remove or shorten.
        _jitter_sleep()

        df = pt.interest_over_time()

        if df is None or df.empty:
            logger.warning(
                "pytrends returned empty DataFrame — stub fallback. market=%s category=%s",
                market_key, category,
            )
            return _stub_result(market_key, category, keywords)

        # Drop the pytrends meta-column "isPartial" if present
        if "isPartial" in df.columns:
            df = df.drop(columns=["isPartial"])

        # ── 4. Extract weekly series from the primary keyword column ──────────
        primary_kw = keywords[0] if keywords[0] in df.columns else df.columns[0]
        series: list[float] = df[primary_kw].astype(float).tolist()

        if not series:
            return _stub_result(market_key, category, keywords)

        trend_index = float(series[-1])

        # ── 5. SeasonalShift computation via seasonal_shift_detector ──────────
        # Delegates to the canonical pipeline implementation in seasonal_shift_detector.py
        # (rolling averages §2, std+spike §3, YoY §4, seasonality score §5)
        shift = seasonal_compute(series)

        logger.info(
            "trend_service fetched ok — market=%s category=%s geo=%s "
            "points=%d trend_index=%.1f spike=%s yoy=%s seasonality=%.3f",
            market_key, category, geo_code,
            len(series), trend_index,
            shift["spike_indicator"],
            f"{shift['yoy_ratio']:.3f}" if shift["yoy_ratio"] is not None else "n/a",
            shift["seasonality_score"],
        )

        return {
            "market":            market_key,
            "category":          category,
            "keywords_used":     list(keywords[:5]),
            "trend_index":       round(max(0.0, min(100.0, trend_index)), 2),
            "rolling_7d_avg":    shift["rolling_7d_avg"],
            "rolling_30d_avg":   shift["rolling_30d_avg"],
            "rolling_7d_std":    shift["rolling_7d_std"],
            "spike_indicator":   shift["spike_indicator"],
            "yoy_ratio":         shift["yoy_ratio"],
            "seasonality_score": shift["seasonality_score"],
            "data_points":       len(series),
            "fetched_at":        datetime.now(timezone.utc).isoformat(),
            "source":            "pytrends",
        }

    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "pytrends request failed — stub fallback. market=%s category=%s error=%s",
            market_key, category, exc,
        )
        return _stub_result(market_key, category, keywords)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _jitter_sleep() -> None:
    """Sleep for a random interval [JITTER_MIN_S, JITTER_MAX_S] seconds.

    This is the ONLY rate-limit mitigation against Google Trends HTTP 429.
    It must be called after EVERY single pytrends build_payload() call.
    Do not batch multiple categories in one payload — keep requests isolated
    so the jitter strategy applies uniformly per (market, category) pair.
    """
    delay = random.uniform(JITTER_MIN_S, JITTER_MAX_S)
    logger.debug("jitter sleep: %.1f s (rate-limit mitigation)", delay)
    time.sleep(delay)


def _generic_keywords(market_key: str) -> list[str]:
    """Generic fallback keywords when a category has no mapping for a geo."""
    defaults: dict[str, list[str]] = {
        "korea": ["세부 여행", "필리핀 관광"],
        "japan": ["セブ島", "フィリピン旅行"],
        "usa":   ["Cebu Philippines", "Cebu travel"],
    }
    return defaults.get(market_key, ["Cebu Philippines travel"])


def _stub_result(market: str, category: str, keywords: list[str]) -> dict:
    """Return a deterministic stub when pytrends is unavailable or a request fails.

    Uses a seeded pseudo-random series of 60 weekly points derived from the
    (market, category) hash so results are consistent across restarts while
    still exercising the full SeasonalShift math pipeline.
    """
    seed_val   = int(hashlib.md5(f"{market}:{category}".encode()).digest()[0])
    jitter_val = (seed_val % 20) - 10       # ±10 deterministic jitter
    base       = _STUB_BASE.get(market, 50.0)
    trend_idx  = round(max(0.0, min(100.0, base + jitter_val)), 2)

    # Build a plausible 60-week series so SeasonalShift math runs on real-ish data
    rng         = random.Random(seed_val)
    stub_series = [max(0.0, min(100.0, trend_idx + rng.uniform(-8.0, 8.0)))
                   for _ in range(60)]
    stub_series[-1] = trend_idx   # pin the current week to the deterministic stub index
    shift = seasonal_compute(stub_series)

    return {
        "market":            market,
        "category":          category,
        "keywords_used":     list(keywords[:5]),
        "trend_index":       trend_idx,
        "rolling_7d_avg":    shift["rolling_7d_avg"],
        "rolling_30d_avg":   shift["rolling_30d_avg"],
        "rolling_7d_std":    shift["rolling_7d_std"],
        "spike_indicator":   shift["spike_indicator"],
        "yoy_ratio":         shift["yoy_ratio"],
        "seasonality_score": shift["seasonality_score"],
        "data_points":       len(stub_series),
        "fetched_at":        datetime.now(timezone.utc).isoformat(),
        "source":            "stub",
    }
