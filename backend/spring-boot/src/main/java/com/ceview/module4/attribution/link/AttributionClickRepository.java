package com.ceview.module4.attribution.link;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttributionClickRepository extends JpaRepository<AttributionClick, UUID> {

    /**
     * Resolves the {@code cv=} value the hosted enquiry form posts back.
     * Unauthenticated callers hit this, so the service layer must still check
     * the click's window before accepting a submission.
     */
    Optional<AttributionClick> findByClickId(UUID clickId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from AttributionClick c where c.clickId = :clickId")
    Optional<AttributionClick> findByClickIdForUpdate(@Param("clickId") UUID clickId);

    /** Tenant-scoped variant for anything reached with a JWT. */
    Optional<AttributionClick> findByClickIdAndBusinessProfileId(UUID clickId, UUID businessProfileId);

    List<AttributionClick> findByLinkIdOrderByClickedAtDesc(UUID linkId);

    List<AttributionClick> findByBusinessProfileIdAndClickedAtBetweenOrderByClickedAtDesc(
            UUID businessProfileId, OffsetDateTime from, OffsetDateTime to);

    /**
     * Same-ip, same-link debounce for {@code BotFilter}. A crawler and a
     * double-tapping traveller look identical here, and both should count once.
     */
    @Query("""
        select count(c) from AttributionClick c
         where c.linkId = :linkId
           and c.ipHash = :ipHash
           and c.clickedAt >= :since
        """)
    long countRecentByLinkAndIp(@Param("linkId") UUID linkId,
                                @Param("ipHash") String ipHash,
                                @Param("since") OffsetDateTime since);

    /**
     * Per-creative rollup. Groups by {@code externalAdId}, keeping the null key
     * as its own row: an untagged click is real reach and gets an explicit
     * bucket rather than disappearing from the totals.
     */
    @Query("""
        select c.externalAdId as adId, count(c) as clicks
          from AttributionClick c
         where c.linkId = :linkId
           and c.inWindow = true
         group by c.externalAdId
        """)
    List<CreativeClickCount> countClicksByCreative(@Param("linkId") UUID linkId);

    /** Projection for {@link #countClicksByCreative}; null {@code adId} = untagged. */
    interface CreativeClickCount {
        String getAdId();
        long getClicks();
    }
}
