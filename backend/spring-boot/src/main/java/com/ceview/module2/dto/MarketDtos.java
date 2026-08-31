package com.ceview.module2.dto;

import java.util.List;

/**
 * Wire shapes for Module 2 / Market Radar. Mirrors the frontend
 * `Market`, `Airline`, and `ChartDataPoint` types in ceview/types.ts so the
 * React views can render without remapping.
 */
public class MarketDtos {

    public record ChartDataPointDto(
        String week,
        Double history,
        Double forecast,
        double seasonality,
        double forex,
        double gdp,
        double spike
    ) {}

    public record AirlineDto(
        String name,
        String code,
        String frequency,
        boolean direct,
        String duration,
        String tier
    ) {}

    // ─── Economic trend-series DTOs ──────────────────────────────────────────

    /**
     * One year of annual GDP growth for the trend chart.
     * Maps to {@code ExternalMarketDataClient.GdpTrendPoint}.
     */
    public record GdpTrendPointDto(int year, double value) {}

    /**
     * One month of forex rate (foreign-currency units per PHP) for the trend chart.
     * Maps to {@code ExternalMarketDataClient.ForexTrendPoint}.
     *
     * @param date  ISO month string "YYYY-MM"
     * @param value foreign-currency units per PHP
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
        int accessibilityScore,
        int flightFrequency,
        String avgFlightPrice,
        List<AirlineDto> airlines,
        List<String> peakMonths,
        String economyInsight,
        String seasonalityInsight,
        List<ChartDataPointDto> chartData,
        /** GDP growth time-series (up to 5 years, chronological). Nullable — absent from stub responses. */
        List<GdpTrendPointDto> gdpTrend,
        /** Forex rate time-series (up to 12 months, chronological). Nullable — absent from stub responses. */
        List<ForexTrendPointDto> forexTrend,
        /** ISO country code for the flag glyph, derived from the market name. */
        String flag,
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
        boolean dataStale
    ) {}

    public record MarketsResponse(List<MarketDto> markets) {}
}
