package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface IngestionJobLogRepository extends JpaRepository<IngestionJobLog, UUID> {

    Optional<IngestionJobLog> findTopByJobNameOrderByStartedAtDesc(String jobName);
}
