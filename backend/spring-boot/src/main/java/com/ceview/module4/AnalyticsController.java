package com.ceview.module4;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module4.dto.AnalyticsDtos.*;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * SDD §4 — Campaign Analytics & Reporting.
 *  - GET /metrics → MetricsResponse for EngagementMetricsBoard + funnel chart
 *  - POST /manual → same shape, computed from operator-entered values
 *  - GET /pes/{id} → PesResponse for PESComputationBoard
 *  - POST /report → PrescriptiveReport for AIActionPlanReport
 *  - GET /report/{id}/pdf → binary PDF download
 */
@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final MetricsCalculationService metricsSvc;
    private final PESComputationService pesSvc;
    private final AIInferenceGatewayService ai;

    public AnalyticsController(MetricsCalculationService m, PESComputationService p, AIInferenceGatewayService ai) {
        this.metricsSvc = m;
        this.pesSvc = p;
        this.ai = ai;
    }

    /** Defaults shown when nothing has been ingested — keeps the dashboard live. */
    @GetMapping("/metrics")
    public MetricsResponse metrics(@RequestParam(required = false) String start,
                                   @RequestParam(required = false) String end) {
        return metricsSvc.compute(new ManualIngestRequest(
            150_000, 7_200, 5_000.0, 16_000.0, 350, 180, 80, start, end
        ));
    }

    @PostMapping("/manual")
    public MetricsResponse manualIngest(@RequestBody ManualIngestRequest in) {
        return metricsSvc.compute(in);
    }

    @GetMapping("/pes/{campaignId}")
    public PesResponse pes(@PathVariable String campaignId) {
        // Stub: reuse default metrics. Wire to persistence once campaigns are stored.
        var m = metrics(null, null);
        return pesSvc.compute(m.metrics());
    }

    @PostMapping("/report")
    public Map<String, Object> report(@RequestBody(required = false) Map<String, Object> body) {
        var payload = new HashMap<String, Object>(body == null ? Map.of() : body);
        payload.putIfAbsent("metrics", metrics(null, null));
        return ai.generateReport(payload);
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
