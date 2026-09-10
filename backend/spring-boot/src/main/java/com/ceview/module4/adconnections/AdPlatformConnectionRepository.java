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
}
