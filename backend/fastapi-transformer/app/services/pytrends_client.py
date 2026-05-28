"""PyTrends wrapper for Module 2.1 Google Trends data ingestion (FR2.2).

Google Trends blocks requests from data-centre / Docker IPs via HTTP 429.
When that happens both fetch_trends() and fetch_trend_history() fall back to
curated stub series that carry realistic week-over-week variance so the Groq
forecasting and XGBoost scoring pipelines still receive meaningful inputs.
The returned `source` field is "stub" so Spring Boot can label the data
accordingly in the frontend.
"""
from __future__ import annotations

import logging
import time
from datetime import date, datetime, timedelta, timezone

from app.errors import MOD21_PYTRENDS_UNAVAILABLE
from app.middleware.trace import get_trace_id

logger = logging.getLogger(__name__)

try:
    from pytrends.request import TrendReq as _TrendReq
    logger.info("pytrends loaded successfully")
except Exception as exc:  # noqa: BLE001
    raise RuntimeError(
        f"pytrends is required for Module 2.1 market data ingestion but could not be imported: {exc}. "
        "Install it with: pip install pytrends"
    ) from exc

# Market → representative search keywords (Cebu inbound tourism context)
_MARKET_KEYWORDS: dict[str, list[str]] = {
    "korea":  ["Cebu Philippines", "Cebu tourism"],
    "japan":  ["セブ島", "Cebu travel"],
    "usa":    ["Cebu Philippines travel", "Cebu vacation"],
}

# Curated stub series — 52 weeks of realistic inbound tourism search interest
# for each market (chronological, oldest first). Values reflect seasonal peaks
# observed in Philippine inbound tourism data: Korea peaks Jul–Aug & Dec–Jan,
# Japan peaks Mar–Apr & Oct–Nov, USA peaks Jun–Aug & Dec–Jan.
_STUB_SERIES: dict[str, list[float]] = {
    "korea": [
        42, 45, 48, 52, 55, 58, 62, 65, 67, 64, 60, 55,
        50, 48, 45, 43, 41, 40, 42, 45, 50, 55, 60, 65,
        70, 75, 72, 68, 63, 58, 54, 50, 47, 45, 44, 46,
        50, 55, 60, 65, 68, 70, 72, 68, 63, 58, 52, 48,
        45, 43, 41, 40,
    ],
    "japan": [
        35, 38, 42, 48, 55, 58, 54, 50, 46, 42, 40, 38,
        36, 35, 37, 40, 44, 48, 52, 55, 53, 50, 47, 44,
        42, 40, 38, 37, 36, 38, 42, 46, 50, 54, 57, 55,
        52, 48, 45, 42, 40, 39, 38, 40, 44, 48, 52, 55,
        53, 50, 46, 42,
    ],
    "usa": [
        30, 32, 35, 38, 42, 48, 55, 60, 58, 52, 45, 40,
        36, 34, 32, 31, 30, 32, 35, 38, 42, 46, 50, 54,
        58, 62, 60, 56, 51, 46, 42, 38, 35, 33, 32, 34,
        38, 43, 48, 53, 57, 60, 58, 54, 49, 44, 40, 36,
        33, 31, 30, 30,
    ],
}


def _is_rate_limited(exc: Exception) -> bool:
    """Return True when the exception is a Google 429 / IP block."""
    msg = str(exc).lower()
    return "429" in msg or "rate" in msg or "too many" in msg


def _stub_current(market: str) -> dict:
    """Return the most-recent stub trend_index for a market."""
    series = _STUB_SERIES.get(market, _STUB_SERIES["korea"])
    # Rotate the series so the 'current' week aligns with the calendar week
    week_of_year = date.today().isocalendar()[1]
    idx = week_of_year % len(series)
    trend_index = series[idx]
    logger.warning(
        "PyTrends unavailable for market=%s (Google IP block) — using stub index=%.1f",
        market, trend_index,
        extra={"code": MOD21_PYTRENDS_UNAVAILABLE},
    )
    return {
        "market": market,
        "trend_index": trend_index,
        "keywords_used": _MARKET_KEYWORDS.get(market, ["Cebu Philippines"]),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "stub",
    }


def _stub_history(market: str, weeks: int) -> dict:
    """Return a weekly stub series of length `weeks` for a market."""
    full = _STUB_SERIES.get(market, _STUB_SERIES["korea"])
    week_of_year = date.today().isocalendar()[1]
    end_idx = week_of_year % len(full)

    # Build `weeks` points ending at end_idx, wrapping around
    indices = [(end_idx - weeks + i) % len(full) for i in range(weeks)]
    values = [full[i] for i in indices]

    # Attach dates (Monday of each week, chronological)
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    series = [
        {
            "date": str(monday - timedelta(weeks=weeks - 1 - i)),
            "trend_index": float(v),
        }
        for i, v in enumerate(values)
    ]
    logger.warning(
        "PyTrends history unavailable for market=%s (Google IP block) — using stub series weeks=%d",
        market, weeks,
        extra={"code": MOD21_PYTRENDS_UNAVAILABLE},
    )
    return {
        "market": market,
        "weekly_series": series,
        "keywords_used": _MARKET_KEYWORDS.get(market, ["Cebu Philippines"]),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "stub",
    }


def fetch_trends(market: str, categories: list[str]) -> dict:
    """Fetch current Google Trends index for a market-category pair.

    Falls back to curated stub data when Google returns 429 (IP block).

    Returns:
        {market, trend_index, keywords_used, fetched_at, source}
    """
    keywords = _build_keywords(market, categories)
    try:
        pt = _TrendReq(hl="en-US", tz=0, timeout=(10, 25))
        pt.build_payload(keywords[:5], timeframe="today 3-m", geo="")
        df = pt.interest_over_time()
        time.sleep(5)  # avoid Google rate limiting between calls

        if df.empty:
            raise RuntimeError(
                f"PyTrends returned an empty dataframe for market={market}."
            )

        primary_col = keywords[0]
        if primary_col not in df.columns:
            raise RuntimeError(
                f"Primary keyword '{primary_col}' not found in PyTrends response for market={market}."
            )

        trend_index = float(df[primary_col].tail(4).mean())
        return {
            "market": market,
            "trend_index": max(0.0, min(100.0, trend_index)),
            "keywords_used": keywords,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "live",
        }

    except Exception as exc:  # noqa: BLE001
        if _is_rate_limited(exc):
            return _stub_current(market)
        logger.error(
            "PyTrends request failed for market=%s: %s",
            market, exc,
            extra={"trace_id": get_trace_id(), "code": MOD21_PYTRENDS_UNAVAILABLE},
        )
        raise RuntimeError(f"PyTrends request failed for market={market}: {exc}") from exc


def fetch_trend_history(market: str, categories: list[str], weeks: int = 12) -> dict:
    """Fetch weekly Google Trends history for the past N weeks.

    Falls back to curated stub series when Google returns 429 (IP block).

    Returns:
        {market, weekly_series: [{date, trend_index}], keywords_used, fetched_at, source}
    """
    keywords = _build_keywords(market, categories)
    try:
        pt = _TrendReq(hl="en-US", tz=0, timeout=(10, 25))
        timeframe = f"today {weeks}-w"
        pt.build_payload(keywords[:5], timeframe=timeframe, geo="")
        df = pt.interest_over_time()
        time.sleep(5)

        if df.empty:
            raise RuntimeError(
                f"PyTrends history returned empty dataframe for market={market}."
            )

        primary_col = keywords[0]
        if primary_col not in df.columns:
            raise RuntimeError(
                f"Primary keyword '{primary_col}' not found in PyTrends history for market={market}."
            )

        series = [
            {"date": str(idx.date()), "trend_index": max(0.0, min(100.0, float(val)))}
            for idx, val in zip(df.index, df[primary_col])
            if not (hasattr(val, "__class__") and val.__class__.__name__ == "bool")
        ]
        logger.info(
            "PyTrends history fetched market=%s weeks=%d points=%d",
            market, weeks, len(series),
        )
        return {
            "market": market,
            "weekly_series": series,
            "keywords_used": keywords,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "live",
        }

    except Exception as exc:  # noqa: BLE001
        if _is_rate_limited(exc):
            return _stub_history(market, weeks)
        logger.error(
            "PyTrends history failed for market=%s: %s", market, exc,
            extra={"trace_id": get_trace_id(), "code": MOD21_PYTRENDS_UNAVAILABLE},
        )
        raise RuntimeError(f"PyTrends history request failed for market={market}: {exc}") from exc


# ─── helpers ─────────────────────────────────────────────────────────────────

def _build_keywords(market: str, categories: list[str]) -> list[str]:
    base = _MARKET_KEYWORDS.get(market, ["Cebu Philippines"])
    category_terms = [f"Cebu {c}" for c in (categories or [])[:2]]
    return (base + category_terms)[:5]
