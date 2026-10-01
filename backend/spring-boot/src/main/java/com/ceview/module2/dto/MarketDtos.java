package com.ceview.module2.dto;

import java.util.List;

/**
 * Wire shapes for Module 2 / Market Radar. Mirrors the frontend
 * `Market`, `Airline`, and `ChartDataPoint` types in `frontend/types.ts` so the
 * React views can render without remapping.
 */
public class MarketDtos {

    public record ChartDataPointDto(
        String week,
        /** Monday starting this persisted ISO-8601 week; null only for legacy rows. */
        String weekStartDate,
        Double history,
        Double forecast,
        /** Measured value only; forecast weeks deliberately remain null. */
        Double seasonality,
        double spike
    ) {}

    /**
     * One carrier on the route. {@code direct} is now per-carrier (H-21 /
     * M2-UI-088) — read from {@code tbl_market_route_reference.airlines_json},
     * falling back to the route-level flag when a carrier row omits it.
     */
    public record AirlineDto(
        String name,
        String code,
        String frequency,
        boolean direct
    ) {}

    // ─── Economic trend-series DTOs ──────────────────────────────────────────

    /**
     * One year of annual GDP growth for the trend chart.
     * Maps to {@code ExternalMarketDataClient.GdpTrendPoint}.
     */
    public record GdpTrendPointDto(int year, double value) {}

    /**
     * One month of forex rate for the trend chart.
     * Maps to {@code ExternalMarketDataClient.ForexTrendPoint}.
     *
     * @param date  ISO month string "YYYY-MM"
     * @param value PHP per 1 unit of the foreign currency (contract §1 canonical unit)
     */
    public record ForexTrendPointDto(String date, double value) {}

    // ─── Market DTO ──────────────────────────────────────────────────────────

    public record MarketDto(
        String id,
        int rank,
        String name,
        String city,
        int matchScore,
        String directive,
        boolean directFlight,
        String flightHours,
        int distanceKm,
        String nearestAirport,
        String destinationAirport,
        /**
         * Route-accessibility score on a 1–10 scale (H-14), computed by
         * {@code ForecastingService.computeAccessibility} from the versioned
         * route reference — never a flat {@code direct ? 9 : 6} literal.
         * Weighting: base 6.0 direct / 3.0 stopover; {@code +2·min(1, weeklyFrequency/14)}
         * (14 = the busiest tracked route); {@code +2·(1 − min(1, blockHours/18))}
         * (18h ≈ the practical long-haul ceiling); clamped to [1, 10] and rounded.
         */
        int accessibilityScore,
        int flightFrequency,
        /** Lower bound of the round-trip fare range, PHP (tbl_market_route_reference.avg_fare_min_php). */
        int fareMinPhp,
        /** Upper bound of the round-trip fare range, PHP (tbl_market_route_reference.avg_fare_max_php). */
        int fareMaxPhp,
        /** Provenance of the fare/route figures (tbl_market_route_reference.source), e.g. "static_reference_v1". */
        String fareSource,
        /** ISO date the fare/route figures were last validated (tbl_market_route_reference.valid_from), or null. */
        String fareAsOf,
        List<AirlineDto> airlines,
        List<String> peakMonths,
        /**
         * How {@code peakMonths} was produced (H-19): {@code "seasonal_history"}
         * when ≥52 weekly signal rows across ≥8 calendar months let
         * {@code ForecastingService.derivePeakMonths} rank them by mean
         * seasonality; otherwise {@code "reference"} (the route table's
         * {@code peak_months_json}). The UI labels the two apart.
         */
        String peakMonthsSource,
        String economyInsight,
        String seasonalityInsight,
        List<ChartDataPointDto> chartData,
        /** GDP growth time-series (up to 5 years, chronological). Nullable — absent from stub responses. */
        List<GdpTrendPointDto> gdpTrend,
        /** Forex rate time-series (up to 12 months, chronological). Nullable — absent from stub responses. */
        List<ForexTrendPointDto> forexTrend,
        /** ISO currency code — MarketEconomicTrend.currencyCode. */
        String currency,
        /** Human label for the forex axis, e.g. "PHP per 1 KRW". */
        String forexLabel,
        /** MarketScore.gdpPerCapitaGrowth, falling back to MarketEconomicTrend.gdpLatest. */
        double gdpValue,
        /** MarketScore.forexVsPhp, falling back to MarketEconomicTrend.forexLatest. */
        double forexValue,
        /** MarketScore.seasonalityScore. */
        double seasonalityScore,
        /**
         * Year-over-year arrivals ratio (tbl_market_score.yoy_ratio, added in V20).
         * Nullable: rows written before V20 have no value, so the frontend's
         * Seasonal Patterns tab keeps an explicit "not available" state.
         */
        Double yoyRatio,
        /** MarketScore.spikeIndicator. */
        boolean spikeIndicator,
        /** ISO-8601 timestamp of the newest measured signal behind this market, or null. */
        String dataAsOf,
        /** True when dataAsOf is older than EnrichedSequenceBuilder.STALE_AFTER. */
        boolean dataStale,
        /** Last failed ingestion/trend refresh for this profile/category/market, or null. */
        String dataStaleCause,
        /**
         * Which tier produced {@code gdpValue}: {@code "live"}, {@code "last_known_good"},
         * or {@code "unknown"} (a pre-Step-6 persisted row with no tag). Null when no
         * economic trend has ever been fetched for this market (Step 6, C-06, H-18).
         */
        String gdpSource,
        /** Which tier produced {@code forexValue}. See {@link #gdpSource}. */
        String forexSource,
        /**
         * ISO-8601 timestamp of the OLDER of the two macro readings behind gdpValue/
         * forexValue — the conservative "as of" bound for the pair, since each can now
         * age independently. Null when neither has ever been fetched.
         */
        String macroAsOf,
        /** Current demand-window alert state for this category/market, or null when none exists. */
        String surgeLevel,
        /** Measured forecast uplift over the rolling baseline; null when no active demand window exists. */
        Double upliftPct,
        /** First forecast week that crosses the demand-window threshold, or null. */
        String windowOpenDate,
        /** Exact FastAPI economic scorer: xgboost or linear fallback. */
        String scorer,
        /** ForecastResult.forecastConfidence for the four-week forecast (0–1). */
        double forecastConfidence,
        /** True when the forecast cannot yet be treated as validated. */
        boolean lowConfidence,
        /** Exact engine identifier, including stub-v1 when the placeholder made the series. */
        String forecastSource
    ) {}

    public record MarketsResponse(List<MarketDto> markets) {}
}
