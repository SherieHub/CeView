package com.ceview.module2.submodule21;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketEconomicTrendRepository extends JpaRepository<MarketEconomicTrend, UUID> {

  /** Returns the most recently fetched economic trend snapshot for a market. */
  Optional<MarketEconomicTrend> findTopByMarketOrderByFetchedAtDesc(String market);
}
