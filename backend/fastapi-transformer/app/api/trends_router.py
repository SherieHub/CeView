"""Module 2.1 — Localized Google Trends Fetch API (FR2.2).

  POST /api/trends/fetch
      Accept exactly ONE (market, category) pair per request.
      Designed for sequential, decoupled orchestration by the Spring Boot
      TrendFetchSchedulerService (one HTTP call per category/market pair).

Usage in Postman:
    POST  http://localhost:8001/api/trends/fetch
    Body  (raw JSON):
        { "market": "korea", "category": "Coastal & Island" }

    Expected response time: 4–12 s when pytrends is live (jitter sleep).
    Instant when source="stub" (pytrends offline / package missing).

Valid market values:   "korea" | "japan" | "usa"
Valid category values: must match one of the 7 CATEGORY_LABELS in ml_classifier.py
    "Coastal & Island"
    "Adventure & Nature"
    "Cultural & Heritage"
    "Theme Parks / Entertainment"
    "Urban & City"
    "Culinary & Gastronomy"
    "Accommodation & Staycation"
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.trend_service import fetch_and_process

router = APIRouter()
log    = logging.getLogger("module2.trends")


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class TrendsFetchRequest(BaseModel):
    """Request body: one (market, category) pair per POST.

    Decoupled design: one request per pair (not batched) so that:
    - The Spring Boot scheduler can apply state tracking per row
    - A single HTTP 429 from Google does not fail all 21 combinations
    - Jitter sleep is isolated and proportional per fetch
    """
    market:   str = Field(
        ...,
        description="Target source market.",
        examples=["korea"],
        pattern=r"^(korea|japan|usa)$",
    )
    category: str = Field(
        ...,
        description=(
            "CeView tourism category label. Must match one of the 7 CATEGORY_LABELS "
            "in ml_classifier.py (case-sensitive)."
        ),
        examples=["Coastal & Island"],
        min_length=1,
    )


class TrendsFetchResponse(BaseModel):
    """Full Google Trends result enriched with SeasonalShift metrics.

    All floating-point fields match the output of seasonal_shift_detector.compute().
    """
    market:            str
    category:          str
    keywords_used:     list[str]  = Field(description="Localized keywords submitted to Google Trends")
    trend_index:       float      = Field(ge=0.0,  le=100.0,  description="Current normalised Google Trends index (0–100)")
    rolling_7d_avg:    float      = Field(description="7-week rolling mean of trend_index  (§2 SeasonalShift spec)")
    rolling_30d_avg:   float      = Field(description="30-week rolling mean of trend_index (§2 SeasonalShift spec)")
    rolling_7d_std:    float      = Field(ge=0.0,             description="7-week population std-dev (§3)")
    spike_indicator:   bool       = Field(description="True iff current > rolling_7d_avg + 2σ  (§3.3)")
    yoy_ratio:         float | None = Field(description="rolling_7d_avg(t) / rolling_7d_avg(t−52w); None when < 59 data points  (§4)")
    seasonality_score: float      = Field(ge=0.0,  le=1.0,   description="Composite seasonality score 0–1  (§5)")
    data_points:       int        = Field(ge=0,               description="Weekly data points in the fetched series")
    fetched_at:        str        = Field(description="ISO-8601 UTC timestamp of the fetch")
    source:            str        = Field(description="'pytrends' when live; 'stub' when pytrends offline")


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post(
    "/fetch",
    response_model=TrendsFetchResponse,
    summary="Fetch localized Google Trends data for one market/category pair",
)
def fetch_trends(req: TrendsFetchRequest) -> TrendsFetchResponse:
    """Fetch Google Trends data for one (market, category) pair.

    **Localization:**
    Keywords are resolved from ``KEYWORD_MAPPING`` using native-language terms
    for Asian markets (Hangul for KR, Kanji/Kana for JP).  English proxies are
    NOT used for KR/JP — they return near-zero volume and produce biased signals.

    **Rate limiting:**
    A randomised jitter sleep (4–12 s) is applied after every single pytrends
    request inside ``trend_service.fetch_and_process``.  When pytrends is live,
    this endpoint will naturally take 4–12 s to respond.  This is intentional
    behaviour — do not lower the timeout in Postman below 20 s.

    **SeasonalShift math (``CeView_SeasonalShift_Detection.md``):**
    The response includes all §2–§5 metrics: rolling averages, std-dev, spike
    indicator, YoY ratio, and the composite seasonality score.

    **Fallback:**
    If pytrends is not installed or the Google request fails, a deterministic
    stub result is returned (``source="stub"``) so the endpoint always responds
    with a 200 rather than a 500.
    """
    log.info("trends.fetch received market=%s category=%s", req.market, req.category)

    try:
        result = fetch_and_process(market=req.market, category=req.category)

        log.info(
            "trends.fetch ok market=%s category=%s source=%s "
            "trend_index=%.1f spike=%s seasonality=%.3f",
            req.market, req.category,
            result.get("source"),
            result.get("trend_index", 0),
            result.get("spike_indicator"),
            result.get("seasonality_score", 0),
        )
        return TrendsFetchResponse(**result)

    except ValueError as exc:
        # Invalid market name — return 422 Unprocessable Entity
        log.warning("trends.fetch 422 — %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    except Exception as exc:  # noqa: BLE001
        log.exception(
            "trends.fetch 500 — market=%s category=%s error=%s",
            req.market, req.category, exc,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Trend fetch failed for market='{req.market}' category='{req.category}': {exc}",
        ) from exc


# ─── Category-volume ranking endpoint ─────────────────────────────────────────

class RankMarketsRequest(BaseModel):
    """Request body: one category to rank across all 3 markets."""
    category: str = Field(
        ...,
        description=(
            "CeView tourism category label. Must match one of the 7 CATEGORY_LABELS "
            "(case-sensitive). Example: \"Coastal & Island\"."
        ),
        examples=["Coastal & Island"],
        min_length=1,
    )


class MarketVolumeResult(BaseModel):
    """Per-market aggregated keyword volume."""
    market:       str   = Field(description="Market key: 'korea' | 'japan' | 'usa'")
    total_volume: float = Field(ge=0.0, description="Sum of mean keyword volumes across 10 keywords")
    top_keyword:  str   = Field(description="Keyword with the highest individual volume in this market")
    top_volume:   float = Field(ge=0.0, description="Volume of the top keyword")


class RankMarketsResponse(BaseModel):
    """Full cross-market ranking result for one category."""
    category:            str
    ranked_markets:      list[MarketVolumeResult] = Field(
        description="Markets sorted by total_volume descending"
    )
    top_market:          str = Field(description="Market key of the highest-volume market")
    top_keyword:         str = Field(description="Top keyword in the winning market")
    top_market_keywords: dict[str, float] = Field(
        description="Full {keyword: volume} map for the top market — used for notification keywordData"
    )
    fetched_at:          str
    source:              str = Field(description="'pytrends' when live; 'stub' otherwise")


@router.post(
    "/rank-markets",
    response_model=RankMarketsResponse,
    summary="Rank markets by total category keyword search volume",
)
def rank_markets(req: RankMarketsRequest) -> RankMarketsResponse:
    """Aggregate and rank search volumes for the 10 predefined keywords in a
    category across all 3 markets (KR / JP / US).

    **Workflow:**
    1. For each market, fetch pytrends data for the 10 ``CATEGORY_KEYWORDS``
       in two batches of 5 (pytrends limit).
    2. Average the last 4 weekly values per keyword → 10 per-keyword means.
    3. Sum the 10 means → ``total_volume`` for that market.
    4. Repeat for all 3 markets; sort descending by ``total_volume``.
    5. Return the ranked list, the winning market, and the top keyword.

    **Use case:** Notify a business owner which country searches most for
    their tagged category (e.g. "South Korea generates the highest search
    volume for 'Coastal & Island'").

    **Latency:** ~25–75 s when pytrends is live (6 batches × 4–12 s jitter).
    Instant when pytrends is offline (stub mode).
    """
    log.info("trends.rank-markets received category=%s", req.category)

    try:
        from app.services.trend_service import rank_markets_by_category
        result = rank_markets_by_category(category=req.category)

        log.info(
            "trends.rank-markets ok category=%s top_market=%s top_kw=%s source=%s",
            req.category, result.get("top_market"), result.get("top_keyword"),
            result.get("source"),
        )
        return RankMarketsResponse(**result)

    except ValueError as exc:
        log.warning("trends.rank-markets 422 — %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    except Exception as exc:  # noqa: BLE001
        log.exception("trends.rank-markets 500 — category=%s error=%s", req.category, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Market ranking failed for category='{req.category}': {exc}",
        ) from exc
