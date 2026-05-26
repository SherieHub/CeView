package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WeeklyDemandValueRepository extends JpaRepository<WeeklyDemandValue, UUID> {

    List<WeeklyDemandValue> findByBusinessProfileIdAndTargetMarketOrderByWeekAsc(
            UUID businessProfileId, String targetMarket);
}
