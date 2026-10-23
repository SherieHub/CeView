package com.ceview.module3.social;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Every query is scoped by profile: there is no way to read another tenant's account. */
public interface PublishingAccountRepository extends JpaRepository<PublishingAccount, UUID> {

    List<PublishingAccount> findByBusinessProfileId(UUID businessProfileId);

    Optional<PublishingAccount> findByBusinessProfileIdAndPlatform(UUID businessProfileId, String platform);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from PublishingAccount a where a.businessProfileId = :profileId and a.platform = :platform")
    Optional<PublishingAccount> lockOwned(UUID profileId, String platform);
}
