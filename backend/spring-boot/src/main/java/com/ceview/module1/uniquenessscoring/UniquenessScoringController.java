package com.ceview.module1.uniquenessscoring;

import com.ceview.ai.AiDependencyException;
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
            requireInt(r, "overallScore"),
            requireInt(r, "semanticsScore"),
            requireInt(r, "categoryScore"),
            requireInt(r, "semanticPercentile"),
            requireInt(r, "cohortSize"),
            requireInt(r, "cohortMedianScore"),
            categoriesOf(r.get("cohortCategories"), req.categories()),
            requireString(r, "categoryDensity"),
            requireBool(r, "sufficientCohort"),
            // descriptionFeedback / categoryFeedback are "populated at last" per the
            // frozen contract — an empty string is a legitimate value today, so
            // these two keep a default rather than failing loudly.
            String.valueOf(r.getOrDefault("descriptionFeedback", "")),
            String.valueOf(r.getOrDefault("categoryFeedback", ""))
        );
    }

    /**
     * Echoes the cohort categories FastAPI reports, falling back to the ones the
     * caller asked for. This is a genuine echo with a sensible default, not a
     * silent zero: the cohort is always drawn from the operator's own selected
     * categories, so reflecting the request back is correct when FastAPI omits it.
     */
    private static List<String> categoriesOf(Object reported, List<String> requested) {
        if (reported instanceof List<?> list && !list.isEmpty()) {
            return list.stream().map(String::valueOf).toList();
        }
        return requested != null ? requested : List.of();
    }

    // ── Loud failures for the fields the frontend renders as fact ───────────────
    //
    // The uniqueness response drives numbers and states the operator reads as
    // truth ("compared against N businesses", the density explainer, the
    // insufficient-cohort state). A field FastAPI failed to return is an upstream
    // fault, not a zero — a `cohortSize: 0` rendered as "compared against 0
    // businesses" is exactly the silent-default bug this plan set out to remove.
    // Missing / null / wrong-typed values raise the same dependency-unavailable
    // contract AiDependencyException already speaks, so the frontend's existing
    // error panel handles it with no new shape to learn.

    private static int requireInt(Map<String, Object> r, String key) {
        Object v = require(r, key);
        if (v instanceof Number n) return n.intValue();
        throw malformed(key, "expected a number, got " + typeOf(v));
    }

    private static String requireString(Map<String, Object> r, String key) {
        Object v = require(r, key);
        if (v instanceof String s) return s;
        throw malformed(key, "expected a string, got " + typeOf(v));
    }

    private static boolean requireBool(Map<String, Object> r, String key) {
        Object v = require(r, key);
        if (v instanceof Boolean b) return b;
        throw malformed(key, "expected a boolean, got " + typeOf(v));
    }

    private static Object require(Map<String, Object> r, String key) {
        if (r == null || !r.containsKey(key) || r.get(key) == null) {
            throw malformed(key, "field absent from the uniqueness response");
        }
        return r.get(key);
    }

    private static AiDependencyException malformed(String key, String detail) {
        return AiDependencyException.fromBody(503, Map.of(
            "code", "MOD1_UNIQUENESS_RESPONSE_MALFORMED",
            "message", "The uniqueness service returned an incomplete result.",
            "dependency", "fastapi",
            "cause", "uniqueness response field '" + key + "': " + detail),
            "classification/uniqueness");
    }

    private static String typeOf(Object v) {
        return v == null ? "null" : v.getClass().getSimpleName();
    }
}
