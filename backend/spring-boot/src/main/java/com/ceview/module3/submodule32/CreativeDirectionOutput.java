package com.ceview.module3.submodule32;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persists one creative direction generation output per profile+market (FR3.19).
 * Text columns store JSON-serialised arrays from FastAPI.
 */
@Data
@Entity
@Table(name = "tbl_creative_direction_output")
public class CreativeDirectionOutput {

    @Id
    @Column(name = "creative_direction_id")
    private UUID creativeDirectionId;

    @Column(name = "business_profile_id")
    private UUID businessProfileId;

    @Column(name = "selected_market")
    private String selectedMarket;

    @Column(name = "shot_list_recommendations", columnDefinition = "TEXT")
    private String shotListRecommendations;

    @Column(name = "visual_recommendations", columnDefinition = "TEXT")
    private String visualRecommendations;

    @Column(name = "lighting_suggestions", columnDefinition = "TEXT")
    private String lightingSuggestions;

    @Column(name = "moodboard_references", columnDefinition = "TEXT")
    private String moodboardReferences;

    @Column(name = "platform_recommendations", columnDefinition = "TEXT")
    private String platformRecommendations;

    @Column(name = "visual_tone", columnDefinition = "TEXT")
    private String visualTone;

    @Column(name = "approval_status")
    private Boolean approvalStatus = false;

    @Column(name = "generated_at")
    private OffsetDateTime generatedAt;

    @Column(name = "approved_at")
    private OffsetDateTime approvedAt;

    @PrePersist
    void prePersist() {
        if (creativeDirectionId == null) creativeDirectionId = UUID.randomUUID();
        if (generatedAt == null) generatedAt = OffsetDateTime.now();
    }
}
