package com.ceview.module3.dto;

import java.util.List;

/**
 * Wire shapes for Module 3 / Compliance Audit.
 *
 * Submodule 3.3 extends the original {score, aligned, gaps, source} shape
 * with the three OMCS sub-scores and explainable AI outputs (FR3.25, FR3.26).
 * All new fields are nullable so the basic /evaluate-json path stays backward-
 * compatible with the existing frontend ComplianceGauge.
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
     * approvedCaptions from 3.1 and creativeContext from 3.2 are injected
     * server-side by ComplianceAnalysisService (FR3.21); they are included
     * here so the FastAPI payload is self-contained.
     */
    public record EvaluateFullRequest(
        String caption,
        String market,
        String mediaName,
        Long mediaSize,
        List<String> approvedCaptions,  // FR3.21 — from tbl_localized_promotional_content
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
     *   casScore  — Caption Alignment Score (Sentence-BERT cosine similarity)
     *   vasScore  — Visual Alignment Score (Gemini multimodal)
     *   omcsScore — Overall Multimodal Compliance Score
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
        Double omcsScore,
        // FR3.25.4 + FR3.26
        String interpretation,
        List<String> mismatches
    ) {
        /** Compact constructor for backward-compat (basic /evaluate-json path). */
        public static ComplianceResultDto basic(int score, List<String> aligned,
                                                List<String> gaps, String source) {
            return new ComplianceResultDto(score, aligned, gaps, source,
                    null, null, null, null, null);
        }
    }
}
