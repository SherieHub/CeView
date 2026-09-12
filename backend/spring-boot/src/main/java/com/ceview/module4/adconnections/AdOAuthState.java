package com.ceview.module4.adconnections;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single-use token binding an in-flight OAuth redirect to the operator who
 * started it (V27 migration).
 *
 * <p>This exists because the callback is a browser redirect from Meta/TikTok
 * carrying no Authorization header — there is no JWT to resolve a tenant from,
 * so the tenant has to travel in the {@code state} parameter and be looked up
 * here. It is also the OAuth CSRF defence: an attacker cannot forge a callback
 * for a state value they never received.
 *
 * <p>Rows are consumed exactly once ({@code consumedAt}) and expire after
 * {@code AdConnectionService.STATE_TTL}.
 */
@Data
@Entity
@Table(name = "tbl_ad_oauth_state")
public class AdOAuthState {

    @Id
    @Column(name = "state")
    private UUID state;

    @Column(name = "business_profile_id", nullable = false)   private UUID   businessProfileId;
    @Column(name = "provider", nullable = false, length = 20) private String provider;

    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "expires_at", nullable = false) private OffsetDateTime expiresAt;
    @Column(name = "consumed_at")                  private OffsetDateTime consumedAt;

    @PrePersist
    void onCreate() {
        if (state     == null) state     = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
