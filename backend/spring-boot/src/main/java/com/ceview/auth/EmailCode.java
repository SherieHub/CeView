package com.ceview.auth;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One emailed one-time code. Only a BCrypt hash of the 6 digits is stored. A code is single
 * use ({@code consumedAt}), time-boxed ({@code expiresAt}) and attempt-limited
 * ({@code attempts}); issuing a new code consumes any earlier active one.
 */
@Data
@Entity
@Table(name = "tbl_email_code")
public class EmailCode {

    public enum Purpose { VERIFY_EMAIL, RESET_PASSWORD }

    @Id
    @Column(name = "code_id")
    private UUID codeId;

    @Column(name = "operator_id", nullable = false)
    private UUID operatorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Purpose purpose;

    /** Address the code was mailed to; stale once the operator changes email. */
    @Column(nullable = false)
    private String email;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "consumed_at")
    private OffsetDateTime consumedAt;

    @PrePersist
    void onCreate() {
        if (codeId == null) codeId = UUID.randomUUID();
    }
}
