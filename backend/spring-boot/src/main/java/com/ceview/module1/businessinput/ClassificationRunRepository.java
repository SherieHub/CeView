package com.ceview.module1.businessinput;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import java.util.*;

public interface ClassificationRunRepository extends JpaRepository<ClassificationRun, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<ClassificationRun> findByRunIdAndOperatorId(UUID runId, UUID operatorId);
}
