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

    public ClassificationAnalyzeController(AIInferenceGatewayService ai) { this.ai = ai; }

    @PostMapping("/analyze")
    public AnalyzeResponse analyze(@RequestBody AnalyzeRequest req) {
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
        return new AnalyzeResponse(allocs);
    }
}
