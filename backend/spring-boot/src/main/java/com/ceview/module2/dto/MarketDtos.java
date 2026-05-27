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
        List<ForexTrendPointDto> forexTrend
    ) {}

    public record MarketsResponse(List<MarketDto> markets) {}
}
