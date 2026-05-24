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

    @PrePersist
    void onCreate() {
        if (operatorId == null) operatorId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
