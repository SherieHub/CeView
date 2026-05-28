package com.ceview.module4;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module4.dto.AnalyticsDtos.*;
<<<<<<< HEAD
=======
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
>>>>>>> paldo
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
<<<<<<< HEAD
 * SDD §4 — Campaign Analytics & Reporting.
 *
 * <ul>
 *   <li>GET  /metrics         → MetricsResponse (KPIs + funnel); {@code ?weeks=4|8}</li>
 *   <li>POST /manual          → same shape, computed from operator-entered values</li>
 *   <li>GET  /pes/{id}        → PesResponse for PESComputationBoard; {@code ?weeks=4|8}</li>
 *   <li>POST /report          → PrescriptiveReport (new exhaustive funnel schema)</li>
 *   <li>GET  /report/{id}/pdf → binary PDF download</li>
 * </ul>
=======
 * SDD §4 — Campaign Analytics &amp; Reporting.
 *
 * <ul>
 *   <li>{@code GET  /metrics}          → MetricsResponse (KPIs + funnel); {@code ?weeks=4|8}</li>
 *   <li>{@code POST /manual}           → same shape, computed from operator-entered values;
 *                                        also persists to PostgreSQL and enriches PES via FastAPI</li>
 *   <li>{@code GET  /pes/{id}}         → PesResponse for PESComputationBoard; {@code ?weeks=4|8}</li>
 *   <li>{@code POST /report}           → PrescriptiveReport (exhaustive funnel diagnostics schema)</li>
 *   <li>{@code POST /pes-analysis}     → PES time-series deep-analysis via LangGraph agent</li>
 *   <li>{@code GET  /report/{id}/pdf}  → binary PDF download</li>
 * </ul>
 *
 * <h3>FR4.26 — Fallback Mechanism</h3>
 * Every call that delegates to FastAPI is wrapped in a {@code try-catch}.
 * If the AI microservice is unavailable (connection refused, timeout, 5xx):
 * <ol>
 *   <li>A warning is logged with the failure reason.</li>
 *   <li>Spring Boot falls back to its own rule-based computation ({@link PESComputationService}).</li>
 *   <li>The REST response is still fully populated — the UI never crashes.</li>
 * </ol>
>>>>>>> paldo
 */
@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

<<<<<<< HEAD
    private final MetricsCalculationService metricsSvc;
    private final PESComputationService pesSvc;
    private final AIInferenceGatewayService ai;

    public AnalyticsController(MetricsCalculationService m, PESComputationService p, AIInferenceGatewayService ai) {
        this.metricsSvc = m;
        this.pesSvc     = p;
        this.ai         = ai;
    }

=======
    private static final Logger log = LoggerFactory.getLogger(AnalyticsController.class);

    private final MetricsCalculationService  metricsSvc;
    private final PESComputationService      pesSvc;
    private final AIInferenceGatewayService  ai;
    private final CampaignRecordRepository   campaignRepo;

    public AnalyticsController(
            MetricsCalculationService metricsSvc,
            PESComputationService pesSvc,
            AIInferenceGatewayService ai,
            CampaignRecordRepository campaignRepo) {
        this.metricsSvc   = metricsSvc;
        this.pesSvc       = pesSvc;
        this.ai           = ai;
        this.campaignRepo = campaignRepo;
    }

    // ─── GET /metrics ─────────────────────────────────────────────────────────

>>>>>>> paldo
    /**
     * Default campaign metrics for the EngagementMetricsBoard.
     *
     * @param weeks Analysis window — 4 (default) or 8. Scales demo defaults proportionally.
     */
    @GetMapping("/metrics")
<<<<<<< HEAD
    public MetricsResponse metrics(@RequestParam(required = false, defaultValue = "4") int weeks) {
        int scale = (weeks == 8) ? 2 : 1;
        return metricsSvc.compute(new ManualIngestRequest(
            150_000 * scale, 7_200 * scale, 5_000.0 * scale, 16_000.0 * scale,
            350 * scale, 180 * scale, 80 * scale, null, null
        ));
    }

    /**
     * Compute metrics from operator-entered raw campaign values.
     */
    @PostMapping("/manual")
    public MetricsResponse manualIngest(@RequestBody ManualIngestRequest in) {
        return metricsSvc.compute(in);
    }

=======
    public MetricsResponse metrics(
            @RequestParam(required = false, defaultValue = "4") int weeks) {
        int scale = (weeks == 8) ? 2 : 1;
        return metricsSvc.compute(new ManualIngestRequest(
                150_000 * scale, 7_200 * scale, 5_000.0 * scale, 16_000.0 * scale,
                350 * scale, 180 * scale, 80 * scale, null, null
        ));
    }

    // ─── POST /manual ─────────────────────────────────────────────────────────

    /**
     * Compute metrics from operator-entered raw campaign values.
     *
     * <h4>Full pipeline (SDD §4.1):</h4>
     * <ol>
     *   <li>Compute KPIs locally via {@link MetricsCalculationService} (fast, synchronous).</li>
     *   <li>Persist raw data + KPIs to {@code tbl_campaign_records} via JPA.</li>
     *   <li>Forward the raw inputs to FastAPI {@code /internal/pes-compute/analyze}
     *       which applies Min-Max normalization, inversion, PES formula, and AI insights.</li>
     *   <li>Update the saved record with the FastAPI PES score.</li>
     *   <li><b>FR4.26 Fallback:</b> if FastAPI is unreachable, the PES is computed
     *       locally by {@link PESComputationService} and the record is still saved.</li>
     * </ol>
     *
     * @return {@link MetricsResponse} — the existing contract consumed by the React frontend
     *         (EngagementMetricsBoard, CustomerJourneyFunnel).  The PES enrichment is
     *         stored in the DB and surfaced separately by {@code GET /pes/{id}}.
     */
    @PostMapping("/manual")
    public MetricsResponse manualIngest(@RequestBody ManualIngestRequest in) {

        // ── 1. Local KPI computation ─────────────────────────────────────────
        MetricsResponse mr = metricsSvc.compute(in);

        // ── 2. Persist raw inputs + derived KPIs ─────────────────────────────
        CampaignRecord record = CampaignRecord.from(in);
        record.enrichWithKpis(
                mr.metrics().ctr().value(),
                mr.metrics().cpc().value(),
                mr.metrics().convRate().value(),
                mr.metrics().roas().value(),
                mr.metrics().cac().value()
        );
        campaignRepo.save(record);
        log.info("[Module4] campaign record saved id={}", record.getId());

        // ── 3. Forward to FastAPI PES compute + 4. Enrich DB record ──────────
        try {
            Map<String, Object> pesResult = ai.computePesFromRaw(buildRawPayload(in));

            double pesScore = ((Number) pesResult.getOrDefault("pes_score", 0.0)).doubleValue();
            String pesLabel = (String)  pesResult.getOrDefault("pes_label",  "");
            record.enrichWithPes(pesScore, pesLabel);
            campaignRepo.save(record);
            log.info("[Module4] FastAPI PES ok  id={}  score={}  label={}",
                     record.getId(), pesScore, pesLabel);

        } catch (Exception e) {
            // ── FR4.26 Fallback ────────────────────────────────────────────────
            log.warn("[Module4 FR4.26] FastAPI PES compute unavailable ({}); " +
                     "using Spring Boot rule-based PES fallback", e.getMessage());

            PesResponse fallback = pesSvc.compute(mr.metrics());
            record.enrichWithPes(fallback.overallScore(), fallback.label());
            campaignRepo.save(record);
            log.info("[Module4 FR4.26] fallback PES saved  id={}  score={}",
                     record.getId(), fallback.overallScore());
        }

        return mr;
    }

    // ─── GET /pes/{campaignId} ────────────────────────────────────────────────

>>>>>>> paldo
    /**
     * Promotional Effectiveness Score breakdown.
     *
     * @param weeks Analysis window — forwarded to default-metrics computation.
     */
    @GetMapping("/pes/{campaignId}")
<<<<<<< HEAD
    public PesResponse pes(@PathVariable String campaignId,
                           @RequestParam(required = false, defaultValue = "4") int weeks) {
        return pesSvc.compute(metrics(weeks).metrics());
    }

    /**
     * Generate a prescriptive performance report.
     *
     * <p>Enriches the incoming body with:
     * <ul>
     *   <li>Default KPI metrics (if not already present)</li>
     *   <li>Business-impact-ranked funnel transitions for the AI prompt</li>
     * </ul>
     * The enriched payload is forwarded to FastAPI {@code /internal/report/generate}.
     */
    @PostMapping("/report")
    public Map<String, Object> report(@RequestBody(required = false) Map<String, Object> body) {
        var payload = new HashMap<String, Object>(body == null ? Map.of() : body);

        // Pull the weeks hint from the request body (default 4)
        int weeks = 4;
        if (payload.get("weeks") instanceof Number n) {
            weeks = n.intValue();
        }

        // Ensure metrics are present — use computed defaults if the body didn't include them
        MetricsResponse mr = metrics(weeks);
        payload.putIfAbsent("metrics", mr);

        // Attach pre-ranked funnel transitions (business-impact order)
        payload.put("funnelTransitions", metricsSvc.computeFunnelTransitions(mr.funnel()));
        payload.put("weeks", weeks);

        return ai.generateReport(payload);
    }

=======
    public PesResponse pes(
            @PathVariable String campaignId,
            @RequestParam(required = false, defaultValue = "4") int weeks) {
        return pesSvc.compute(metrics(weeks).metrics());
    }

    // ─── POST /report ─────────────────────────────────────────────────────────

    /**
     * Generate a prescriptive performance report.
     *
     * <p>Enriches the payload with KPI metrics + business-impact-ranked funnel
     * transitions and forwards it to FastAPI {@code /internal/report/generate}.
     *
     * <p><b>FR4.26:</b> if FastAPI is unavailable, returns a rule-based report
     * identifying the lowest-weight metric as the primary bottleneck.
     */
    @PostMapping("/report")
    public Map<String, Object> report(
            @RequestBody(required = false) Map<String, Object> body) {

        var payload = new HashMap<String, Object>(body == null ? Map.of() : body);
        int weeks   = extractWeeks(payload);

        MetricsResponse mr = metrics(weeks);
        payload.putIfAbsent("metrics", mr);
        payload.put("funnelTransitions", metricsSvc.computeFunnelTransitions(mr.funnel()));
        payload.put("weeks", weeks);

        try {
            return ai.generateReport(payload);
        } catch (Exception e) {
            log.warn("[Module4 FR4.26] report FastAPI unavailable ({}); returning rule-based fallback",
                     e.getMessage());
            return buildRuleBasedReport(mr, metricsSvc.computeFunnelTransitions(mr.funnel()));
        }
    }

    // ─── POST /pes-analysis ───────────────────────────────────────────────────

>>>>>>> paldo
    /**
     * PES time-series deep-analysis via the pes_report_agent LangGraph workflow.
     *
     * <p>Builds a {@code weeks}-length synthetic time-series for the five KPIs
<<<<<<< HEAD
     * (CTR, CPC, ROAS, CR, CAC) by interpolating from the current-week values
     * back to a modelled baseline, then forwards it to FastAPI
     * {@code /internal/pes-analysis/generate}.
     *
     * <p>Request body (all optional):
     * <pre>{ "weeks": 4 }</pre>
     *
     * <p>Response — {@code final_ui_payload}:
     * <pre>
     * {
     *   "report_data": {
     *     "metric_conditions":  [ { metric_name, current_status, trend, peak_value, low_value } ],
     *     "cross_metric_logic": { relationships, insights },
     *     "ranked_weaknesses":  [ { metric_name, rank, weakness_meaning, recommendation } ]
     *   },
     *   "metadata": { final_score, total_iterations, needs_human_review, warning_message }
     * }
     * </pre>
     */
    @PostMapping("/pes-analysis")
    public Map<String, Object> pesAnalysis(@RequestBody(required = false) Map<String, Object> body) {
        int weeks = 4;
        if (body != null && body.get("weeks") instanceof Number n) {
            weeks = n.intValue();
        }

        // Build time-series from the computed default metrics for the chosen window
        Map<String, Object> timeSeries = metricsSvc.buildTimeSeries(metrics(weeks), weeks);

        return ai.generatePesAnalysis(Map.of(
            "metrics_data", timeSeries,
            "weeks",        weeks
        ));
    }

    @GetMapping("/report/{id}/pdf")
    public ResponseEntity<byte[]> reportPdf(@PathVariable UUID id) {
        byte[] pdf = ai.generateReportPdf(Map.of("reportId", id.toString()));
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_PDF)
            .header("Content-Disposition", "attachment; filename=\"ceview-report-" + id + ".pdf\"")
            .body(pdf);
=======
     * and forwards it to FastAPI {@code /internal/pes-analysis/generate}.
     *
     * <p><b>FR4.26:</b> if FastAPI is unavailable, returns a minimal offline payload.
     */
    @PostMapping("/pes-analysis")
    public Map<String, Object> pesAnalysis(
            @RequestBody(required = false) Map<String, Object> body) {

        int weeks = (body != null && body.get("weeks") instanceof Number n)
                    ? n.intValue() : 4;

        Map<String, Object> timeSeries = metricsSvc.buildTimeSeries(metrics(weeks), weeks);

        try {
            return ai.generatePesAnalysis(Map.of("metrics_data", timeSeries, "weeks", weeks));
        } catch (Exception e) {
            log.warn("[Module4 FR4.26] pes-analysis FastAPI unavailable ({}); returning offline fallback",
                     e.getMessage());
            return buildOfflinePesAnalysisFallback();
        }
    }

    // ─── GET /report/{id}/pdf ─────────────────────────────────────────────────

    @GetMapping("/report/{id}/pdf")
    public ResponseEntity<byte[]> reportPdf(@PathVariable java.util.UUID id) {
        byte[] pdf = ai.generateReportPdf(Map.of("reportId", id.toString()));
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header("Content-Disposition",
                        "attachment; filename=\"ceview-report-" + id + ".pdf\"")
                .body(pdf);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /** Build the raw-input map forwarded to FastAPI pes-compute/analyze. */
    private static Map<String, Object> buildRawPayload(ManualIngestRequest in) {
        return Map.of(
                "impressions",  in.impressions()  != null ? in.impressions()  : 0,
                "clicks",       in.clicks()       != null ? in.clicks()       : 0,
                "adSpend",      in.adSpend()      != null ? in.adSpend()      : 0.0,
                "revenue",      in.revenue()      != null ? in.revenue()      : 0.0,
                "conversions",  in.conversions()  != null ? in.conversions()  : 0,
                "bookings",     in.bookings()     != null ? in.bookings()     : 0,
                "newCustomers", in.newCustomers() != null ? in.newCustomers() : 0
        );
    }

    /** Extract the {@code weeks} hint from a generic request body, defaulting to 4. */
    private static int extractWeeks(Map<String, Object> payload) {
        return (payload.get("weeks") instanceof Number n) ? n.intValue() : 4;
    }

    /**
     * FR4.26 rule-based report fallback — used when FastAPI /report/generate is down.
     * Identifies the lowest-weighted metric as the primary bottleneck and returns
     * a hardcoded-but-contextual three-stage diagnostic so the UI never crashes.
     */
    private Map<String, Object> buildRuleBasedReport(
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

    /** FR4.26 offline payload for /pes-analysis when FastAPI is down. */
    private static Map<String, Object> buildOfflinePesAnalysisFallback() {
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
>>>>>>> paldo
    }
}
