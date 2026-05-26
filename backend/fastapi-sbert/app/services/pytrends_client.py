"""PyTrends wrapper for Module 2.1 Google Trends data ingestion (FR2.2).

Follows the same singleton + fallback pattern as ml_classifier.py:
  - attempt to import pytrends at module load
  - if unavailable, all calls return deterministic stub values
  - rate limiting handled with sleep between requests
"""
from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime, timezone

from app.errors import MOD21_PYTRENDS_UNAVAILABLE
from app.middleware.trace import get_trace_id

logger = logging.getLogger(__name__)

_TrendReq = None  # loaded once at import time

try:
    from pytrends.request import TrendReq as _TrendReqClass
    _TrendReq = _TrendReqClass
    logger.info("pytrends loaded successfully")
except Exception as exc:  # noqa: BLE001
    logger.warning(
        "pytrends unavailable — using stub values",
        extra={"trace_id": get_trace_id(), "code": MOD21_PYTRENDS_UNAVAILABLE, "detail": str(exc)},
    )

# Market → representative search keywords (Cebu inbound tourism context)
_MARKET_KEYWORDS: dict[str, list[str]] = {
    "korea":  ["Cebu Philippines", "Cebu tourism"],
    "japan":  ["セブ島", "Cebu travel"],
    "usa":    ["Cebu Philippines travel", "Cebu vacation"],
}

# Deterministic stub trend indices per market (0-100 scale)
_STUB_BASE: dict[str, float] = {
    "korea": 72.0,
    "japan": 58.0,
    "usa":   44.0,
}


def fetch_trends(market: str, categories: list[str]) -> dict:
    """Fetch Google Trends index for a market-category pair.

    Returns:
        {market, trend_index, keywords_used, fetched_at}
    """
    if _TrendReq is None:
        return _stub_trends(market)

    keywords = _build_keywords(market, categories)
    try:
        pt = _TrendReq(hl="en-US", tz=0, timeout=(10, 25))
        pt.build_payload(keywords[:5], timeframe="today 3-m", geo="")
        df = pt.interest_over_time()
        time.sleep(5)  # avoid Google rate limiting between calls

        if df.empty:
            logger.warning(
                "PyTrends returned empty dataframe",
                extra={"trace_id": get_trace_id(), "code": MOD21_PYTRENDS_UNAVAILABLE, "market": market},
            )
            return _stub_trends(market)

        # average the last 4 weeks of data for the primary keyword
        primary_col = keywords[0]
        if primary_col not in df.columns:
            return _stub_trends(market)

        trend_index = float(df[primary_col].tail(4).mean())
        return {
            "market": market,
            "trend_index": max(0.0, min(100.0, trend_index)),
            "keywords_used": keywords,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "PyTrends request failed — using stub",
            extra={"trace_id": get_trace_id(), "code": MOD21_PYTRENDS_UNAVAILABLE, "detail": str(exc)},
        )
        return _stub_trends(market)


# ─── helpers ─────────────────────────────────────────────────────────────────

def _build_keywords(market: str, categories: list[str]) -> list[str]:
    base = _MARKET_KEYWORDS.get(market, ["Cebu Philippines"])
    category_terms = [f"Cebu {c}" for c in (categories or [])[:2]]
    return (base + category_terms)[:5]


def _stub_trends(market: str) -> dict:
    seed = int(hashlib.md5(market.encode()).digest()[0])
    jitter = (seed % 20) - 10  # ±10
    trend_index = max(0.0, min(100.0, _STUB_BASE.get(market, 50.0) + jitter))
    return {
        "market": market,
        "trend_index": trend_index,
        "keywords_used": [],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
    }
