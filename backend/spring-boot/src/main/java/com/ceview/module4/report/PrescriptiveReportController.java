package com.ceview.module4.report;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module4.dto.AnalyticsDtos.*;
import com.ceview.module4.engagement.MetricsCalculationService;
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
 * <p>When the FastAPI AI service is unavailable, the call raises an
 * {@code AiDependencyException} that the global handler renders as the
 * unavailability contract — there is no rule-based stand-in report.
 */
@RestController
@RequestMapping("/api/analytics")
public class PrescriptiveReportController {

    private final MetricsCalculationService metricsSvc;
    private final AIInferenceGatewayService ai;
    private final CurrentBusinessProfile    currentBusinessProfile;

    public PrescriptiveReportController(
            MetricsCalculationService metricsSvc,
            AIInferenceGatewayService ai,
            CurrentBusinessProfile currentBusinessProfile) {
        this.metricsSvc = metricsSvc;
        this.ai         = ai;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    // ─── POST /report ─────────────────────────────────────────────────────────

    /**
     * Generate a prescriptive performance report.
     *
     * <p>Enriches the payload with KPI metrics + business-impact-ranked funnel
     * transitions and forwards it to FastAPI {@code /internal/report/generate}.
     * An unavailable AI service surfaces as a structured 503, not a rule-based
     * substitute.
     */
    @PostMapping("/report")
    public Map<String, Object> report(
            @RequestBody(required = false) Map<String, Object> body) {

        var payload = new HashMap<String, Object>(body == null ? Map.of() : body);
        int weeks   = extractWeeks(payload);

        MetricsResponse mr = metricsSvc.defaultMetrics(currentBusinessProfile.resolveProfileId(), weeks);
        payload.putIfAbsent("metrics", mr);
        payload.put("funnelTransitions", metricsSvc.computeFunnelTransitions(mr.funnel()));
        payload.put("weeks", weeks);

        return ai.generateReport(payload);
    }

    // ─── POST /pes-analysis ───────────────────────────────────────────────────

    /**
     * PES time-series deep-analysis via the pes_report_agent LangGraph workflow.
     *
     * <p>Forwards the caller-supplied {@code metrics_data} time-series (the five
     * KPI arrays the frontend builds from campaign history) to FastAPI
     * {@code /internal/pes-analysis/generate}. Only when the caller omits
     * {@code metrics_data} does it fall back to a synthetic {@code weeks}-length
     * series so the endpoint still works for ad-hoc/manual calls.
     *
     * <p>An unavailable AI service surfaces as a structured 503, not a minimal
     * offline payload.
     */
    @PostMapping("/pes-analysis")
    public Map<String, Object> pesAnalysis(
            @RequestBody(required = false) Map<String, Object> body) {

        int weeks = (body != null && body.get("weeks") instanceof Number n)
                    ? n.intValue() : 4;

        // Prefer the frontend-supplied series; synthesize only when absent.
        Object timeSeries = (body != null && body.get("metrics_data") instanceof Map<?, ?> m && !m.isEmpty())
                ? m
                : metricsSvc.buildTimeSeries(
                        metricsSvc.defaultMetrics(currentBusinessProfile.resolveProfileId(), weeks), weeks);

        return ai.generatePesAnalysis(Map.of("metrics_data", timeSeries, "weeks", weeks));
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
