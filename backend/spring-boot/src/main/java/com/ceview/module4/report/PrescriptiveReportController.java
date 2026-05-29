package com.ceview.module4.report;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module4.dto.AnalyticsDtos.*;
import com.ceview.module4.engagement.MetricsCalculationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Submodule 4.3 — AI-Generated Prescriptive Performance Report.
 *
 * <ul>
 *   <li>{@code POST /report}          → PrescriptiveReport (exhaustive funnel diagnostics schema)</li>
 *   <li>{@code POST /pes-analysis}    → PES time-series deep-analysis via LangGraph agent</li>
 *   <li>{@code GET  /report/{id}/pdf} → binary PDF download</li>
 * </ul>
 *
 * <h3>FR4.26 — Fallback Mechanism</h3>
 * Every call that delegates to FastAPI is wrapped in a {@code try-catch}.  If the
 * AI microservice is unavailable, Spring Boot falls back to the deterministic
 * helpers in {@link PrescriptiveReportService} and the REST response is still
 * fully populated — the UI never crashes.
 */
@RestController
@RequestMapping("/api/v1/analytics")
public class PrescriptiveReportController {

    private static final Logger log = LoggerFactory.getLogger(PrescriptiveReportController.class);

    private final MetricsCalculationService metricsSvc;
    private final AIInferenceGatewayService ai;
    private final PrescriptiveReportService reportSvc;

    public PrescriptiveReportController(
            MetricsCalculationService metricsSvc,
            AIInferenceGatewayService ai,
            PrescriptiveReportService reportSvc) {
        this.metricsSvc = metricsSvc;
        this.ai         = ai;
        this.reportSvc  = reportSvc;
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

        MetricsResponse mr = metricsSvc.defaultMetrics(weeks);
        payload.putIfAbsent("metrics", mr);
        payload.put("funnelTransitions", metricsSvc.computeFunnelTransitions(mr.funnel()));
        payload.put("weeks", weeks);

        try {
            return ai.generateReport(payload);
        } catch (Exception e) {
            log.warn("[Module4 FR4.26] report FastAPI unavailable ({}); returning rule-based fallback",
                     e.getMessage());
            return reportSvc.buildRuleBasedReport(mr, metricsSvc.computeFunnelTransitions(mr.funnel()));
        }
    }

    // ─── POST /pes-analysis ───────────────────────────────────────────────────

    /**
     * PES time-series deep-analysis via the pes_report_agent LangGraph workflow.
     *
     * <p>Builds a {@code weeks}-length synthetic time-series for the five KPIs
     * and forwards it to FastAPI {@code /internal/pes-analysis/generate}.
     *
     * <p><b>FR4.26:</b> if FastAPI is unavailable, returns a minimal offline payload.
     */
    @PostMapping("/pes-analysis")
    public Map<String, Object> pesAnalysis(
            @RequestBody(required = false) Map<String, Object> body) {

        int weeks = (body != null && body.get("weeks") instanceof Number n)
                    ? n.intValue() : 4;

        Map<String, Object> timeSeries = metricsSvc.buildTimeSeries(metricsSvc.defaultMetrics(weeks), weeks);

        try {
            return ai.generatePesAnalysis(Map.of("metrics_data", timeSeries, "weeks", weeks));
        } catch (Exception e) {
            log.warn("[Module4 FR4.26] pes-analysis FastAPI unavailable ({}); returning offline fallback",
                     e.getMessage());
            return reportSvc.buildOfflinePesAnalysisFallback();
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

    /** Extract the {@code weeks} hint from a generic request body, defaulting to 4. */
    private static int extractWeeks(Map<String, Object> payload) {
        return (payload.get("weeks") instanceof Number n) ? n.intValue() : 4;
    }
}
