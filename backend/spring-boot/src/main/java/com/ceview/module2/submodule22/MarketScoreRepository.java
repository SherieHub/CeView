package com.ceview.module2.submodule22;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MarketScoreRepository extends JpaRepository<MarketScore, UUID> {

    List<MarketScore> findByForecastResultIdIn(List<UUID> forecastResultIds);

    List<MarketScore> findByForecastResultIdOrderByMarketRankAsc(UUID forecastResultId);
}
