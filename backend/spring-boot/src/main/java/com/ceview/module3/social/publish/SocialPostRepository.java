package com.ceview.module3.social.publish;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.*;

public interface SocialPostRepository extends JpaRepository<SocialPost, UUID> {
    List<SocialPost> findByBusinessProfileIdOrderByCreatedAtDesc(UUID profileId);
    Optional<SocialPost> findByIdAndBusinessProfileId(UUID id, UUID profileId);
    List<SocialPost> findByBusinessProfileIdAndRequestId(UUID profileId, UUID requestId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from SocialPost p where p.id = :id and p.businessProfileId = :profileId")
    Optional<SocialPost> lockOwned(UUID id, UUID profileId);
    // Internal scheduler only: tenants originate from persisted rows, never request input.
    @Query(value="SELECT * FROM tbl_social_post WHERE status = 'PENDING' AND next_attempt_at <= :now ORDER BY next_attempt_at LIMIT 1 FOR UPDATE SKIP LOCKED", nativeQuery=true)
    List<SocialPost> claimDue(OffsetDateTime now);
    List<SocialPost> findByStatusAndClaimedAtBefore(String status, OffsetDateTime before);
    List<SocialPost> findByStatusIn(Collection<String> statuses);
    /** Ads still counting against the total spend limit: not failed or cancelled, and not yet ended. */
    @Query("select p from SocialPost p where p.businessProfileId = :profileId and p.platform = 'meta_ads' "
            + "and p.status not in ('FAILED','CANCELLED') and p.adEndTime > :now")
    List<SocialPost> findActiveAds(UUID profileId, OffsetDateTime now);
}
