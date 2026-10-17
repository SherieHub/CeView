package com.ceview.module2.submodule21;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IngestionJobLogRepository extends JpaRepository<IngestionJobLog, UUID> {

  Optional<IngestionJobLog> findTopByJobNameOrderByStartedAtDesc(String jobName);
}
