package com.ceview.auth;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_msme_operator")
public class MsmeOperator {

    @Id
    @Column(name = "operator_id")
    private UUID operatorId;

    @Column(name = "first_name") private String firstName;
    @Column(name = "last_name")  private String lastName;
    @Column(unique = true)        private String email;
    @Column(name = "password_hash") private String passwordHash;
    @Column(name = "contact_number") private String contactNumber;
    @Column(name = "created_at")  private OffsetDateTime createdAt;
    @Column(name = "google_uid", unique = true) private String googleUid;

    @PrePersist
    void onCreate() {
        if (operatorId == null) operatorId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    /**
     * Whether this operator has supplied everything required to use the app, beyond just
     * having a valid identity. Derived (not stored) from {@code contactNumber} so it can
     * never drift out of sync with the data it depends on — see the Google sign-in design,
     * where a newly-provisioned operator has no contact number yet and must be routed
     * through a one-time "complete your profile" step before continuing.
     */
    public boolean isProfileCompleted() {
        return contactNumber != null && !contactNumber.isBlank();
    }
}
