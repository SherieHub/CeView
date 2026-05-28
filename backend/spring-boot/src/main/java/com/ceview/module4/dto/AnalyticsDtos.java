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

    /**
     * One evaluated funnel transition — ranked from "Weakest" → "Alright"
     * by business impact (not solely by raw drop-rate percentage).
     *
     * <ul>
     *   <li>"Weakest"  — primary conversion bottleneck; most actionable</li>
     *   <li>"Moderate" — secondary concern; materially improvable</li>
     *   <li>"Alright"  — lowest-priority leak for this campaign period</li>
     * </ul>
     *
     * @param stage    Transition label  e.g. "Clicks → Conversions"
     * @param rank     "Weakest" | "Moderate" | "Alright"
     * @param dropRate Formatted absolute drop percentage e.g. "88.1%"
     * @param insight  AI one-sentence root-cause diagnosis for this transition
     */
    public record FunnelDiagnostic(
        String stage,
        String rank,
        String dropRate,
        String insight
    ) {}

    /**
     * A specific, actionable recommendation mapped 1-to-1 with a {@link FunnelDiagnostic}.
     *
     * <p>Urgency is strictly derived from the corresponding funnel rank:
     * <ul>
     *   <li>"Weakest"  → "Most Urgent"</li>
     *   <li>"Moderate" → "Urgent"</li>
     *   <li>"Alright"  → "Not Very Urgent"</li>
     * </ul>
     *
     * @param stage   Matches the corresponding {@link FunnelDiagnostic#stage()}
     * @param urgency "Most Urgent" | "Urgent" | "Not Very Urgent"
     * @param title   Short action title (≤ 8 words)
     * @param action  Concrete 1-sentence implementation step
     */
    public record RankedRecommendation(
        String stage,
        String urgency,
        String title,
        String action
    ) {}

    /**
     * Prescriptive report shape — Module 4 SDD §4.3.
     *
     * <p>All three funnel transitions are always evaluated and returned,
     * ranked from "Weakest" to "Alright". Every {@link FunnelDiagnostic}
     * has exactly one matching {@link RankedRecommendation} (same {@code stage} value).
     */
    public record PrescriptiveReport(
        String executiveSummary,
        List<FunnelDiagnostic> funnelDiagnostics,
        List<RankedRecommendation> recommendations,
        String recommendedPlatform
    ) {}

    /** Combined response for POST /manual — includes computed KPIs, funnel, and PES. */
    public record ManualIngestResponse(
        Metrics metrics,
        List<FunnelStage> funnel,
        PesResponse pes
    ) {}

    /** One week's campaign snapshot — used by GET /history for the trend line chart. */
    public record CampaignSnapshot(
        String periodStart,
        String periodEnd,
        double pesScore,
        String pesLabel,
        Double ctr,
        Double cpc,
        Double roas,
        Double convRate,
        Double cac
    ) {}

    /** Ordered list of weekly snapshots (chronological) for the trend line chart. */
    public record CampaignHistoryResponse(List<CampaignSnapshot> snapshots) {}
}
