package com.ceview.module3.social;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties="spring.datasource.url=jdbc:h2:mem:publishing_repository;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;NON_KEYWORDS=VALUE")
class PublishingAccountRepositoryTest {

    @Autowired private PublishingAccountRepository repo;

    @BeforeEach
    void clean() {
        repo.deleteAll();
    }

    private PublishingAccount account(UUID profileId, String platform) {
        PublishingAccount a = new PublishingAccount();
        a.setBusinessProfileId(profileId);
        a.setPlatform(platform);
        a.setExternalId("ext-" + platform);
        a.setDisplayName("Name " + platform);
        a.setAccessTokenEncrypted("SECRET-CIPHERTEXT");
        a.setStatus(PublishingAccount.STATUS_ACTIVE);
        return a;
    }

    @Test
    void findsOnlyTheCallersAccounts() {
        UUID mine = UUID.randomUUID();
        UUID theirs = UUID.randomUUID();
        repo.save(account(mine, "facebook"));
        repo.save(account(mine, "tiktok"));
        repo.save(account(theirs, "facebook"));

        assertThat(repo.findByBusinessProfileId(mine)).hasSize(2);
        assertThat(repo.findByBusinessProfileIdAndPlatform(mine, "facebook")).isPresent();
        assertThat(repo.findByBusinessProfileIdAndPlatform(mine, "instagram")).isEmpty();
        assertThat(repo.findByBusinessProfileId(theirs)).hasSize(1);
    }

    @Test
    void allowsOnlyOneRowPerProfileAndPlatform() {
        UUID profile = UUID.randomUUID();
        repo.saveAndFlush(account(profile, "facebook"));

        assertThatThrownBy(() -> repo.saveAndFlush(account(profile, "facebook")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void toStringNeverContainsTokens() {
        PublishingAccount a = account(UUID.randomUUID(), "tiktok");
        a.setRefreshTokenEncrypted("REFRESH-CIPHERTEXT");

        assertThat(a.toString()).doesNotContain("SECRET-CIPHERTEXT").doesNotContain("REFRESH-CIPHERTEXT");
    }
}
