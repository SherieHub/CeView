package com.ceview.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MsmeOperatorRepository extends JpaRepository<MsmeOperator, UUID> {
    Optional<MsmeOperator> findByEmail(String email);
}
