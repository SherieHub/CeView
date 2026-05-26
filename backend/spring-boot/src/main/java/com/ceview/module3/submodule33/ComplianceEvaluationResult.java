package com.ceview.module3.submodule33;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persists one compliance evaluation result per submission (FR3.29).
 * Stores all three sub-scores (CAS, VAS, OMCS) plus the explainable
 * AI outputs and revision tracking fields.
 */
@Data
@Entity
@Table(name = "tbl_compliance_evaluation_result")
public class ComplianceEvaluationResult {

    @Id
    @Column(name = "evaluation_id")
    private UUID evaluationId;

    @Column(name = "business_profile_id")
    private UUID businessProfileId;

    @Column(name = "selected_market")
    private String selectedMarket;

    @Column(name = "caption", columnDefinition = "TEXT")
    private String caption;

    // ─── Sub-scores (FR3.25) ─────────────────────────────────────────────────

    /** Caption Alignment Score (0-100) — Sentence-BERT cosine similarity (FR3.25.1). */
    @Column(name = "cas_score")
    private Double casScore;

    /** Visual Alignment Score (0-100) — Gemini multimodal evaluation (FR3.25.2). */
    @Column(name = "vas_score")
    private Double vasScore;

    /** Heuristic Compliance Score (0-100) — deterministic 6-rule checker (FR3.25.3). */
    @Column(name = "hcs_score")
    private Double hcsScore;

    /** Overall Multimodal Compliance Score: (0.35×CAS) + (0.45×VAS) + (0.20×HCS) (FR3.25.4). */
    @Column(name = "omcs_score")
    private Double omcsScore;

    /** Legacy overall score (0-100) — kept for backward compat with existing frontend. */
    @Column(name = "score")
    private Integer score;

    /** FR3.25.4 threshold label: Excellent / High / Moderate / Significant. */
    @Column(name = "compliance_threshold")
    private String complianceThreshold;

    // ─── Explainable AI outputs (FR3.26) ─────────────────────────────────────

    @Column(name = "aligned_items", columnDefinition = "TEXT")
    private String alignedItems;

    @Column(name = "gap_items", columnDefinition = "TEXT")
    private String gapItems;

    @Column(name = "mismatches", columnDefinition = "TEXT")
    private String mismatches;

    @Column(name = "compliance_interpretation", columnDefinition = "TEXT")
    private String complianceInterpretation;

    @Column(name = "source")
    private String source;

    /** Incremented on each resubmission for FR3.28 revision tracking. */
    @Column(name = "revision_number")
    private Integer revisionNumber = 1;

    @Column(name = "approval_status")
    private Boolean approvalStatus = false;

    @Column(name = "evaluated_at")
    private OffsetDateTime evaluatedAt;

    @PrePersist
    void prePersist() {
        if (evaluationId == null) evaluationId = UUID.randomUUID();
        if (evaluatedAt == null) evaluatedAt = OffsetDateTime.now();
    }
}
