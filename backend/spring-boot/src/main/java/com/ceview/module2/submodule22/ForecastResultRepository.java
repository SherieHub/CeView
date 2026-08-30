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

    /**
     * Category-scoped variant (Task 1a.2b). With forecasts now produced per
     * (category, market), the plain finder above only returns whichever
     * category happened to be written most recently — not necessarily the
     * best-ranked one. Use this to look up a specific category's latest
     * forecast so callers can compare across categories and pick a winner.
     */
    Optional<ForecastResult> findTopByBusinessProfileIdAndTargetMarketAndCategoryAndForecastHorizonWeeksOrderByGeneratedAtDesc(
            UUID businessProfileId, String targetMarket, String category, Integer forecastHorizonWeeks);

    boolean existsByBusinessProfileId(UUID businessProfileId);
}
