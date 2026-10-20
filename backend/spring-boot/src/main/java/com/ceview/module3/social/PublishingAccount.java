package com.ceview.module3.social;

import jakarta.persistence.*;
import lombok.Data;
import lombok.ToString;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One operator's credentials for publishing to one platform (V49). Token fields hold
 * ciphertext from {@link com.ceview.common.crypto.TokenCipher}; they must never be copied
 * into a DTO or a log line.
 */
@Data
@Entity
@Table(
    name = "tbl_publishing_account",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_publishing_account_profile_platform",
        columnNames = {"business_profile_id", "platform"}))
public class PublishingAccount {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_NEEDS_RECONNECT = "NEEDS_RECONNECT";
    public static final String STATUS_REVOKED = "REVOKED";

    @Id
    @Column(name = "account_id")
    private UUID accountId;

    @Column(name = "business_profile_id", nullable = false) private UUID businessProfileId;
    @Column(name = "platform", nullable = false, length = 20) private String platform;
    @Column(name = "external_id", nullable = false, length = 128) private String externalId;
    @Column(name = "display_name", length = 255) private String displayName;

    @ToString.Exclude
    @Column(name = "access_token_encrypted", nullable = false, columnDefinition = "TEXT")
    private String accessTokenEncrypted;

    @ToString.Exclude
    @Column(name = "refresh_token_encrypted", columnDefinition = "TEXT")
    private String refreshTokenEncrypted;

    @Column(name = "token_expires_at") private OffsetDateTime tokenExpiresAt;
    @Column(name = "refresh_expires_at") private OffsetDateTime refreshExpiresAt;
    @Column(name = "refresh_claimed_at") private OffsetDateTime refreshClaimedAt;

    @Column(name = "scopes", columnDefinition = "TEXT") private String scopes;
    @Column(name = "status", nullable = false, length = 30) private String status;

    @Column(name = "connected_at") private OffsetDateTime connectedAt;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at") private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (accountId == null) accountId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (status == null) status = STATUS_ACTIVE;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
