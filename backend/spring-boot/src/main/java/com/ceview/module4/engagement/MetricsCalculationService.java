package com.ceview.module4.engagement;

import com.ceview.module4.dto.AnalyticsDtos.*;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.ArrayList;

/**
 * Submodule 4.1 — Campaign Engagement Metrics.
 *
 * <p>KPI + funnel computation, default demo metrics, business-impact funnel
 * transition ranking, and synthetic time-series generation for the report agent.
 */
@Service
public class MetricsCalculationService {

    /**
     * Compute the five KPI metrics and the four-stage funnel from raw inputs.
     * All null inputs are treated as zero (safe for default-metrics usage).
     */
    public MetricsResponse compute(ManualIngestRequest in) {
        int impressions  = nz(in.impressions());
        int clicks       = nz(in.clicks());
        double adSpend   = nz(in.adSpend());
        double revenue   = nz(in.revenue());
        int bookings     = nz(in.bookings());
        int newCustomers = nz(in.newCustomers());

        double ctr      = clicks == 0       ? 0 : (double) clicks / impressions * 100.0;
        double cpc      = clicks == 0       ? 0 : adSpend / clicks;
        double convRate = clicks == 0       ? 0 : (double) bookings / clicks * 100.0;
        double roas     = adSpend == 0      ? 0 : revenue / adSpend;
        double cac      = newCustomers == 0 ? 0 : adSpend / newCustomers;

        var metrics = new Metrics(
            new MetricCard(round(ctr, 1),      "%",  1.2,  true),
            new MetricCard(round(cpc, 2),      "₱", -0.05, true),
            new MetricCard(round(roas, 1),     "x",  0.4,  true),
            new MetricCard(round(convRate, 1), "%", -0.5,  false),
            new MetricCard(round(cac, 2),      "₱",  5.0,  false)
        );

        long imp  = impressions;
        long clk  = clicks;
        long conv = nz(in.conversions());
        long book = bookings;
        var funnel = List.of(
            new FunnelStage("Impressions", imp,  null),
            new FunnelStage("Clicks",      clk,  dropoff(imp,  clk)),
            new FunnelStage("Conversions", conv, dropoff(clk,  conv)),
            new FunnelStage("Bookings",    book, dropoff(conv, book))
        );

        return new MetricsResponse(metrics, funnel);
    }

    /**
     * Default campaign metrics for the EngagementMetricsBoard and as a shared
     * baseline for the PES (4.2) and prescriptive report (4.3) submodules.
     *
     * @param weeks Analysis window — 4 (default) or 8. Scales demo defaults proportionally.
     */
    public MetricsResponse defaultMetrics(int weeks) {
        int scale = (weeks == 8) ? 2 : 1;
        return compute(new ManualIngestRequest(
                150_000 * scale, 7_200 * scale, 5_000.0 * scale, 16_000.0 * scale,
                350 * scale, 180 * scale, 80 * scale, null, null
        ));
    }

    /**
     * Derive the three funnel transitions from a computed funnel stage list
     * and rank them by business impact (not solely by raw drop-rate percentage).
     *
     * <p>Business-impact priority order for a hospitality / tourism MSME:
     * <ol>
     *   <li><b>Clicks → Conversions</b> — the primary revenue bottleneck; every
     *       non-converting click is wasted spend with highest actionability.</li>
     *   <li><b>Conversions → Bookings</b> — captures high-intent leads that fell
     *       off at the final commitment step.</li>
     *   <li><b>Impressions → Clicks</b> — large absolute drop expected (normal
     *       CTR behaviour); ad creative issue, lower direct-revenue impact.</li>
     * </ol>
     *
     * @param funnel 4-element list: [Impressions, Clicks, Conversions, Bookings]
     * @return ordered list of transition maps ready for the FastAPI report payload
     */
    public List<Map<String, Object>> computeFunnelTransitions(List<FunnelStage> funnel) {
        // funnel.get(0) = Impressions, [1] = Clicks, [2] = Conversions, [3] = Bookings
        double impToClk  = absDropPct(funnel.get(0).value(), funnel.get(1).value());
        double clkToConv = absDropPct(funnel.get(1).value(), funnel.get(2).value());
        double convToBook = absDropPct(funnel.get(2).value(), funnel.get(3).value());

        // Business-impact priority: Clk→Conv > Conv→Book > Imp→Clk
        return List.of(
            Map.of("stage", "Clicks → Conversions",  "dropRate", fmt(clkToConv)),
            Map.of("stage", "Conversions → Bookings", "dropRate", fmt(convToBook)),
            Map.of("stage", "Impressions → Clicks",   "dropRate", fmt(impToClk))
        );
    }

    /**
     * Build a synthetic weekly time-series suitable for the pes_report_agent.
     *
     * <p>The agent expects arrays in <b>reverse chronological order</b>:
     * index [0] = current (most recent) week, last index = baseline (first) week.
     *
     * <p>Since CeView stores only aggregate-period totals (not per-week rows),
     * we model history as a linear interpolation from a weaker baseline to the
     * current values — reflecting a typical "improving over the campaign window"
     * trajectory.  Baseline assumptions per metric:
     * <ul>
     *   <li>CTR,&nbsp;ROAS,&nbsp;CR — baseline ≈ 75 % of current (trending up = good)</li>
     *   <li>CPC,&nbsp;CAC          — baseline ≈ 130 % of current (trending down = good)</li>
     * </ul>
     *
     * @param current computed {@link MetricsResponse} for the selected window
     * @param weeks   4 or 8 — determines series length
     * @return map keyed by metric name, each value a {@code List<Double>} of length {@code weeks}
     */
    public Map<String, Object> buildTimeSeries(MetricsResponse current, int weeks) {
        double ctr  = current.metrics().ctr().value();
        double cpc  = current.metrics().cpc().value();
        double roas = current.metrics().roas().value();
        double cr   = current.metrics().convRate().value();
        double cac  = current.metrics().cac().value();

        // Positive-trend metrics: current > baseline
        // Cost metrics: current < baseline (efficiency improved over campaign)
        return Map.of(
            "CTR",  interpolate(ctr,  round(ctr  * 0.75, 2), weeks),
            "CPC",  interpolate(cpc,  round(cpc  * 1.30, 2), weeks),
            "ROAS", interpolate(roas, round(roas * 0.75, 2), weeks),
            "CR",   interpolate(cr,   round(cr   * 0.78, 2), weeks),
            "CAC",  interpolate(cac,  round(cac  * 1.30, 2), weeks)
        );
    }

    /**
     * Linearly interpolate {@code weeks} values from {@code current} (index 0)
     * to {@code baseline} (index weeks-1).
     */
    private List<Double> interpolate(double current, double baseline, int weeks) {
        var result = new ArrayList<Double>(weeks);
        for (int i = 0; i < weeks; i++) {
            double t = (weeks <= 1) ? 0.0 : (double) i / (weeks - 1);
            result.add(round(current + t * (baseline - current), 2));
        }
        return result;
    }

    // ── private helpers ────────────────────────────────────────────────────────

    private static int    nz(Integer v) { return v == null ? 0 : v; }
    private static double nz(Double v)  { return v == null ? 0.0 : v; }

    private static String dropoff(long prev, long curr) {
        if (prev == 0) return "0%";
        double pct = ((double) curr - prev) / prev * 100.0;
        return String.format("%.1f%%", pct);
    }

    private static double absDropPct(long prev, long curr) {
        if (prev == 0) return 0.0;
        return Math.abs(((double) curr - prev) / prev * 100.0);
    }

    private static String fmt(double pct) {
        return String.format("%.1f%%", pct);
    }

    private static double round(double v, int p) {
        double f = Math.pow(10, p);
        return Math.round(v * f) / f;
    }
}
