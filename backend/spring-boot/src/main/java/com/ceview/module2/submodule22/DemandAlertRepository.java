package com.ceview.module2.submodule22;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DemandAlertRepository extends JpaRepository<DemandAlert, UUID> {

    List<DemandAlert> findByMarketScoreIdInOrderByAlertDateDesc(List<UUID> marketScoreIds);

    /**
     * Direct tenant-scoped read against the denormalized business_profile_id (V29),
     * backed by idx_demand_alert_profile_date. NotificationService uses this as
     * the primary demand-alert feed query so category-specific alerts are not
     * lost behind a single latest-forecast-per-market lookup.
     */
    List<DemandAlert> findByBusinessProfileIdOrderByAlertDateDesc(UUID businessProfileId);

    Optional<DemandAlert> findTopByMarketScoreIdOrderByAlertDateDesc(UUID marketScoreId);

    /**
     * Walks demand_alert -> market_score -> forecast_result to confirm the alert
     * belongs to the given business profile before allowing a mutation. None of
     * these entities carry JPA relations to each other (raw UUID FK columns
     * only), so the join is expressed explicitly with ON conditions rather than
     * a derived query. Returns empty when the alert doesn't exist OR belongs to
     * a different profile — callers must not distinguish the two, or they leak
     * cross-tenant existence.
     */
    @Query("""
        select da from DemandAlert da
          join MarketScore ms on ms.marketScoreId = da.marketScoreId
          join ForecastResult fr on fr.forecastResultId = ms.forecastResultId
         where da.demandAlertId = :alertId
           and fr.businessProfileId = :profileId
        """)
    Optional<DemandAlert> findOwnedBy(@Param("alertId") UUID alertId,
                                       @Param("profileId") UUID profileId);

    /**
     * Every existing alert for this exact (profile, category, market) triple —
     * used by persistDemandAlert to retire the prior alert(s) before inserting a
     * fresh one. Without this, every "Refresh forecast" click permanently added
     * another row for the same pair (nothing ever superseded the last one), so
     * the feed accumulated duplicate cards for the same market/category with
     * only their uplift % differing run to run.
     */
    @Query("""
        select da from DemandAlert da
          join MarketScore ms on ms.marketScoreId = da.marketScoreId
          join ForecastResult fr on fr.forecastResultId = ms.forecastResultId
         where fr.businessProfileId = :profileId
           and da.category = :category
           and fr.targetMarket = :market
        """)
    List<DemandAlert> findByProfileAndCategoryAndMarket(@Param("profileId") UUID profileId,
                                                          @Param("category") String category,
                                                          @Param("market") String market);
}
