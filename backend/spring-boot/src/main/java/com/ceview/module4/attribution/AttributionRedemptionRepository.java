package com.ceview.module4.attribution;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttributionRedemptionRepository extends JpaRepository<AttributionRedemption, UUID> {

    List<AttributionRedemption> findByAttributionCodeId(UUID attributionCodeId);

    long countByAttributionCodeIdAndSource(UUID attributionCodeId, String source);

    List<AttributionRedemption> findByBusinessProfileId(UUID businessProfileId);

    /**
     * Aggregate-source upsert lookup (FareHarbor today). Re-syncing a week must
     * update its row rather than insert a second one.
     */
    Optional<AttributionRedemption> findByAttributionCodeIdAndSourceAndPeriodStartAndPeriodEnd(
            UUID attributionCodeId, String source, LocalDate periodStart, LocalDate periodEnd);

    /**
     * Per-event rows falling inside a week, for the weekly rollup.
     *
     * <p>Aggregate rows are excluded by the {@code eventAt} predicate itself —
     * they carry a null {@code eventAt} — so this returns only MANUAL and LINK
     * rows and the caller adds any aggregate row separately.
     */
    @Query("""
        select r from AttributionRedemption r
         where r.attributionCodeId = :codeId
           and r.eventAt is not null
           and r.eventAt >= :from
           and r.eventAt <  :to
        """)
    List<AttributionRedemption> findEventsInWindow(@Param("codeId") UUID codeId,
                                                   @Param("from") OffsetDateTime from,
                                                   @Param("to") OffsetDateTime to);

    /** Guards against one click being converted twice. */
    boolean existsByAttributionClickId(UUID attributionClickId);

    List<AttributionRedemption> findByAttributionClickIdIn(List<UUID> clickIds);
}
