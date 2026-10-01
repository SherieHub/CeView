"""Google Trends data fetcher and SeasonalShift math engine — Module 2.1 (FR2.2).

Public API:
    fetch_and_process(market: str, category: str) -> dict

Pipeline per request:
    1. Resolve localized keywords from MACRO_TREND_MAPPING
       (native Hangul for KR, Kanji/Kana for JP — English proxies return near-zero
       volume for Asian markets and must NOT be used there)
    2. Call SerpApi's Google Trends engine with market-specific geo/hl/tz from
       MARKET_CONFIG
    3. Fetch "today 5-y" (~260 weekly data points)
    4. Delegate the full SeasonalShift computation to seasonal_shift_detector.compute()
       — rolling 7d/30d averages, population std-dev, spike indicator (mean+2σ),
         YoY ratio, and composite seasonality score
    5. Return structured dict matching TrendsFetchResponse schema

Unavailability:
    When SERPAPI_KEY is not configured or any request fails, this module raises
    ``DependencyUnavailable`` (HTTP 503) carrying the upstream reason. There is
    no synthetic fallback — a fabricated trend series is indistinguishable from
    a measured one once it reaches a forecast. See
    docs/superpowers/specs/2026-08-30-remove-synthetic-fallbacks-design.md §1.

Provider note: this used to call the unofficial `pytrends` scraper directly
against Google. It was replaced with SerpApi's Google Trends engine (a paid,
supported API) because pytrends has no SLA and periodically breaks or gets
rate-limited (HTTP 429) whenever Google changes its frontend or a burst of
requests goes out. SerpApi mirrors pytrends' geo/hl/tz/timeframe parameters
closely, which is why the shapes below still look familiar.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, NoReturn

import httpx

from app.config.keyword_mapping import MACRO_TREND_MAPPING, MARKET_CONFIG
from app.services.seasonal_shift_detector import compute as seasonal_compute
from app.unavailable import DependencyUnavailable

logger = logging.getLogger(__name__)

# ── SerpApi configuration ────────────────────────────────────────────────────
SERPAPI_URL: str = "https://serpapi.com/search.json"
_SERPAPI_KEY: str | None = os.getenv("SERPAPI_KEY", "").strip() or None

if _SERPAPI_KEY is None:
    logger.warning("SERPAPI_KEY is not set — trend fetches will fail loudly")
else:
    logger.info("SerpApi trend service configured")

# ── Constants ─────────────────────────────────────────────────────────────────

TIMEFRAME:       str   = "today 5-y"   # ~260 weekly points; satisfies 52w YoY requirement
REQUEST_TIMEOUT: httpx.Timeout = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)


def _trends_unavailable(cause: str) -> NoReturn:
    """Raise the one structured 503 for every trend-fetch failure path."""
    raise DependencyUnavailable(
        code="MOD21_TRENDS_UNAVAILABLE",
        message="Google Trends data is unavailable.",
        dependency="serpapi",
        cause=cause,
        stage="fastapi-transformer/trend_service",
    )


def _serpapi_timeline(
    keywords: list[str], geo: str, hl: str, tz: int, date_range: str
) -> list[dict[str, Any]]:
    """Call SerpApi's Google Trends engine and return its raw timeline_data list.

    Each entry looks like:
        {"date": "...", "timestamp": "...", "values": [{"query": kw, "value": "23",
         "extracted_value": 23}, ...]}
    with `values` in the same order as `keywords` (SerpApi preserves `q` order).
    """
    if _SERPAPI_KEY is None:
        _trends_unavailable("SERPAPI_KEY is not set")

    params = {
        "engine": "google_trends",
        "q": ",".join(keywords[:5]),   # SerpApi/Google Trends max: 5 terms per request
        "geo": geo,
        "hl": hl,
        "tz": str(tz),
        "date": date_range,
        "data_type": "TIMESERIES",
        "api_key": _SERPAPI_KEY,
    }

    try:
        resp = httpx.get(SERPAPI_URL, params=params, timeout=REQUEST_TIMEOUT)
    except Exception as exc:  # noqa: BLE001
        _trends_unavailable(str(exc))

    if resp.status_code >= 400:
        # SerpApi puts the actual reason ({"error": "..."}) in the response body —
        # raise_for_status()'s message alone ("400 Bad Request") throws that away,
        # which is what made an earlier "Invalid date format." bug look like an
        # opaque connectivity failure. Surface the body instead.
        try:
            detail = resp.json().get("error", resp.text)
        except Exception:  # noqa: BLE001
            detail = resp.text
        _trends_unavailable(f"HTTP {resp.status_code}: {detail}")

    try:
        payload = resp.json()
    except Exception as exc:  # noqa: BLE001
        _trends_unavailable(str(exc))

    if payload.get("error"):
        _trends_unavailable(str(payload["error"]))

    timeline = payload.get("interest_over_time", {}).get("timeline_data", [])
    if not timeline:
        _trends_unavailable(
            f"serpapi returned no timeline data for q={keywords} geo={geo} date={date_range}"
        )

    return timeline


def _extract_series(timeline: list[dict[str, Any]], keyword: str) -> list[float]:
    """Pull one keyword's series out of a SerpApi timeline, by position then by name."""
    idx = None
    first_values = timeline[0].get("values", []) if timeline else []
    for i, v in enumerate(first_values):
        if v.get("query") == keyword:
            idx = i
            break
    if idx is None:
        idx = 0  # fall back to the primary (first-requested) keyword's column

    series: list[float] = []
    for point in timeline:
        values = point.get("values", [])
        if idx < len(values):
            series.append(float(values[idx].get("extracted_value", 0) or 0))
        else:
            series.append(0.0)
    return series


# ─── Public API ───────────────────────────────────────────────────────────────

def fetch_and_process(market: str, category: str) -> dict:
    """Fetch Google Trends data (via SerpApi) for one (market, category) pair and
    run SeasonalShift math.

    Args:
        market:   "korea" | "japan" | "usa"
        category: Must match a key in MACRO_TREND_MAPPING / CATEGORY_LABELS in ml_classifier.py

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

    # ── 2. Fetch from SerpApi (Google Trends) ─────────────────────────────────
    timeline = _serpapi_timeline(keywords[:5], geo_code, hl, tz_offset, TIMEFRAME)

    primary_kw = keywords[0]
    series = _extract_series(timeline, primary_kw)

    if not series:
        _trends_unavailable(
            f"serpapi returned an empty series for market={market_key} category={category}"
        )

    trend_index = float(series[-1])

    # ── 3. SeasonalShift computation via seasonal_shift_detector ──────────────
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
        "source":            "serpapi",
    }


# ─── Market-data ingestion API (consumed by /internal/market-data router) ──────

def fetch_current_index(market: str, categories: list[str]) -> dict:
    """Fetch the current Google Trends index (via SerpApi) for a market using
    localized keywords.

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

    timeline = _serpapi_timeline(keywords[:5], geo_code, config["hl"], config["tz"], "today 3-m")
    series = _extract_series(timeline, keywords[0])
    trend_index = sum(series[-4:]) / len(series[-4:]) if series else 0.0

    return {
        "market":        market_key,
        "trend_index":   round(max(0.0, min(100.0, trend_index)), 2),
        "keywords_used": list(keywords[:5]),
        "fetched_at":    datetime.now(timezone.utc).isoformat(),
        "source":        "serpapi",
    }


def fetch_trend_history(market: str, categories: list[str], weeks: int = 12) -> dict:
    """Fetch ``weeks`` of weekly Google Trends history (via SerpApi) for a market.

    Used on first ingestion to backfill MarketSignalRecord rows so the demand chart
    shows real week-over-week variance. Same localized-keyword / correct-geo
    resolution as ``fetch_current_index``.

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

    # Google Trends only returns WEEKLY granularity for ranges of roughly 9
    # months to 5 years — anything shorter (e.g. a tight custom "trailing 12
    # weeks" range) silently comes back as DAILY points instead, which then
    # fail Spring's "weekStartDate must be Monday" validator downstream. Fetch
    # a preset long enough to guarantee weekly points, then keep only the
    # trailing `weeks` of them, rather than requesting a short custom range.
    preset = "today 12-m" if weeks <= 52 else TIMEFRAME
    timeline = _serpapi_timeline(keywords[:5], geo_code, config["hl"], config["tz"], preset)

    primary_kw = keywords[0]
    idx = 0
    first_values = timeline[0].get("values", []) if timeline else []
    for i, v in enumerate(first_values):
        if v.get("query") == primary_kw:
            idx = i
            break

    series = [
        {
            # SerpApi's own "date" field is locale-formatted (e.g. "2026. 6. 19."
            # for hl=ko) and unsafe to parse downstream — "timestamp" (Unix epoch
            # seconds) is locale-independent and what the ISO date is derived from.
            #
            # Google Trends' weekly buckets start on SUNDAY, but Spring's
            # WeeklyFeatureRow requires a MONDAY-aligned ISO week start (and
            # rejects anything else). +1 day moves the bucket's start onto the
            # Monday that covers 6 of its 7 days (Mon–Sat), the same ISO week
            # for practical purposes — only the original Sunday itself
            # (1/7 of the bucket) actually belonged to the prior ISO week.
            "date": (
                datetime.fromtimestamp(int(point.get("timestamp", 0)), tz=timezone.utc).date()
                + timedelta(days=1)
            ).isoformat(),
            "trend_index": round(
                max(0.0, min(100.0, float(
                    point.get("values", [])[idx].get("extracted_value", 0)
                    if idx < len(point.get("values", [])) else 0
                ))), 2,
            ),
        }
        for point in timeline
    ][-weeks:]

    logger.info(
        "fetch_trend_history ok market=%s geo=%s weeks=%d points=%d",
        market_key, geo_code, weeks, len(series),
    )

    return {
        "market":        market_key,
        "weekly_series": series,
        "keywords_used": list(keywords[:5]),
        "fetched_at":    datetime.now(timezone.utc).isoformat(),
        "source":        "serpapi",
    }


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
    """Resolve localized SerpApi/Google Trends keywords from the FIRST tagged category.

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

    SerpApi (like pytrends before it) limits queries to 5 keywords per request,
    so the 10 keywords are split into two batches.  Within each batch the last 4
    weekly values of each keyword are averaged, then ALL 10 averages are summed
    to produce ``total_volume``.

    NOTE — within-batch normalization:
        Google Trends returns relative interest (0–100) normalized to the highest
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

    geo_code  = config["geo"]
    hl        = config["hl"]
    tz_offset = config["tz"]

    keyword_volumes: dict[str, float] = {}
    batches = [keywords[i: i + 5] for i in range(0, len(keywords), 5)]

    for batch in batches:
        timeline = _serpapi_timeline(batch, geo_code, hl, tz_offset, TIMEFRAME)

        for i, kw in enumerate(batch):
            series = _extract_series(timeline, kw) if i == 0 else [
                float(point.get("values", [])[i].get("extracted_value", 0) or 0)
                if i < len(point.get("values", [])) else 0.0
                for point in timeline
            ]
            tail = series[-4:] if series else []
            keyword_volumes[kw] = sum(tail) / len(tail) if tail else 0.0

    if not keyword_volumes:
        _trends_unavailable(
            f"serpapi returned no keyword volumes for market={market_key} category={category}"
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
        "source":          "serpapi",
        "fetched_at":      datetime.now(timezone.utc).isoformat(),
    }


def rank_markets_by_category(category: str) -> dict:
    """Fetch category volume across all 3 markets and rank by total_volume descending.

    Calls ``fetch_category_volume`` for each of KR / JP / US sequentially.
    Returns the ranked list plus the overall top market and top keyword for
    notification purposes.

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
        "source":              "serpapi",
    }
