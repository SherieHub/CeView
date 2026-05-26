package com.ceview.module3.submodule31;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ContentGenerationLogRepository
        extends JpaRepository<ContentGenerationLog, UUID> {
}
