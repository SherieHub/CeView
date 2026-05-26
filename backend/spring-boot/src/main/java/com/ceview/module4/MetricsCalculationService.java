package com.ceview.module4;

import com.ceview.module4.dto.AnalyticsDtos.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MetricsCalculationService {

    /** Direct computation of the five funnel metrics per SDD §4.1. */
    public MetricsResponse compute(ManualIngestRequest in) {
        int impressions = nz(in.impressions());
        int clicks = nz(in.clicks());
        double adSpend = nz(in.adSpend());
        double revenue = nz(in.revenue());
        int bookings = nz(in.bookings());
        int newCustomers = nz(in.newCustomers());

        double ctr = clicks == 0 ? 0 : (double) clicks / impressions * 100.0;
        double cpc = clicks == 0 ? 0 : adSpend / clicks;
        double convRate = clicks == 0 ? 0 : (double) bookings / clicks * 100.0;
        double roas = adSpend == 0 ? 0 : revenue / adSpend;
        double cac = newCustomers == 0 ? 0 : adSpend / newCustomers;

        var metrics = new Metrics(
            new MetricCard(round(ctr, 1), "%", 1.2, true),
            new MetricCard(round(cpc, 2), "₱", -0.05, true),
            new MetricCard(round(roas, 1), "x", 0.4, true),
            new MetricCard(round(convRate, 1), "%", -0.5, false),
            new MetricCard(round(cac, 2), "₱", 5.0, false)
        );

        long imp = impressions;
        long clk = clicks;
        long conv = nz(in.conversions());
        long book = bookings;
        var funnel = List.of(
            new FunnelStage("Impressions", imp, null),
            new FunnelStage("Clicks", clk, dropoff(imp, clk)),
            new FunnelStage("Conversions", conv, dropoff(clk, conv)),
            new FunnelStage("Bookings", book, dropoff(conv, book))
        );

        return new MetricsResponse(metrics, funnel);
    }

    private static int nz(Integer v) { return v == null ? 0 : v; }
    private static double nz(Double v) { return v == null ? 0.0 : v; }

    private static String dropoff(long prev, long curr) {
        if (prev == 0) return "0%";
        double pct = ((double) curr - prev) / prev * 100.0;
        return String.format("%.1f%%", pct);
    }

    private static double round(double v, int p) {
        double f = Math.pow(10, p);
        return Math.round(v * f) / f;
    }
}
