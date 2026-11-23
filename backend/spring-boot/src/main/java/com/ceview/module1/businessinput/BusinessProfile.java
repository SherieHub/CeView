package com.ceview.module1.businessinput;

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

    @Column(name = "user_id")                  private UUID userId;
    @Column(name = "business_name")            private String businessName;
    @Column(name = "business_description")     private String businessDescription;
    @Column(name = "uvp")                      private String uvp;

    /*
     * Structured Business Story / UVP answers (V57). business_description and uvp hold the
     * paragraphs the frontend composes from them; see StructuredInputs.
     */
    @Column(name = "story_business_type", columnDefinition = "TEXT") private String storyBusinessType;
    @Column(name = "story_location", columnDefinition = "TEXT")      private String storyLocation;
    @Column(name = "story_experience", columnDefinition = "TEXT")    private String storyExperience;
    @Column(name = "story_facilities", columnDefinition = "TEXT")    private String storyFacilities;
    @Column(name = "uvp_distinguisher", columnDefinition = "TEXT")   private String uvpDistinguisher;
    @Column(name = "uvp_supporting_fact", columnDefinition = "TEXT") private String uvpSupportingFact;
    @Column(name = "uvp_guest_benefit", columnDefinition = "TEXT")   private String uvpGuestBenefit;

    /** The operator hand-edited the composed paragraph, so the template no longer overwrites it. */
    @Column(name = "description_edited", nullable = false) private boolean descriptionEdited = false;
    @Column(name = "uvp_edited", nullable = false)         private boolean uvpEdited = false;

    /** Comma-joined list — portable across H2 + Postgres. */
    @Column(name = "core_services", columnDefinition = "TEXT")
    private String coreServices;

    @Column(name = "image_url", columnDefinition = "TEXT") private String imageUrl;

    /** Comma-joined list of selected category names. */
    @Column(name = "categories", columnDefinition = "TEXT")
    private String categories;

    @Column(name = "confidence_score")   private Float confidenceScore;
    @Column(name = "uniqueness_score")   private Float uniquenessScore;
    @Column(name = "created_at")         private OffsetDateTime createdAt;
    @Column(name = "updated_at")         private OffsetDateTime updatedAt;

    /**
     * TRUE for uniqueness-corpus reference rows (V26). These have no operator
     * (user_id IS NULL) and must be excluded from every operator-scoped read —
     * the uniqueness cohort query is the only reader that wants them. See
     * {@code BusinessProfileRepository#findAllNonReference} and
     * {@code ReferenceProfileIsolationTest}.
     */
    @Column(name = "is_reference", nullable = false)
    private boolean isReference = false;

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

    public List<String> categoriesList() {
        if (categories == null || categories.isBlank()) return List.of();
        return Arrays.stream(categories.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public void setCategoriesList(List<String> cats) {
        this.categories = cats == null ? null : String.join(",", cats);
    }
}
