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

Unavailability:
    When pytrends is not installed or any request fails, this module raises
    ``DependencyUnavailable`` (HTTP 503) carrying the upstream reason. There is
    no synthetic fallback — a fabricated trend series is indistinguishable from
    a measured one once it reaches a forecast. See
    docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md §1.
"""
from __future__ import annotations

import logging
import random
import time
from datetime import datetime, timezone
from typing import NoReturn

from app.config.keyword_mapping import MACRO_TREND_MAPPING, MARKET_CONFIG
from app.services.seasonal_shift_detector import compute as seasonal_compute
from app.unavailable import DependencyUnavailable

logger = logging.getLogger(__name__)

# ── pytrends import (reason retained, not swallowed) ─────────────────────────
_TrendReq = None
_IMPORT_ERROR: str | None = None

try:
    from pytrends.request import TrendReq as _TrendReqClass
    _TrendReq = _TrendReqClass
    logger.info("pytrends loaded successfully")
except Exception as _exc:  # noqa: BLE001
    # Recording the reason, not just the fact, is the whole point: it surfaces
    # to the developer as the `cause` of a 503 rather than a bare
    # "trends unavailable".
    _IMPORT_ERROR = str(_exc)
    logger.warning("pytrends unavailable — trend fetches will fail loudly: %s", _exc)

# ── Constants ─────────────────────────────────────────────────────────────────

JITTER_MIN_S:    float      = 4.0    # minimum sleep per fetch (rate-limit mitigation)
JITTER_MAX_S:    float      = 12.0   # maximum sleep per fetch
TIMEFRAME:       str        = "today 5-y"   # ~260 weekly points; satisfies 52w YoY requirement
REQUEST_TIMEOUT: tuple      = (10, 30)      # (connect_s, read_s) for pytrends TrendReq


def _trends_unavailable(cause: str) -> NoReturn:
    """Raise the one structured 503 for every trend-fetch failure path."""
    raise DependencyUnavailable(
        code="MOD21_TRENDS_UNAVAILABLE",
        message="Google Trends data is unavailable.",
        dependency="pytrends",
        cause=cause,
        stage="fastapi-transformer/trend_service",
    )


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
        logger.info(
            "No keyword mapping for category='%s' geo='%s' — using generic query terms",
            category, geo_code,
        )
        keywords = _generic_keywords(market_key)

    # ── 2. Fail loudly when pytrends is unavailable ───────────────────────────
    if _TrendReq is None:
        _trends_unavailable(_IMPORT_ERROR or "pytrends is not installed")

    # ── 3. Fetch from Google Trends ───────────────────────────────────────────
    try:
        pt = _TrendReq(hl=hl, tz=tz_offset, timeout=REQUEST_TIMEOUT)
        pt.build_payload(
            kw_list   = keywords[:5],   # Google Trends max: 5 keywords per request
            timeframe = TIMEFRAME,
            geo       = geo_code,
        )

        df = pt.interest_over_time()

        # ── Jitter sleep: MUST run after the data fetch ──────────────────────
        # This is the primary HTTP 429 mitigation — it spaces out consecutive
        # requests so the NEXT (market, category) fetch starts after a delay.
        # Do not remove or shorten.
        _jitter_sleep()

        if df is None or df.empty:
            _trends_unavailable(
                f"pytrends returned no data for market={market_key} category={category}"
            )

        # Drop the pytrends meta-column "isPartial" if present
        if "isPartial" in df.columns:
            df = df.drop(columns=["isPartial"])

        # ── 4. Extract weekly series from the primary keyword column ──────────
        primary_kw = keywords[0] if keywords[0] in df.columns else df.columns[0]
        series: list[float] = df[primary_kw].astype(float).tolist()

        if not series:
            _trends_unavailable(
                f"pytrends returned an empty series for market={market_key} category={category}"
            )

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

    except DependencyUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "pytrends request failed. market=%s category=%s error=%s",
            market_key, category, exc,
        )
        _trends_unavailable(str(exc))


# ─── Market-data ingestion API (consumed by /internal/market-data router) ──────

def fetch_current_index(market: str, categories: list[str]) -> dict:
    """Fetch the current Google Trends index for a market using localized keywords.

    Replaces the legacy ``pytrends_client.fetch_trends``.  Unlike that version
    this targets the correct per-market geo (KR/JP/US) and resolves native-
    language keywords, so KR/JP indices are no longer near-zero.

    Keyword resolution: the FIRST tagged category drives the localized lookup
    via ``MACRO_TREND_MAPPING[category][geo]``; ``_generic_keywords`` is used
    when the category has no mapping.

    Args:
        market:     "korea" | "japan" | "usa"
        categories: business-profile category labels (first is used for keywords)

    Returns:
        {market, trend_index, keywords_used, fetched_at, source}

    Raises:
        ValueError: if market is not in MARKET_CONFIG
    """
    market_key, config = _resolve_market(market)
    geo_code = config["geo"]
    keywords = _resolve_localized_keywords(market_key, geo_code, categories)

    if _TrendReq is None:
        _trends_unavailable(_IMPORT_ERROR or "pytrends is not installed")

    try:
        pt = _TrendReq(hl=config["hl"], tz=config["tz"], timeout=REQUEST_TIMEOUT)
        pt.build_payload(kw_list=keywords[:5], timeframe="today 3-m", geo=geo_code)
        df = pt.interest_over_time()
        _jitter_sleep()   # space out consecutive requests (HTTP 429 mitigation)

        if df is None or df.empty:
            _trends_unavailable(
                f"pytrends returned no current-index data for market={market_key}"
            )

        if "isPartial" in df.columns:
            df = df.drop(columns=["isPartial"])

        primary_kw  = keywords[0] if keywords[0] in df.columns else df.columns[0]
        trend_index = float(df[primary_kw].tail(4).mean())

        return {
            "market":        market_key,
            "trend_index":   round(max(0.0, min(100.0, trend_index)), 2),
            "keywords_used": list(keywords[:5]),
            "fetched_at":    datetime.now(timezone.utc).isoformat(),
            "source":        "pytrends",
        }

    except DependencyUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Current index fetch failed market=%s error=%s", market_key, exc,
        )
        _trends_unavailable(str(exc))


def fetch_trend_history(market: str, categories: list[str], weeks: int = 12) -> dict:
    """Fetch ``weeks`` of weekly Google Trends history for a market.

    Replaces the legacy ``pytrends_client.fetch_trend_history``.  Used on first
    ingestion to backfill MarketSignalRecord rows so the demand chart shows real
    week-over-week variance.  Same localized-keyword / correct-geo resolution as
    ``fetch_current_index``.

    Args:
        market:     "korea" | "japan" | "usa"
        categories: business-profile category labels (first is used for keywords)
        weeks:      number of trailing weeks to fetch

    Returns:
        {market, weekly_series: [{date, trend_index}], keywords_used, fetched_at, source}

    Raises:
        ValueError: if market is not in MARKET_CONFIG
    """
    market_key, config = _resolve_market(market)
    geo_code = config["geo"]
    keywords = _resolve_localized_keywords(market_key, geo_code, categories)

    if _TrendReq is None:
        _trends_unavailable(_IMPORT_ERROR or "pytrends is not installed")

    try:
        pt = _TrendReq(hl=config["hl"], tz=config["tz"], timeout=REQUEST_TIMEOUT)
        pt.build_payload(kw_list=keywords[:5], timeframe=f"today {weeks}-w", geo=geo_code)
        df = pt.interest_over_time()
        _jitter_sleep()   # space out consecutive requests (HTTP 429 mitigation)

        if df is None or df.empty:
            _trends_unavailable(
                f"pytrends returned no history for market={market_key} weeks={weeks}"
            )

        if "isPartial" in df.columns:
            df = df.drop(columns=["isPartial"])

        primary_kw = keywords[0] if keywords[0] in df.columns else df.columns[0]
        series = [
            {
                "date":        str(idx.date()),
                "trend_index": round(max(0.0, min(100.0, float(val))), 2),
            }
            for idx, val in zip(df.index, df[primary_kw])
        ]

        logger.info(
            "fetch_trend_history ok market=%s geo=%s weeks=%d points=%d",
            market_key, geo_code, weeks, len(series),
        )

        return {
            "market":        market_key,
            "weekly_series": series,
            "keywords_used": list(keywords[:5]),
            "fetched_at":    datetime.now(timezone.utc).isoformat(),
            "source":        "pytrends",
        }

    except DependencyUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "History fetch failed market=%s error=%s", market_key, exc,
        )
        _trends_unavailable(str(exc))


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _resolve_market(market: str) -> tuple[str, dict]:
    """Normalize a market name and return (market_key, config), raising on unknown."""
    market_key = market.strip().lower()
    config     = MARKET_CONFIG.get(market_key)
    if config is None:
        raise ValueError(
            f"Unknown market '{market}'. Valid values: {list(MARKET_CONFIG.keys())}"
        )
    return market_key, config


def _resolve_localized_keywords(
    market_key: str, geo_code: str, categories: list[str]
) -> list[str]:
    """Resolve localized pytrends keywords from the FIRST tagged category.

    Mirrors fetch_and_process's resolution but accepts the category LIST that
    the ingestion pipeline passes.  Uses MACRO_TREND_MAPPING[category][geo] for
    the first category; falls back to generic per-market keywords when absent.
    """
    first_category = categories[0] if categories else ""
    cat_map  = MACRO_TREND_MAPPING.get(first_category, {})
    keywords = cat_map.get(geo_code, [])
    if not keywords:
        logger.info(
            "No keyword mapping for category='%s' geo='%s' — using generic query terms",
            first_category, geo_code,
        )
        keywords = _generic_keywords(market_key)
    return keywords


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


# ─────────────────────────────────────────────────────────────────────────────
# Category volume aggregation — cross-market keyword ranking pipeline
# ─────────────────────────────────────────────────────────────────────────────

def fetch_category_volume(category: str, market: str) -> dict:
    """Fetch and sum search volumes for the 10 fixed CATEGORY_KEYWORDS in one market.

    pytrends limits queries to 5 keywords per request, so the 10 keywords are
    split into two batches.  Within each batch the last 4 weekly values of each
    keyword are averaged, then ALL 10 averages are summed to produce
    ``total_volume``.

    NOTE — within-batch normalization:
        pytrends returns relative interest (0–100) normalized to the highest
        point *within that request*.  Two batches therefore have independent
        scales, making cross-batch direct comparison an approximation.  The
        sum is still a useful proxy for aggregate search intent: higher is
        consistently more interest.

    Args:
        category: Must match a key in CATEGORY_KEYWORDS.
        market:   "korea" | "japan" | "usa"

    Returns:
        {market, category, total_volume, keyword_volumes, top_keyword,
         top_volume, source, fetched_at}
    """
    from app.config.keyword_mapping import CATEGORY_KEYWORDS

    market_key = market.strip().lower()
    config = MARKET_CONFIG.get(market_key)
    if config is None:
        raise ValueError(
            f"Unknown market '{market}'. Valid: {list(MARKET_CONFIG.keys())}"
        )

    keywords = CATEGORY_KEYWORDS.get(category)
    if not keywords:
        raise ValueError(
            f"Unknown category '{category}'. Check CATEGORY_KEYWORDS in keyword_mapping.py."
        )

    if _TrendReq is None:
        _trends_unavailable(_IMPORT_ERROR or "pytrends is not installed")

    geo_code  = config["geo"]
    hl        = config["hl"]
    tz_offset = config["tz"]

    keyword_volumes: dict[str, float] = {}
    batches = [keywords[i: i + 5] for i in range(0, len(keywords), 5)]

    for batch in batches:
        try:
            pt = _TrendReq(hl=hl, tz=tz_offset, timeout=REQUEST_TIMEOUT)
            pt.build_payload(kw_list=batch, timeframe=TIMEFRAME, geo=geo_code)
            df = pt.interest_over_time()
            _jitter_sleep()   # space out consecutive batch requests (HTTP 429 mitigation)

            if df is None or df.empty:
                _trends_unavailable(
                    f"pytrends returned no data for market={market_key} "
                    f"category={category} batch={batch}"
                )

            if "isPartial" in df.columns:
                df = df.drop(columns=["isPartial"])

            for kw in batch:
                col = kw if kw in df.columns else (df.columns[0] if len(df.columns) else None)
                if col is None:
                    _trends_unavailable(
                        f"pytrends returned no usable column for market={market_key} "
                        f"category={category} keyword={kw}"
                    )
                keyword_volumes[kw] = float(df[col].tail(4).mean())

        except DependencyUnavailable:
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Batch fetch failed market=%s category=%s error=%s",
                market_key, category, exc,
            )
            _trends_unavailable(str(exc))

    if not keyword_volumes:
        _trends_unavailable(
            f"pytrends returned no keyword volumes for market={market_key} category={category}"
        )

    total_volume = round(sum(keyword_volumes.values()), 2)
    top_keyword  = max(keyword_volumes, key=lambda k: keyword_volumes[k])
    top_volume   = round(keyword_volumes[top_keyword], 2)

    logger.info(
        "fetch_category_volume ok market=%s category=%s total=%.1f top_kw=%s",
        market_key, category, total_volume, top_keyword,
    )

    return {
        "market":          market_key,
        "category":        category,
        "total_volume":    total_volume,
        "keyword_volumes": keyword_volumes,
        "top_keyword":     top_keyword,
        "top_volume":      top_volume,
        "source":          "pytrends",
        "fetched_at":      datetime.now(timezone.utc).isoformat(),
    }


def rank_markets_by_category(category: str) -> dict:
    """Fetch category volume across all 3 markets and rank by total_volume descending.

    Calls ``fetch_category_volume`` for each of KR / JP / US sequentially
    (with jitter sleeps between batches).  Returns the ranked list plus
    the overall top market and top keyword for notification purposes.

    Args:
        category: Must match a key in CATEGORY_KEYWORDS.

    Returns:
        {category, ranked_markets, top_market, top_keyword,
         top_market_keywords, fetched_at, source}

    ``top_market_keywords`` is the full {keyword: volume} dict for the winning
    market — used by Spring Boot to populate ``keywordData`` in notifications.
    """
    from app.config.keyword_mapping import CATEGORY_KEYWORDS

    if category not in CATEGORY_KEYWORDS:
        raise ValueError(
            f"Unknown category '{category}'. Check CATEGORY_KEYWORDS in keyword_mapping.py."
        )

    results: list[dict] = []

    for market_key in MARKET_CONFIG:
        # fetch_category_volume raises DependencyUnavailable on any failure — it
        # propagates, so a partial ranking is never returned as if complete.
        results.append(fetch_category_volume(category, market_key))

    results.sort(key=lambda r: r["total_volume"], reverse=True)

    top = results[0] if results else {}

    return {
        "category": category,
        "ranked_markets": [
            {
                "market":       r["market"],
                "total_volume": r["total_volume"],
                "top_keyword":  r["top_keyword"],
                "top_volume":   r["top_volume"],
            }
            for r in results
        ],
        "top_market":          top.get("market", ""),
        "top_keyword":         top.get("top_keyword", ""),
        "top_market_keywords": top.get("keyword_volumes", {}),
        "fetched_at":          datetime.now(timezone.utc).isoformat(),
        "source":              "pytrends",
    }
