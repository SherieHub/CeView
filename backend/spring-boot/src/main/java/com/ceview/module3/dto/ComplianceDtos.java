package com.ceview.module3.dto;

import java.util.List;

/**
 * Wire shapes for Module 3 / Compliance Audit. Mirrors the MOCK.compliance
 * payload consumed by SmartOptimizationBoard: an integer score plus two
 * parallel feedback lists ("aligned" = wins, "gaps" = improvement areas).
 */
public class ComplianceDtos {

    public record EvaluateRequest(
        String caption,
        String market,
        String mediaName,
        Long mediaSize
    ) {}

    public record ComplianceResultDto(
        int score,
        List<String> aligned,
        List<String> gaps,
        /** "gemini" | "fallback" — origin of the score. */
        String source
    ) {}
}
