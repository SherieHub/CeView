package com.ceview.module4.adconnections;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One operator's OAuth grant for one ad platform (V27 migration).
 *
 * <p>Status lifecycle:
 * <pre>
 *   (callback stores tokens) --> PENDING_ACCOUNT_SELECTION
 *                                      | operator picks an ad account
 *                                      v
 *                                   ACTIVE --> REVOKED  (disconnect)
 * </pre>
 *
 * <p>Only ACTIVE connections are synced — a connection without a chosen ad
 * account has nothing to report on.
 *
 * <p>The two token fields hold ciphertext from
 * {@link com.ceview.common.crypto.TokenCipher} and must never be copied into a
 * DTO or a log line.
 */
@Data
@Entity
@Table(
    name = "tbl_ad_platform_connection",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_ad_conn_profile_provider",
        columnNames = {"business_profile_id", "provider"}
    )
)
public class AdPlatformConnection {

    /** Status constants — match the CHECK constraint in V27. */
    public static final String STATUS_PENDING_ACCOUNT_SELECTION = "PENDING_ACCOUNT_SELECTION";
    public static final String STATUS_ACTIVE                    = "ACTIVE";
    public static final String STATUS_REVOKED                   = "REVOKED";

    @Id
    @Column(name = "connection_id")
    private UUID connectionId;

    @Column(name = "business_profile_id", nullable = false)   private UUID   businessProfileId;
    @Column(name = "provider", nullable = false, length = 20) private String provider;

    @ToString.Exclude
    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;
    @ToString.Exclude
    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;
    @Column(name = "token_expires_at") private OffsetDateTime tokenExpiresAt;

    @Column(name = "external_account_id",   length = 128) private String externalAccountId;
    @Column(name = "external_account_name", length = 255) private String externalAccountName;
    @Column(name = "currency", length = 3)                private String currency;

    /** Null = report on the whole account (default). Non-null = one campaign only. */
    @Column(name = "external_campaign_id",   length = 128) private String externalCampaignId;
    @Column(name = "external_campaign_name", length = 255) private String externalCampaignName;

    @Column(name = "scopes", columnDefinition = "TEXT")     private String scopes;
    @Column(name = "status", nullable = false, length = 30) private String status;

    @Column(name = "connected_at")   private OffsetDateTime connectedAt;
    @Column(name = "last_synced_at") private OffsetDateTime lastSyncedAt;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at")     private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (connectionId == null) connectionId = UUID.randomUUID();
        if (createdAt    == null) createdAt    = OffsetDateTime.now();
        if (status       == null) status       = STATUS_PENDING_ACCOUNT_SELECTION;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
