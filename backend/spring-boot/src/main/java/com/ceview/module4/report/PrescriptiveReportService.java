package com.ceview.module4.report;

import com.ceview.module4.dto.AnalyticsDtos.*;
import com.ceview.module4.pes.PESComputationService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Submodule 4.3 — AI-Generated Prescriptive Performance Report.
 *
 * <p>Holds the FR4.26 deterministic fallbacks used when the FastAPI AI services
 * ({@code /internal/report/generate} and {@code /internal/pes-analysis/generate})
 * are unavailable, so the REST responses are always fully populated.
 */
@Service
public class PrescriptiveReportService {

    private final PESComputationService pesSvc;

    public PrescriptiveReportService(PESComputationService pesSvc) {
        this.pesSvc = pesSvc;
    }

    /**
     * FR4.26 rule-based report fallback — used when FastAPI {@code /report/generate} is down.
     * Identifies the lowest-weighted metric as the primary bottleneck and returns
     * a hardcoded-but-contextual three-stage diagnostic so the UI never crashes.
     */
    public Map<String, Object> buildRuleBasedReport(
            MetricsResponse mr, List<Map<String, Object>> transitions) {

        PesResponse pes       = pesSvc.compute(mr.metrics());
        double      lowestPes = Double.MAX_VALUE;
        String      weakMetric = "Conversion Rate";

        // Find the metric with the lowest PES contribution
        for (PesBreakdownItem item : pes.breakdown()) {
            if (item.contribution() < lowestPes) {
                lowestPes  = item.contribution();
                weakMetric = item.metric();
            }
        }
        final String weak = weakMetric;

        var diagnostics = new java.util.ArrayList<Map<String, Object>>();
        var recommendations = new java.util.ArrayList<Map<String, Object>>();
        String[] ranks    = {"Weakest", "Moderate", "Alright"};
        String[] urgency  = {"Most Urgent", "Urgent", "Not Very Urgent"};
        String[] insights = {
            "Visitors who clicked showed initial interest but the landing page failed to "
                + "sustain engagement — a mismatch between ad promise and destination experience.",
            "High-intent leads reached the booking step but abandoned due to form friction "
                + "and insufficient social proof.",
            "Broad audience targeting resulted in a high raw drop but CTR remains within "
                + "acceptable range for awareness-stage campaigns.",
        };
        String[] titles  = {
            "Align Landing Page to Ad Promise",
            "Streamline the Booking Conversion Path",
            "Sharpen Ad Creative Targeting",
        };
        String[] actions = {
            "Mirror headline copy from your best-performing ad onto the landing page hero "
                + "and reduce the enquiry form to Name + Phone only.",
            "Add trust signals (reviews, booking counter) above the CTA and send an "
                + "abandoned-booking SMS within 2 hours.",
            "Shift 25 % of ad spend from broad audiences to retargeting pools of past "
                + "website visitors and confirmed-booker lookalikes.",
        };

        for (int i = 0; i < Math.min(3, transitions.size()); i++) {
            String stage = (String) transitions.get(i).get("stage");
            String drop  = (String) transitions.get(i).get("dropRate");
            diagnostics.add(Map.of(
                    "stage", stage, "rank", ranks[i],
                    "dropRate", drop, "insight", insights[i]));
            recommendations.add(Map.of(
                    "stage", stage, "urgency", urgency[i],
                    "title", titles[i], "action", actions[i]));
        }

        String summary = String.format(
                "Over the campaign period your ads generated strong top-of-funnel awareness "
                + "but a significant efficiency gap emerged mid-funnel. The %s metric "
                + "(PES weight contribution: %.2f) is the primary bottleneck. "
                + "Focus optimisation on the '" + (transitions.isEmpty() ? "Clicks → Conversions"
                        : transitions.get(0).get("stage")) + "' transition first.",
                weak, lowestPes);

        return Map.of(
                "executiveSummary",    summary,
                "funnelDiagnostics",   diagnostics,
                "recommendations",     recommendations,
                "recommendedPlatform", "Naver Blog"
        );
    }

    /** FR4.26 offline payload for {@code /pes-analysis} when FastAPI is down. */
    public Map<String, Object> buildOfflinePesAnalysisFallback() {
        return Map.of(
                "report_data", Map.of(
                        "metric_conditions",  List.of(),
                        "cross_metric_logic", Map.of(
                                "relationships",
                                "Analysis unavailable — AI service is currently offline.",
                                "insights", ""),
                        "ranked_weaknesses", List.of()
                ),
                "metadata", Map.of(
                        "final_score",        0,
                        "total_iterations",   0,
                        "needs_human_review", true,
                        "warning_message",
                        "WARNING: PES analysis agent is offline. Check GOOGLE_API_KEY and restart."
                )
        );
    }
}
