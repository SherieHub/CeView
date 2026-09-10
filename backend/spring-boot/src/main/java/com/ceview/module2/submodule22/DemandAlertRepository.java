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
     * backed by idx_demand_alert_profile_date. Not yet called by any service; added
     * so the repository maps the new column ahead of the alert-rules step that will
     * use it to replace the 3-table join in NotificationService.
     */
    List<DemandAlert> findByBusinessProfileIdOrderByAlertDateDesc(UUID businessProfileId);

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
}
