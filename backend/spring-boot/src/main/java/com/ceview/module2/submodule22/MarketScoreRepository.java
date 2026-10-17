package com.ceview.module2.submodule22;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketScoreRepository extends JpaRepository<MarketScore, UUID> {

  List<MarketScore> findByForecastResultIdIn(List<UUID> forecastResultIds);

  List<MarketScore> findByForecastResultIdOrderByMarketRankAsc(UUID forecastResultId);
}
