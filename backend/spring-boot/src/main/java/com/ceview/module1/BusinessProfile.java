package com.ceview.module1;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_business_profile")
public class BusinessProfile {

    @Id
    @Column(name = "business_profile_id")
    private UUID businessProfileId;

    @Column(name = "user_id")            private UUID userId;
    @Column(name = "business_name")      private String businessName;
    @Column(name = "business_type")      private String businessType;
    @Column(name = "business_description") private String businessDescription;
    @Column(name = "uvp")                 private String uvp;

    /** Comma-joined list — portable across H2 + Postgres. */
    @Column(name = "core_services", columnDefinition = "TEXT")
    private String coreServices;

    @Column(name = "image_url", columnDefinition = "TEXT") private String imageUrl;
    @Column(name = "finalized_category") private String finalizedCategory;
    @Column(name = "confidence_score")   private Float confidenceScore;
    @Column(name = "uniqueness_score")   private Float uniquenessScore;
    @Column(name = "created_at")         private OffsetDateTime createdAt;
    @Column(name = "updated_at")         private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (businessProfileId == null) businessProfileId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() { updatedAt = OffsetDateTime.now(); }

    public List<String> coreServicesList() {
        if (coreServices == null || coreServices.isBlank()) return List.of();
        return Arrays.stream(coreServices.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public void setCoreServicesList(List<String> services) {
        this.coreServices = services == null ? null : String.join(",", services);
    }
}
