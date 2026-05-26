package com.ceview.module3.submodule31;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Audit record for each content generation attempt (FR3.10). */
@Data
@Entity
@Table(name = "tbl_content_generation_log")
public class ContentGenerationLog {

    @Id
    @Column(name = "content_log_id")
    private UUID contentLogId;

    @Column(name = "business_profile_id")
    private UUID businessProfileId;

    @Column(name = "generation_status")
    private String generationStatus;

    @Column(name = "diagnostics", columnDefinition = "TEXT")
    private String diagnostics;

    @Column(name = "logged_at")
    private OffsetDateTime loggedAt;

    @PrePersist
    void prePersist() {
        if (contentLogId == null) contentLogId = UUID.randomUUID();
        if (loggedAt == null) loggedAt = OffsetDateTime.now();
    }
}
