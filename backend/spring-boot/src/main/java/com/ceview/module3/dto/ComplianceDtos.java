package com.ceview.module3.dto;

import java.util.Map;

/**
 * Wire shapes for Module 3.3 — Compliance Audit (OMCS agent).
 *
 * The compliance audit is a stateless passthrough to the FastAPI LangGraph
 * omcs_agent. These records mirror the agent's request/response contract.
 *
 * OMCS formula:
 *   OMCS = (0.35 × profileSemanticScore)
 *        + (0.45 × recommendationsPictureScore)
 *        + (0.20 × pubmatConsistencyScore)
 */
public class ComplianceDtos {

    /**
     * OMCS agent audit request (Submodule 3.3) — sent by the React studio.
     *
     * The frontend supplies the chosen caption, the chosen image (as a data: URL
     * or public http(s) URL), the business profile context, and the Submodule 3.2
     * visual-guide recommendations the caption is expected to follow.
     */
    public record OmcsAuditRequest(
        String caption,
        String imageUrl,
        Map<String, Object> businessProfile,
        Map<String, Object> recommendations
    ) {}

    /**
     * OMCS agent audit result (Submodule 3.3) — full omcs_agent evaluation state.
     *
     * Mirrors the FastAPI OmcsAnalysisResponse (snake_case there, camelCase here):
     *   profileSemanticScore        — profile semantic alignment (0-100)
     *   rubricEvaluationData        — { scores{...}, total } per-criterion rubric
     *   recommendationsPictureScore — rubric total (image vs recommendations)
     *   consistencyExplanation      — caption/image consistency rationale
     *   pubmatConsistencyScore      — caption/image consistency score (0-100)
     *   omcsScore                   — (0.35×profile)+(0.45×rubric)+(0.20×consistency)
     *   status                      — "Pass" | "Fail"
     *   feedback                    — diagnostic (root-cause + fixes when failing)
     */
    public record OmcsAuditResultDto(
        double profileSemanticScore,
        Map<String, Object> rubricEvaluationData,
        double recommendationsPictureScore,
        String consistencyExplanation,
        double pubmatConsistencyScore,
        double omcsScore,
        String status,
        String feedback
    ) {}
}
