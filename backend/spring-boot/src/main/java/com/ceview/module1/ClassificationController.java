package com.ceview.module1;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.dto.ClassificationDtos.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/classification")
public class ClassificationController {

    private final AIInferenceGatewayService ai;

    public ClassificationController(AIInferenceGatewayService ai) { this.ai = ai; }

    /** SDD §1.1 — POST /api/v1/classification/analyze */
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
                ((Number) m.getOrDefault("percentage", 0)).doubleValue()))
            .toList();
        return new AnalyzeResponse(allocs);
    }

    /** SDD §1.2 — POST /api/v1/classification/uniqueness */
    @PostMapping("/uniqueness")
    public UniquenessResponse uniqueness(@RequestBody UniquenessRequest req) {
        var payload = new HashMap<String, Object>();
        payload.put("businessName", req.businessName());
        payload.put("categories", req.categories());
        payload.put("coreServices", req.coreServices());
        payload.put("description", req.description());
        payload.put("uvp", req.uvp());

        var r = ai.computeUniqueness(payload);
        return new UniquenessResponse(
            ((Number) r.getOrDefault("overallScore", 0)).intValue(),
            ((Number) r.getOrDefault("semanticsScore", 0)).intValue(),
            ((Number) r.getOrDefault("categoryScore", 0)).intValue(),
            String.valueOf(r.getOrDefault("descriptionFeedback", "")),
            String.valueOf(r.getOrDefault("categoryFeedback", ""))
        );
    }
}
