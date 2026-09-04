package com.ceview.module2.dto;

import java.util.List;

/**
 * Wire shapes for Module 2 / Home notifications. Mirrors the frontend
 * `Notification`, `KeywordTrend`, and `ContentStrategy` types so the
 * HomeView and any future "Market Analyzer" modal render without remapping.
 *
 * `details` is nullable — FastAPI may emit lightweight notifications that
 * have only the summary fields populated.
 */
public class NotificationDtos {

    public record KeywordTrendDto(
        String keyword,
        int volume,
        int growth,
        String market
    ) {}

    public record GeneratedCaptionDto(
        String platform,
        String text,
        List<String> hashtags
    ) {}

    public record VisualDirectionDto(
        String platform,
        String direction
    ) {}

    public record ContentStrategyDto(
        String platformRecommendation,
        List<GeneratedCaptionDto> generatedCaptions,
        List<VisualDirectionDto> visualDirections
    ) {}

    public record TopInterestDto(String name, int score) {}

    public record StrategicInsightsDto(
        String trendAlignment,
        String connectivity,
        String economicValue
    ) {}

    public record DetailsDto(
        int projectedArrivals,
        double arrivalGrowth,
        List<TopInterestDto> topInterests,
        List<String> segments,
        StrategicInsightsDto strategicInsights,
        List<KeywordTrendDto> keywordData,
        ContentStrategyDto contentStrategy
    ) {}

    public record NotificationDto(
        String id,
        String date,
        String title,
        String market,
        String marketId,
        String trend,
        boolean isRead,
        DetailsDto details,
        /** The signal-grid category this alert came from; null for pre-V20 rows. */
        String category,
        /** tbl_demand_alert.alert_level — "INFO" or "WARNING". Drives the surge filter. */
        String alertLevel,
        /** tbl_demand_alert.alert_message — the operator-facing directive. */
        String alertMessage
    ) {}

    public record NotificationsResponse(List<NotificationDto> notifications) {}
}
