package com.ceview.module3.social.publish;

import jakarta.persistence.*;
import lombok.Data;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Durable delivery and remote-stage checkpoints. Never stores credentials. */
@Data
@Entity
@Table(name = "tbl_social_post", uniqueConstraints = @UniqueConstraint(columnNames = {"business_profile_id", "request_id", "platform"}))
public class SocialPost {
    @Id private UUID id;
    @Column(nullable=false) private UUID businessProfileId;
    @Column(nullable=false) private UUID requestId;
    @Column(nullable=false) private UUID mediaAssetId;
    private UUID publishingAccountId;
    private String targetExternalId;
    private String requestFingerprint;
    private UUID contentId;
    @Column(nullable=false, length=20) private String platform;
    @Column(nullable=false, columnDefinition="TEXT") private String caption;
    private String market;
    @Column(nullable=false, length=20) private String visibility;
    @Column(nullable=false, length=30) private String status;
    private String externalId;
    @Column(columnDefinition="TEXT") private String permalink;
    @Column(columnDefinition="TEXT") private String adsManagerUrl;
    @Column(columnDefinition="TEXT") private String errorMessage;
    private String containerId;
    private String campaignId;
    private String adSetId;
    private String creativeId;
    private String adMediaId;
    private String adAccountExternalId;
    private String adObjective;
    private Long adDailyBudgetMinor;
    private OffsetDateTime adStartTime;
    private OffsetDateTime adEndTime;
    private String adCountries;
    private String attributionSlug;
    private boolean pinCampaign;
    private OffsetDateTime scheduledFor;
    @Column(nullable=false) private OffsetDateTime createdAt;
    private OffsetDateTime updatedAt;
    private OffsetDateTime publishedAt;
    private OffsetDateTime nextAttemptAt;
    private OffsetDateTime claimedAt;
    private OffsetDateTime processingStartedAt;
    private int attempts;
    @Version private long version;
    @PrePersist void created() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
    @PreUpdate void updated() { updatedAt = OffsetDateTime.now(); }
}
