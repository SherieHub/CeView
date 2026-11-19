package com.ceview.module1.businessinput;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.dto.AnalyzeDtos.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** SDD §1.1 — exposes POST /api/classification/analyze. */
@RestController
@RequestMapping("/api/classification")
public class ClassificationAnalyzeController {

    private final AIInferenceGatewayService ai;
    private final ClassificationRunService runs;
    private final com.ceview.auth.CurrentOperator currentOperator;

    public ClassificationAnalyzeController(AIInferenceGatewayService ai, ClassificationRunService runs,
                                           com.ceview.auth.CurrentOperator currentOperator) {
        this.ai = ai;
        this.runs = runs;
        this.currentOperator = currentOperator;
    }

    @PostMapping("/analyze")
    public AnalyzeResponse analyze(@RequestBody AnalyzeRequest req) {
        var operatorId = currentOperator.resolve();
        if (req.description() == null || req.uvp() == null || req.coreServices() == null
                || req.coreServices().stream().anyMatch(Objects::isNull)) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Description, UVP and services are required");
        }
        var payload = new HashMap<String, Object>();
        payload.put("businessName", req.businessName());
        payload.put("coreServices", req.coreServices());
        payload.put("description", req.description());
        payload.put("uvp", req.uvp());

        var resp = ai.classifyCategories(payload);
        @SuppressWarnings("unchecked")
        var raw = (List<Map<String, Object>>) resp.getOrDefault("categories", List.of());
        var allocs = raw.stream()
            .map(m -> new CategoryAllocation(
                String.valueOf(m.get("name")),
                ((Number) m.getOrDefault("percentage", 0)).intValue()))
            .toList();
        var runId = runs.record(operatorId, req, allocs, resp.get("inference"), "ANALYZE");
        return new AnalyzeResponse(allocs, runId);
    }
}
