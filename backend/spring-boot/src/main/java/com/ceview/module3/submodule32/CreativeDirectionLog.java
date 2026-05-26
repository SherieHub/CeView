package com.ceview.module3.submodule32;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Audit record for each creative direction generation attempt (FR3.19). */
@Data
@Entity
@Table(name = "tbl_creative_direction_log")
public class CreativeDirectionLog {

    @Id
    @Column(name = "creative_log_id")
    private UUID creativeLogId;

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
        if (creativeLogId == null) creativeLogId = UUID.randomUUID();
        if (loggedAt == null) loggedAt = OffsetDateTime.now();
    }
}
