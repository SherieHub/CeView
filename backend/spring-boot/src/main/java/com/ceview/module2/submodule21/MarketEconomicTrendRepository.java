package com.ceview.module2.submodule21;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MarketEconomicTrendRepository extends JpaRepository<MarketEconomicTrend, UUID> {

    /** Returns the most recently fetched economic trend snapshot for a market. */
    Optional<MarketEconomicTrend> findTopByMarketOrderByFetchedAtDesc(String market);
}
