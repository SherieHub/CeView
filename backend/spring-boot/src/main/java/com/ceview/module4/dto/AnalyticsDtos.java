package com.ceview.module4.dto;

import java.util.List;

public class AnalyticsDtos {

    public record MetricCard(double value, String unit, double trend, boolean isPositive) {}

    public record Metrics(
        MetricCard ctr,
        MetricCard cpc,
        MetricCard roas,
        MetricCard convRate,
        MetricCard cac
    ) {}

    public record FunnelStage(String stage, long value, String dropoff) {}

    public record MetricsResponse(Metrics metrics, List<FunnelStage> funnel) {}

    public record ManualIngestRequest(
        Integer impressions,
        Integer clicks,
        Double adSpend,
        Double revenue,
        Integer conversions,
        Integer bookings,
        Integer newCustomers,
        String periodStart,
        String periodEnd
    ) {}

    public record PesBreakdownItem(String metric, String weight, double contribution) {}

    public record PesResponse(
        double overallScore,
        String label,
        List<PesBreakdownItem> breakdown
    ) {}

    public record PrescriptiveReport(
        String executiveSummary,
        String lowestMetric,
        String lowestMetricMeaning,
        List<String> recommendations,
        List<String> otherAreasImprove,
        WeakStage weakestStage,
        List<WeakStage> secondaryLeaks
    ) {
        public record WeakStage(String name, String dropoff, String diagnosis) {}
    }
}
