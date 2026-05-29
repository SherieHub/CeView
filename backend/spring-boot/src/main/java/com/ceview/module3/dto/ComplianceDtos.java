package com.ceview.module3.dto;

import java.util.List;
import java.util.Map;

/**
 * Wire shapes for Module 3 / Compliance Audit.
 *
 * Submodule 3.3 extends the original {score, aligned, gaps, source} shape
 * with the three OMCS sub-scores and explainable AI outputs (FR3.25, FR3.26).
 * All new fields are nullable so the basic /evaluate-json path stays backward-
 * compatible with the existing frontend ComplianceGauge.
 *
 * OMCS formula (FR3.25.4):
 *   OMCS = (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)
 */
public class ComplianceDtos {

    public record EvaluateRequest(
        String caption,
        String market,
        String mediaName,
        Long mediaSize
    ) {}

    /**
     * Full multimodal evaluation request — sent to /evaluate-full (FR3.20).
     *
     * approvedCaptions   — from tbl_localized_promotional_content  (FR3.21)
     * categories         — business profile categories              (FR3.25.3 HCS rule 1)
     * visualTone         — from tbl_creative_direction_output       (FR3.21)
     * shotListContext    — from tbl_creative_direction_output       (FR3.21)
     *
     * All context fields are injected server-side by ComplianceAnalysisService
     * (FR3.21) so the FastAPI payload is self-contained.
     */
    public record EvaluateFullRequest(
        String caption,
        String market,
        String mediaName,
        Long mediaSize,
        List<String> approvedCaptions,  // FR3.21 — from tbl_localized_promotional_content
        List<String> categories,        // FR3.25.3 — business categories for HCS rule 1
        String visualTone,              // FR3.21 — from tbl_creative_direction_output
        String shotListContext          // FR3.21 — from tbl_creative_direction_output
    ) {}

    /**
     * Compliance result returned by all /evaluate* endpoints.
     *
     * Original fields (backward-compat):
     *   score    — overall score 0-100 (equals omcsScore when full pipeline ran)
     *   aligned  — what works well
     *   gaps     — improvement areas
     *   source   — "gemini" | "fallback" | "rule-based"
     *
     * FR3.25 sub-scores (null when basic /evaluate-json path was used):
     *   casScore  — Caption Alignment Score  (Sentence-BERT cosine similarity, FR3.25.1)
     *   vasScore  — Visual Alignment Score   (Gemini multimodal,               FR3.25.2)
     *   hcsScore  — Heuristic Compliance Score (deterministic 6-rule check,    FR3.25.3)
     *   omcsScore — Overall Multimodal Compliance Score                        (FR3.25.4)
     *             = (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)
     *
     * FR3.25.4 interpretation and FR3.26 explainability:
     *   interpretation — Excellent / High Compliance / Moderate / Significant Revision
     *   mismatches     — detected mismatches and visual inconsistencies
     */
    public record ComplianceResultDto(
        int score,
        List<String> aligned,
        List<String> gaps,
        String source,
        // FR3.25 sub-scores
        Double casScore,
        Double vasScore,
        Double hcsScore,
        Double omcsScore,
        // FR3.25.4 + FR3.26
        String interpretation,
        List<String> mismatches
    ) {
        /** Compact constructor for backward-compat (basic /evaluate-json path). */
        public static ComplianceResultDto basic(int score, List<String> aligned,
                                                List<String> gaps, String source) {
            return new ComplianceResultDto(score, aligned, gaps, source,
                    null, null, null, null, null, null);
        }
    }

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
