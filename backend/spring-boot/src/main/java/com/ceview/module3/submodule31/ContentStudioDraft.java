package com.ceview.module3.submodule31;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A saved Content Studio draft (V54): the generated caption options, the operator's
 * edits and the content direction for one market. {@code kind} is {@link #KIND_AUTO} for
 * the one working draft per (profile, market), {@link #KIND_NAMED} for drafts the operator
 * saved on purpose. {@code payloadJson} is opaque JSON owned by the frontend.
 */
@Data
@Entity
@Table(name = "tbl_content_studio_draft")
public class ContentStudioDraft {

    public static final String KIND_AUTO = "auto";
    public static final String KIND_NAMED = "named";

    @Id
    @Column(name = "draft_id")
    private UUID draftId;

    @Column(name = "business_profile_id", nullable = false) private UUID businessProfileId;
    @Column(name = "market", nullable = false, length = 60) private String market;
    @Column(name = "kind", nullable = false, length = 10) private String kind;
    @Column(name = "name", nullable = false, length = 120) private String name;
    @Column(name = "demand_alert_id") private UUID demandAlertId;

    @ToString.Exclude
    @Column(name = "payload_json", nullable = false, columnDefinition = "TEXT")
    private String payloadJson;

    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at", nullable = false) private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (draftId == null) draftId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
