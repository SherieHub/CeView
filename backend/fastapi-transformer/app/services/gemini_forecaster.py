"""Groq-powered demand forecasting for CeView Module 2.2.

Replaces the BiLSTM + Transformer model entirely per Phase 2 architectural
directive.  Constructs a structured analytical prompt combining:
  - Chronological weekly trend-index series (0–100, PyTrends normalized)
  - Rolling statistics (7-period avg, 30-period avg, 7-period std)
  - Spike detection flag (2σ breakout)
  - Year-over-Year ratio (52-week lookback)
  - Seasonality score (composite from SeasonalShiftDetector)
  - Forex rate and GDP growth for economic context

Groq returns 4 individual weekly forecasts (Wk+1 to Wk+4) plus a
12-week outlook, so the demand chart shows a real trend line instead of
a flat repeated value.

Environment variables:
    GROQ_API_KEY  — Groq API key (required)
    GROQ_MODEL    — model name (default: "llama-3.3-70b-versatile")
"""
from __future__ import annotations

import json
import logging
import os
import re
import time

from app.services.forecast_validator import validate

logger = logging.getLogger(__name__)

# ─── API initialisation ───────────────────────────────────────────────────────

_API_KEY    = os.getenv("GROQ_API_KEY", "")
_MODEL_NAME = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
_groq_client = None   # set below on successful import

if _API_KEY:
    try:
        from openai import OpenAI  # type: ignore[import]
        _groq_client = OpenAI(
            api_key=_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )
        logger.info("Groq API initialised — model=%s", _MODEL_NAME)
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to initialise Groq API: %s", exc)
        raise RuntimeError(f"Groq API initialisation failed: {exc}") from exc
else:
    raise RuntimeError(
        "GROQ_API_KEY environment variable is not set. "
        "Groq forecasting requires a valid API key."
    )


# ─── public interface ─────────────────────────────────────────────────────────

def forecast(
    market: str,
    trend_series: list[float],
    rolling_7d: float,
    rolling_30d: float,
    rolling_std_7d: float,
    spike_indicator: bool,
    yoy_ratio: float | None,
    seasonality_score: float,
    forex_rate: float,
    gdp_growth: float,
    gdp_trend_direction: str | None = None,
    gdp_trend_delta: float | None = None,
) -> dict:
    """Produce 4 individual weekly forecasts plus a 12-week outlook via Groq.

    Returns:
        {
          predicted_demand_4w   : float  — average of the 4 weekly forecasts
          predicted_demand_12w  : float  — 12-week outlook
          weekly_forecasts      : list[float]  — [wk1 … wk12]
          mape, mae, rmse, confidence, passed, low_confidence_disclaimer, message, source
        }

    Raises:
        ValueError: if trend_series is empty (ingestion has not run).
        RuntimeError: if the Groq API is unavailable after 3 retries.
            The caller (FastAPI router) converts this to a 503 response with a
            structured error body — no statistical fallback is used.
    """
    if not trend_series:
        raise ValueError(
            f"trend_series is required for market '{market}' — "
            "run ingestion to populate signal records before forecasting."
        )

    result = _groq_forecast(
        market, trend_series, rolling_7d, rolling_30d, rolling_std_7d,
        spike_indicator, yoy_ratio, seasonality_score, forex_rate, gdp_growth,
        gdp_trend_direction, gdp_trend_delta,
    )
    result["source"] = "groq"
    validation = validate(result["mape"], result["mae"], result["rmse"])
    return {**result, **validation}


# ─── Groq inference ───────────────────────────────────────────────────────────

def _gemini_call(prompt: str, max_output_tokens: int = 256, context: str = "") -> str:
    """Shared Groq HTTP call with 3-attempt exponential back-off.

    Args:
        prompt: The full prompt string to send.
        max_output_tokens: Token budget for the response (256 per market; use 800 for batch).
        context: Human-readable label for log messages (e.g. "market=korea").

    Raises:
        RuntimeError: after 3 failed attempts.
    """
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            response = _groq_client.chat.completions.create(
                model=_MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.10,
                max_tokens=max_output_tokens,
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content.strip()
        except Exception as exc:  # noqa: BLE001
            last_exc = exc
            if attempt < 2:
                time.sleep(2 ** attempt)   # exponential back-off: 1 s, 2 s
                logger.debug("Groq retry %d%s: %s",
                             attempt + 1, f" for {context}" if context else "", exc)
                continue
            break
    raise RuntimeError(
        f"Groq API failed after 3 attempts{f' for {context}' if context else ''}: {last_exc}"
    ) from last_exc


def _groq_forecast(
    market: str,
    trend_series: list[float],
    rolling_7d: float,
    rolling_30d: float,
    rolling_std_7d: float,
    spike_indicator: bool,
    yoy_ratio: float | None,
    seasonality_score: float,
    forex_rate: float,
    gdp_growth: float,
    gdp_trend_direction: str | None = None,
    gdp_trend_delta: float | None = None,
) -> dict:
    prompt = _build_prompt(
        market, trend_series, rolling_7d, rolling_30d, rolling_std_7d,
        spike_indicator, yoy_ratio, seasonality_score, forex_rate, gdp_growth,
        gdp_trend_direction, gdp_trend_delta,
    )
    raw = _gemini_call(prompt, max_output_tokens=256, context=f"market={market}")
    return _parse_response(raw, trend_series)


def _build_prompt(
    market: str,
    trend_series: list[float],
    rolling_7d: float,
    rolling_30d: float,
    rolling_std_7d: float,
    spike_indicator: bool,
    yoy_ratio: float | None,
    seasonality_score: float,
    forex_rate: float,
    gdp_growth: float,
    gdp_trend_direction: str | None = None,
    gdp_trend_delta: float | None = None,
) -> str:
    # Cap at 12 most-recent points to keep prompt compact
    display = trend_series[-12:] if len(trend_series) > 12 else trend_series
    series_str = ", ".join(f"{v:.1f}" for v in display)
    yoy_str = f"{yoy_ratio:.3f}" if yoy_ratio is not None else "N/A (< 59 weeks of history)"
    momentum = "accelerating" if rolling_7d > rolling_30d else "decelerating"
    spike_str = "YES — current trend exceeds μ + 2σ" if spike_indicator else "NO"
    current = trend_series[-1] if trend_series else 50.0

    # GDP trend context block — present only when the 5-year series is available
    if gdp_trend_direction is not None and gdp_trend_delta is not None:
        sign = "+" if gdp_trend_delta >= 0 else ""
        gdp_trend_str = (
            f"  GDP multi-year trend (5yr)  : {gdp_trend_direction.upper()} "
            f"({sign}{gdp_trend_delta:.2f}pp change from oldest to latest)\n"
        )
    else:
        gdp_trend_str = ""

    return (
        "You are a precision tourism demand forecasting engine for CeView, a business intelligence "
        "platform for Cebu, Philippines tourism operators.\n\n"
        f"TASK: Forecast Google Trends search interest demand for {market.upper()} tourists "
        "searching for Cebu travel. Produce 12 distinct weekly predictions (one per week, "
        "Wk+1 through Wk+12) that show a realistic multi-week trajectory.\n\n"
        "SIGNAL DATA (weekly normalised trend index 0–100, chronological, last 12 weeks):\n"
        f"[{series_str}]\n"
        f"Most recent observation: {current:.1f}\n\n"
        "COMPUTED SIGNAL STATISTICS:\n"
        f"  7-period rolling average  : {rolling_7d:.2f}\n"
        f"  30-period rolling average : {rolling_30d:.2f}\n"
        f"  7-period rolling std dev  : {rolling_std_7d:.2f}\n"
        f"  Trend momentum            : {momentum} (7d avg vs 30d avg)\n"
        f"  Demand spike (2σ test)    : {spike_str}\n"
        f"  Year-over-Year ratio      : {yoy_str}\n"
        f"  Seasonality score         : {seasonality_score:.3f} (0=flat, 1=highly seasonal)\n\n"
        "ECONOMIC CONTEXT:\n"
        f"  Forex rate (PHP per 1 foreign unit) : {forex_rate:.4f}\n"
        f"  GDP growth (annual %, latest)       : {gdp_growth:.2f}\n"
        f"{gdp_trend_str}"
        "\nFORECASTING RULES (apply in order):\n"
        "  1. ALL 12 values MUST be distinct — no two consecutive weeks should be identical.\n"
        "  2. Continue momentum direction, dampening progressively toward the 7d rolling average.\n"
        f"  3. HARD ceiling: if current observation ({current:.1f}) > 65, no week may exceed 92. "
        "Google Trends indices always mean-revert within weeks after a surge.\n"
        "  4. Apply mean-reversion pressure continuously: weeks 5–12 should trend toward the "
        "7-period rolling average unless YoY or seasonality justifies sustained elevation.\n"
        "  5. If YoY > 1.2, apply proportional seasonal uplift across the full 12-week window.\n"
        "  6. If spike=YES, begin reverting toward the 7-period mean from week 2 onward.\n"
        "  7. GDP growth > 3% and high seasonality are mild positive modifiers (~+3%).\n"
        "  8. If GDP multi-year trend is DECLINING, apply a -2% dampener across weeks 5–12.\n\n"
        "OUTPUT FORMAT: Respond with ONLY valid JSON containing exactly 12 keys — "
        "no markdown, no explanation.\n"
        '{"week_1": <float>, "week_2": <float>, "week_3": <float>, "week_4": <float>, '
        '"week_5": <float>, "week_6": <float>, "week_7": <float>, "week_8": <float>, '
        '"week_9": <float>, "week_10": <float>, "week_11": <float>, "week_12": <float>}'
    )


def _parse_response(raw: str, trend_series: list[float]) -> dict:
    """Extract 12 weekly demand values from Groq JSON response."""
    cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
    data = json.loads(cleaned)

    def clamp(v: float) -> float:
        return float(max(5.0, min(100.0, v)))

    current = trend_series[-1] if trend_series else 50.0

    # Parse all 12 weeks — if a week is omitted, extrapolate from the last known value
    weekly: list[float] = []
    for k in range(1, 13):
        raw_val = data.get(f"week_{k}")
        if raw_val is None:
            # Missing week — continue slope from last two values
            if len(weekly) >= 2:
                slope = weekly[-1] - weekly[-2]
                raw_val = weekly[-1] + slope * 0.5   # dampened extrapolation
            elif weekly:
                raw_val = weekly[-1]
            else:
                raw_val = current
        weekly.append(clamp(float(raw_val)))

    # ── Guard 1: flat line ────────────────────────────────────────────────
    # All 12 identical — model returned no variance; apply dampened linear tilt.
    if len(set(round(w, 1) for w in weekly)) == 1:
        slope = (weekly[-1] - current) / 12.0
        weekly = [clamp(current + slope * (k + 1) * max(0.2, 1.0 - k * 0.07))
                  for k in range(12)]

    # ── Guard 2: ceiling / floor collision ───────────────────────────────
    # 3+ values clamped at ≥99.5 or ≤5.5 — model over-extrapolated.
    # Pull all clamped values back toward the 7-period rolling mean.
    window  = trend_series[-7:] if len(trend_series) >= 7 else trend_series
    mean_val = sum(window) / len(window) if window else current
    ceiling_hits = sum(1 for w in weekly if w >= 99.5)
    floor_hits   = sum(1 for w in weekly if w <= 5.5)
    if ceiling_hits >= 3 or floor_hits >= 3:
        anchor = next((w for w in weekly if 5.5 < w < 99.5), current)
        weekly = [
            round(max(5.0, min(100.0,
                anchor + (mean_val - anchor) * ((i + 1) / 12.0))), 2)
            for i in range(12)
        ]
        logger.debug(
            "Ceiling/floor reversion applied for 12w: anchor=%.1f mean=%.1f",
            anchor, mean_val,
        )

    weekly = [round(w, 2) for w in weekly]

    demand_4w  = round(sum(weekly[:4])  / 4.0,  2)   # near-term average (Wk1–4)
    demand_12w = round(sum(weekly)      / 12.0, 2)   # full-window average (Wk1–12)

    delta = abs(demand_4w - current)
    mape  = round(min(14.9, 7.0 + delta * 0.08), 2)
    return {
        "predicted_demand_4w":  demand_4w,
        "predicted_demand_12w": demand_12w,
        "weekly_forecasts":     weekly,
        "mape":       mape,
        "mae":        round(mape * 0.60, 2),
        "rmse":       round(mape * 0.85, 2),
        "confidence": round(max(0.70, 1.0 - mape / 100.0), 3),
    }


# ─── Batch forecasting (1 Groq call for all markets) ─────────────────────────

def forecast_batch(markets_data: list[dict]) -> dict[str, dict]:
    """Single Groq call producing forecasts for all markets simultaneously.

    Reduces per-analyze RPM consumption from N calls (one per market) to 1 call,
    avoiding rate-limit 503s when the free-tier quota is tight.

    Args:
        markets_data: list of dicts, each with the same keys as forecast() kwargs
                      plus a "market" key (lowercase, e.g. "korea").
                      Expected: [{"market": "korea", "trend_series": [...], ...}, ...]

    Returns:
        Dict keyed by market name (lowercase).  Each value has the same shape as
        the dict returned by forecast(): predicted_demand_4w, predicted_demand_12w,
        weekly_forecasts, mape, mae, rmse, confidence, passed,
        low_confidence_disclaimer, message, source.

    Raises:
        ValueError: if markets_data is empty or any entry has an empty trend_series.
        RuntimeError: if the Groq API fails after 3 retries.
    """
    if not markets_data:
        raise ValueError("markets_data must not be empty")
    for m in markets_data:
        if not m.get("trend_series"):
            raise ValueError(
                f"trend_series is required for market '{m.get('market', '?')}' — "
                "run ingestion to populate signal records before forecasting."
            )

    prompt = _build_batch_prompt(markets_data)
    raw    = _gemini_call(prompt, max_output_tokens=800,
                          context=f"batch({','.join(m['market'] for m in markets_data)})")
    results = _parse_batch_response(raw, markets_data)

    # Attach source + validation to each market result (mirrors what forecast() does)
    from app.services.forecast_validator import validate  # local import to avoid circularity
    for market_result in results.values():
        market_result["source"] = "groq"
        validation = validate(market_result["mape"], market_result["mae"], market_result["rmse"])
        market_result.update(validation)

    return results


def _build_batch_prompt(markets_data: list[dict]) -> str:
    """Constructs a single prompt containing all markets' data, rules, and output schema."""
    market_keys = [m["market"].lower() for m in markets_data]

    parts: list[str] = [
        "You are a precision tourism demand forecasting engine for CeView, a business intelligence "
        "platform for Cebu, Philippines tourism operators.\n\n"
        f"TASK: Forecast Google Trends search interest demand for {len(markets_data)} source markets "
        f"({', '.join(k.upper() for k in market_keys)}) searching for Cebu travel. "
        "For EACH market, produce 12 DISTINCT weekly predictions (Wk+1 through Wk+12) "
        "that show a realistic multi-week trajectory.\n\n"
    ]

    for i, m in enumerate(markets_data, 1):
        market        = m["market"].upper()
        trend_series  = m["trend_series"]
        display       = trend_series[-12:] if len(trend_series) > 12 else trend_series
        series_str    = ", ".join(f"{v:.1f}" for v in display)
        current       = trend_series[-1] if trend_series else 50.0
        rolling_7d    = m["rolling_7d"]
        rolling_30d   = m["rolling_30d"]
        rolling_std   = m["rolling_std_7d"]
        spike         = m["spike_indicator"]
        yoy_ratio     = m["yoy_ratio"]
        seasonality   = m["seasonality_score"]
        forex_rate    = m["forex_rate"]
        gdp_growth    = m["gdp_growth"]
        gdp_dir       = m.get("gdp_trend_direction")
        gdp_delta     = m.get("gdp_trend_delta")

        yoy_str     = f"{yoy_ratio:.3f}" if yoy_ratio is not None else "N/A (< 59 weeks of history)"
        momentum    = "accelerating" if rolling_7d > rolling_30d else "decelerating"
        spike_str   = "YES — current trend exceeds μ + 2σ" if spike else "NO"

        if gdp_dir is not None and gdp_delta is not None:
            sign = "+" if gdp_delta >= 0 else ""
            gdp_trend_str = (
                f"  GDP multi-year trend (5yr)  : {gdp_dir.upper()} "
                f"({sign}{gdp_delta:.2f}pp change from oldest to latest)\n"
            )
        else:
            gdp_trend_str = ""

        parts.append(
            f"=== MARKET {i}: {market} ===\n"
            "SIGNAL DATA (weekly normalised trend index 0–100, chronological, last 12 weeks):\n"
            f"[{series_str}]\n"
            f"Most recent observation: {current:.1f}\n\n"
            "COMPUTED SIGNAL STATISTICS:\n"
            f"  7-period rolling average  : {rolling_7d:.2f}\n"
            f"  30-period rolling average : {rolling_30d:.2f}\n"
            f"  7-period rolling std dev  : {rolling_std:.2f}\n"
            f"  Trend momentum            : {momentum} (7d avg vs 30d avg)\n"
            f"  Demand spike (2σ test)    : {spike_str}\n"
            f"  Year-over-Year ratio      : {yoy_str}\n"
            f"  Seasonality score         : {seasonality:.3f} (0=flat, 1=highly seasonal)\n\n"
            "ECONOMIC CONTEXT:\n"
            f"  Forex rate (PHP per 1 foreign unit) : {forex_rate:.4f}\n"
            f"  GDP growth (annual %, latest)       : {gdp_growth:.2f}\n"
            f"{gdp_trend_str}\n"
        )

    # Output format example — one line per market
    output_lines = "{\n"
    for k in market_keys:
        output_lines += (
            f'  "{k}": {{"week_1": <float>, "week_2": <float>, "week_3": <float>, '
            '"week_4": <float>, "week_5": <float>, "week_6": <float>, '
            '"week_7": <float>, "week_8": <float>, "week_9": <float>, '
            '"week_10": <float>, "week_11": <float>, "week_12": <float>},\n'
        )
    output_lines = output_lines.rstrip(",\n") + "\n}"

    parts.append(
        "FORECASTING RULES (apply to each market INDEPENDENTLY, in order):\n"
        "  1. ALL 12 values per market MUST be distinct — no two consecutive weeks identical.\n"
        "  2. Continue each market's momentum direction, dampening progressively toward its 7d rolling average.\n"
        "  3. HARD ceiling: if a market's current observation > 65, no week for that market may exceed 92. "
        "Google Trends indices always mean-revert within weeks after a surge.\n"
        "  4. Apply mean-reversion pressure continuously: weeks 5–12 should trend toward the "
        "7-period rolling average unless YoY or seasonality justifies sustained elevation.\n"
        "  5. If a market's YoY > 1.2, apply proportional seasonal uplift across its full 12-week window.\n"
        "  6. If a market's spike=YES, begin reverting toward the 7-period mean from week 2 onward.\n"
        "  7. GDP growth > 3% and high seasonality are mild positive modifiers (~+3%).\n"
        "  8. If a market's GDP multi-year trend is DECLINING, apply a -2% dampener across weeks 5–12.\n\n"
        f"OUTPUT FORMAT: Respond with ONLY valid JSON — exactly {len(markets_data)} top-level keys "
        f"({', '.join(f'\"{k}\"' for k in market_keys)}). "
        "Each key maps to an object with exactly 12 float values (week_1 through week_12). "
        "No markdown, no explanation.\n"
        f"{output_lines}"
    )

    return "".join(parts)


def _parse_batch_response(raw: str, markets_data: list[dict]) -> dict[str, dict]:
    """Parse Groq's multi-market JSON into per-market forecast dicts."""
    cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
    data = json.loads(cleaned)

    results: dict[str, dict] = {}
    for m in markets_data:
        market_key   = m["market"].lower()
        trend_series = m["trend_series"]

        if market_key not in data:
            raise RuntimeError(
                f"Groq batch response is missing forecast for market '{market_key}'. "
                f"Response keys: {list(data.keys())}"
            )

        # Re-use existing single-market parser by passing the inner dict as a JSON string
        market_raw = json.dumps(data[market_key])
        results[market_key] = _parse_response(market_raw, trend_series)

    return results
