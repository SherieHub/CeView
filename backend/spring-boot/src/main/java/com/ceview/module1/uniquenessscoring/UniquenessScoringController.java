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
            ((Number) r.getOrDefault("semanticPercentile", 0)).intValue(),
            ((Number) r.getOrDefault("cohortSize", 0)).intValue(),
            ((Number) r.getOrDefault("cohortMedianScore", 0)).intValue(),
            categoriesOf(r.get("cohortCategories"), req.categories()),
            String.valueOf(r.getOrDefault("categoryDensity", "")),
            Boolean.TRUE.equals(r.get("sufficientCohort")),
            String.valueOf(r.getOrDefault("descriptionFeedback", "")),
            String.valueOf(r.getOrDefault("categoryFeedback", ""))
        );
    }

    /**
     * Echoes the cohort categories FastAPI reports, falling back to the ones
     * the caller asked for.
     *
     * <p>KNOWN GAP — Task 11 (03-spring-calibration.md) replaces the
     * {@code getOrDefault(…, 0)} pattern above with a loud failure. A missing
     * {@code cohortSize} is an upstream fault, not a zero, and rendering
     * "compared against 0 businesses" as though it were a fact is exactly the
     * class of silent-default bug this plan set out to remove. The defaults are
     * here only so the prerequisite task compiles against the frozen contract.
     */
    private static List<String> categoriesOf(Object reported, List<String> requested) {
        if (reported instanceof List<?> list && !list.isEmpty()) {
            return list.stream().map(String::valueOf).toList();
        }
        return requested != null ? requested : List.of();
    }
}
