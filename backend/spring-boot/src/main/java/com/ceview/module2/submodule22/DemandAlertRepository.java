package com.ceview.module2.submodule22;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DemandAlertRepository extends JpaRepository<DemandAlert, UUID> {

    List<DemandAlert> findByMarketScoreIdInOrderByAlertDateDesc(List<UUID> marketScoreIds);
}
