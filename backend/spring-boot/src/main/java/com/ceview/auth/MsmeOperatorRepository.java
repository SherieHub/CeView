package com.ceview.auth;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MsmeOperatorRepository extends JpaRepository<MsmeOperator, UUID> {
  Optional<MsmeOperator> findByEmail(String email);

  Optional<MsmeOperator> findByGoogleUid(String googleUid);
}
