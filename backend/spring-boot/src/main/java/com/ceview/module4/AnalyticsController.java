package com.ceview.module4;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module4.dto.AnalyticsDtos.*;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * SDD §4 — Campaign Analytics & Reporting.
 *
 * <ul>
 *   <li>GET  /metrics         → MetricsResponse (KPIs + funnel); {@code ?weeks=4|8}</li>
 *   <li>POST /manual          → same shape, computed from operator-entered values</li>
 *   <li>GET  /pes/{id}        → PesResponse for PESComputationBoard; {@code ?weeks=4|8}</li>
 *   <li>POST /report          → PrescriptiveReport (new exhaustive funnel schema)</li>
 *   <li>GET  /report/{id}/pdf → binary PDF download</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final MetricsCalculationService metricsSvc;
    private final PESComputationService pesSvc;
    private final AIInferenceGatewayService ai;

    public AnalyticsController(MetricsCalculationService m, PESComputationService p, AIInferenceGatewayService ai) {
        this.metricsSvc = m;
        this.pesSvc     = p;
        this.ai         = ai;
    }

    /**
     * Default campaign metrics for the EngagementMetricsBoard.
     *
     * @param weeks Analysis window — 4 (default) or 8. Scales demo defaults proportionally.
     */
    @GetMapping("/metrics")
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

    /**
     * Promotional Effectiveness Score breakdown.
     *
     * @param weeks Analysis window — forwarded to default-metrics computation.
     */
    @GetMapping("/pes/{campaignId}")
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

    /**
     * PES time-series deep-analysis via the pes_report_agent LangGraph workflow.
     *
     * <p>Builds a {@code weeks}-length synthetic time-series for the five KPIs
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
    }
}
