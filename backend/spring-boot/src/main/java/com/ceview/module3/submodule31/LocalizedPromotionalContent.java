package com.ceview.module3.submodule31;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persists one generated caption per platform per profile+market request (FR3.10).
 * Four rows are created per generate call (instagram, tiktok, facebook, naver).
 */
@Data
@Entity
@Table(name = "tbl_localized_promotional_content")
public class LocalizedPromotionalContent {

    @Id
    @Column(name = "content_id")
    private UUID contentId;

    @Column(name = "business_profile_id")
    private UUID businessProfileId;

    @Column(name = "selected_market")
    private String selectedMarket;

    @Column(name = "platform")
    private String platform;

    @Column(name = "generated_caption", columnDefinition = "TEXT")
    private String generatedCaption;

    @Column(name = "content_direction", columnDefinition = "TEXT")
    private String contentDirection;

    @Column(name = "hashtags", columnDefinition = "TEXT")
    private String hashtags;

    @Column(name = "cta", columnDefinition = "TEXT")
    private String cta;

    @Column(name = "tone_suggestion", columnDefinition = "TEXT")
    private String toneSuggestion;

    @Column(name = "framework")
    private String framework;

    @Column(name = "source")
    private String source;

    @Column(name = "approval_status")
    private Boolean approvalStatus = false;

    @Column(name = "generated_at")
    private OffsetDateTime generatedAt;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @PrePersist
    void prePersist() {
        if (contentId == null) contentId = UUID.randomUUID();
        if (generatedAt == null) generatedAt = OffsetDateTime.now();
    }
}
