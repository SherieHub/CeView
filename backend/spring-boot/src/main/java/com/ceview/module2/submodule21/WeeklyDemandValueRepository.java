package com.ceview.module2.submodule21;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Offline training/export repository only; no production dashboard service calls it. */
public interface WeeklyDemandValueRepository extends JpaRepository<WeeklyDemandValue, UUID> {

  List<WeeklyDemandValue> findByBusinessProfileIdAndTargetMarketOrderByWeekAsc(
      UUID businessProfileId, String targetMarket);
}
