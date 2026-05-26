package com.ceview.module3.submodule33;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Revision history entry for each resubmission cycle (FR3.29). */
@Data
@Entity
@Table(name = "tbl_compliance_revision_history")
public class ComplianceRevisionHistory {

    @Id
    @Column(name = "revision_id")
    private UUID revisionId;

    @Column(name = "business_profile_id")
    private UUID businessProfileId;

    @Column(name = "original_eval_id")
    private UUID originalEvalId;

    @Column(name = "selected_market")
    private String selectedMarket;

    @Column(name = "revision_number")
    private Integer revisionNumber;

    @Column(name = "submitted_caption", columnDefinition = "TEXT")
    private String submittedCaption;

    @Column(name = "cas_score")
    private Double casScore;

    @Column(name = "omcs_score")
    private Double omcsScore;

    @Column(name = "compliance_threshold")
    private String complianceThreshold;

    @Column(name = "submitted_at")
    private OffsetDateTime submittedAt;

    @PrePersist
    void prePersist() {
        if (revisionId == null) revisionId = UUID.randomUUID();
        if (submittedAt == null) submittedAt = OffsetDateTime.now();
    }
}
