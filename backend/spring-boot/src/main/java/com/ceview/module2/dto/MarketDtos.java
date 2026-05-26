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
        List<ChartDataPointDto> chartData
    ) {}

    public record MarketsResponse(List<MarketDto> markets) {}
}
