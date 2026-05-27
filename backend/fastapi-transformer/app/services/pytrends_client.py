"""PyTrends wrapper for Module 2.1 Google Trends data ingestion (FR2.2).

Requires pytrends to be installed and Google Trends to be reachable.
Raises RuntimeError at import time if pytrends is unavailable.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

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


def fetch_trends(market: str, categories: list[str]) -> dict:
    """Fetch current Google Trends index for a market-category pair.

    Returns:
        {market, trend_index, keywords_used, fetched_at, source}

    Raises:
        RuntimeError: if the PyTrends request fails or returns no data.
    """
    keywords = _build_keywords(market, categories)
    try:
        pt = _TrendReq(hl="en-US", tz=0, timeout=(10, 25))
        pt.build_payload(keywords[:5], timeframe="today 3-m", geo="")
        df = pt.interest_over_time()
        time.sleep(5)  # avoid Google rate limiting between calls

        if df.empty:
            raise RuntimeError(
                f"PyTrends returned an empty dataframe for market={market}. "
                "Google Trends may be rate-limiting or the keywords returned no data."
            )

        primary_col = keywords[0]
        if primary_col not in df.columns:
            raise RuntimeError(
                f"Primary keyword '{primary_col}' not found in PyTrends response columns "
                f"for market={market}. Available columns: {list(df.columns)}"
            )

        trend_index = float(df[primary_col].tail(4).mean())
        return {
            "market": market,
            "trend_index": max(0.0, min(100.0, trend_index)),
            "keywords_used": keywords,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "source": "live",
        }

    except RuntimeError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "PyTrends request failed for market=%s: %s",
            market, exc,
            extra={"trace_id": get_trace_id(), "code": MOD21_PYTRENDS_UNAVAILABLE, "detail": str(exc)},
        )
        raise RuntimeError(
            f"PyTrends request failed for market={market}: {exc}"
        ) from exc


def fetch_trend_history(market: str, categories: list[str], weeks: int = 12) -> dict:
    """Fetch weekly Google Trends history for the past N weeks.

    Used on first ingestion for a profile to backfill historical signal records
    so the chart shows real week-over-week variance instead of a flat line.

    Returns:
        {market, weekly_series: [{date, trend_index}], keywords_used, fetched_at, source}
        weekly_series is chronological (oldest first).

    Raises:
        RuntimeError: if the PyTrends request fails or returns no data.
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
                f"PyTrends history returned an empty dataframe for market={market} "
                f"(timeframe={timeframe}). "
                "Google Trends may be rate-limiting or the keywords returned no data."
            )

        primary_col = keywords[0]
        if primary_col not in df.columns:
            raise RuntimeError(
                f"Primary keyword '{primary_col}' not found in PyTrends history response "
                f"for market={market}. Available columns: {list(df.columns)}"
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

    except RuntimeError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.error(
            "PyTrends history failed for market=%s: %s", market, exc,
            extra={"trace_id": get_trace_id(), "code": MOD21_PYTRENDS_UNAVAILABLE, "detail": str(exc)},
        )
        raise RuntimeError(
            f"PyTrends history request failed for market={market}: {exc}"
        ) from exc


# ─── helpers ─────────────────────────────────────────────────────────────────

def _build_keywords(market: str, categories: list[str]) -> list[str]:
    base = _MARKET_KEYWORDS.get(market, ["Cebu Philippines"])
    category_terms = [f"Cebu {c}" for c in (categories or [])[:2]]
    return (base + category_terms)[:5]
