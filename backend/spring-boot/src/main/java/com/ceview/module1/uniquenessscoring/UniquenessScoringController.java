package com.ceview.module1.uniquenessscoring;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.uniquenessscoring.dto.UniquenessDtos.*;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/** SDD §1.2 — exposes POST /api/classification/uniqueness. */
@RestController
@RequestMapping("/api/classification")
public class UniquenessScoringController {

    private final AIInferenceGatewayService ai;

    public UniquenessScoringController(AIInferenceGatewayService ai) { this.ai = ai; }

    @PostMapping("/uniqueness")
    public UniquenessResponse uniqueness(@RequestBody UniquenessRequest req) {
        var payload = new HashMap<String, Object>();
        payload.put("businessProfileId", req.businessProfileId() != null ? req.businessProfileId() : "");
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
