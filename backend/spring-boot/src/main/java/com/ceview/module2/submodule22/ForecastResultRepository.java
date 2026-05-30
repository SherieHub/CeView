package com.ceview.module2.submodule22;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ForecastResultRepository extends JpaRepository<ForecastResult, UUID> {

    List<ForecastResult> findByBusinessProfileIdAndTargetMarketOrderByGeneratedAtDesc(
            UUID businessProfileId, String targetMarket);

    Optional<ForecastResult> findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
            UUID businessProfileId, String targetMarket, Integer forecastHorizonWeeks);

    boolean existsByBusinessProfileId(UUID businessProfileId);
}
