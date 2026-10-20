package com.ceview.module4.adconnections;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Every query here is scoped by {@code businessProfileId} on purpose — there is
 * deliberately no "find by provider" method that crosses tenants.
 */
public interface AdPlatformConnectionRepository extends JpaRepository<AdPlatformConnection, UUID> {

    Optional<AdPlatformConnection> findByBusinessProfileIdAndProvider(UUID businessProfileId,
                                                                     String provider);

    List<AdPlatformConnection> findByBusinessProfileId(UUID businessProfileId);

    List<AdPlatformConnection> findByBusinessProfileIdAndStatus(UUID businessProfileId,
                                                               String status);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from AdPlatformConnection c where c.businessProfileId = :profileId and c.provider = :provider")
    Optional<AdPlatformConnection> lockOwned(UUID profileId, String provider);

    /** Pin only the accepted grant/account; never overwrite a concurrently replaced connection. */
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically=true)
    @org.springframework.data.jpa.repository.Query("update AdPlatformConnection c set c.externalCampaignId = :campaignId, c.externalCampaignName = :name where c.businessProfileId = :profileId and c.provider = 'meta' and c.status = 'ACTIVE' and c.externalAccountId = :accountId and c.accessTokenEncrypted = :grant")
    int pinCampaignIfUnchanged(UUID profileId, String accountId, String grant, String campaignId, String name);
}
