package com.ceview.module4.adconnections;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The state token is the only thing tying an un-authenticated callback back to
 * an operator, so its rules — single use, short TTL, provider-bound — are
 * security properties, not conveniences. Each has its own test.
 */
@SpringBootTest
class AdConnectionServiceTest {

    @Autowired private AdConnectionService service;
    @Autowired private AdOAuthStateRepository stateRepo;
    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private TokenCipher tokenCipher;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        connectionRepo.deleteAll();
        stateRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void mintsAStateBoundToTheProfileAndProvider() {
        UUID state = service.mintState(profileId, AdProvider.META);

        AdOAuthState saved = stateRepo.findById(state).orElseThrow();
        assertEquals(profileId, saved.getBusinessProfileId());
        assertEquals("meta", saved.getProvider());
        assertNull(saved.getConsumedAt());
        assertTrue(saved.getExpiresAt().isAfter(OffsetDateTime.now()));
    }

    @Test
    void consumesAValidStateExactlyOnce() {
        UUID state = service.mintState(profileId, AdProvider.META);

        assertEquals(profileId, service.consumeState(state, AdProvider.META));
        // A replayed callback must not resolve to a tenant a second time.
        assertThrows(IllegalStateException.class,
                () -> service.consumeState(state, AdProvider.META));
    }

    @Test
    void consumingTheSameStateConcurrentlySucceedsExactlyOnce() throws Exception {
        UUID state = service.mintState(profileId, AdProvider.META);
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch ready = new CountDownLatch(threads);
        CountDownLatch go = new CountDownLatch(1);
        AtomicInteger successes = new AtomicInteger();
        AtomicInteger failures = new AtomicInteger();

        List<Future<?>> futures = new ArrayList<>();
        for (int i = 0; i < threads; i++) {
            futures.add(pool.submit(() -> {
                ready.countDown();
                try {
                    go.await();
                    service.consumeState(state, AdProvider.META);
                    successes.incrementAndGet();
                } catch (IllegalStateException e) {
                    failures.incrementAndGet();
                } catch (InterruptedException ignored) {
                }
            }));
        }
        ready.await();
        go.countDown();
        for (Future<?> f : futures) f.get(5, TimeUnit.SECONDS);
        pool.shutdown();

        assertEquals(1, successes.get(), "exactly one concurrent consumer should win");
        assertEquals(threads - 1, failures.get());
    }

    @Test
    void rejectsAStateMintedForAnotherProvider() {
        UUID state = service.mintState(profileId, AdProvider.META);
        assertThrows(IllegalStateException.class,
                () -> service.consumeState(state, AdProvider.TIKTOK));
    }

    @Test
    void rejectsAnExpiredState() {
        AdOAuthState expired = new AdOAuthState();
        expired.setBusinessProfileId(profileId);
        expired.setProvider(AdProvider.META.key());
        expired.setExpiresAt(OffsetDateTime.now().minusMinutes(1));
        UUID state = stateRepo.save(expired).getState();

        assertThrows(IllegalStateException.class,
                () -> service.consumeState(state, AdProvider.META));
    }

    @Test
    void rejectsAnUnknownState() {
        assertThrows(IllegalStateException.class,
                () -> service.consumeState(UUID.randomUUID(), AdProvider.META));
    }

    @Test
    void storesTheGrantEncryptedAndPendingAccountSelection() {
        TokenGrant grant = new TokenGrant("PLAINTEXT-TOKEN", null,
                OffsetDateTime.now().plusDays(60), "ads_read");

        service.storeGrant(profileId, AdProvider.META, grant);

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION, saved.getStatus());
        assertNotEquals("PLAINTEXT-TOKEN", saved.getAccessTokenEncrypted(),
                        "the token must not be stored in the clear");
        assertEquals("PLAINTEXT-TOKEN", tokenCipher.decrypt(saved.getAccessTokenEncrypted()));
        assertNotNull(saved.getConnectedAt());
    }

    @Test
    void reconnectingReplacesTheExistingGrantRatherThanDuplicatingIt() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("FIRST", null, null, "ads_read"));
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("SECOND", null, null, "ads_read"));

        assertEquals(1, connectionRepo.findByBusinessProfileId(profileId).size());
        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals("SECOND", tokenCipher.decrypt(saved.getAccessTokenEncrypted()));
    }

    @Test
    void selectingAnAccountActivatesTheConnection() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));

        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_999", "Dive Ads", "PHP"));

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals(AdPlatformConnection.STATUS_ACTIVE, saved.getStatus());
        assertEquals("act_999", saved.getExternalAccountId());
        assertEquals("Dive Ads", saved.getExternalAccountName());
        assertEquals("PHP", saved.getCurrency());
    }

    @Test
    void disconnectingDiscardsTheTokens() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", "REFRESH", null, "ads_read"));

        service.disconnect(profileId, AdProvider.META);

        Optional<AdPlatformConnection> saved =
                connectionRepo.findByBusinessProfileIdAndProvider(profileId, "meta");
        assertTrue(saved.isPresent(), "the row is kept as an audit trail");
        assertEquals(AdPlatformConnection.STATUS_REVOKED, saved.get().getStatus());
        assertEquals("", saved.get().getAccessTokenEncrypted());
        assertNull(saved.get().getRefreshTokenEncrypted());
    }

    @Test
    void decryptsAnActiveConnectionsAccessToken() {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("USABLE-TOKEN", null, null, "ads_read"));
        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();

        assertEquals("USABLE-TOKEN", service.accessTokenOf(conn));
    }

    // ── selectCampaign ───────────────────────────────────────────────────────

    private void activateMeta() {
        service.storeGrant(profileId, AdProvider.META, new TokenGrant("T", null, null, "s"));
        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_1", "Acct", "PHP"));
    }

    @Test
    void selectCampaignPinsTheConnectionToOneCampaign() {
        activateMeta();

        service.selectCampaign(profileId, AdProvider.META,
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Dry-Season Promo", "ACTIVE"));

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertEquals("cmp_1", conn.getExternalCampaignId());
        assertEquals("Dry-Season Promo", conn.getExternalCampaignName());
        assertEquals(AdPlatformConnection.STATUS_ACTIVE, conn.getStatus());
    }

    @Test
    void selectCampaignWithNullClearsBackToWholeAccount() {
        activateMeta();
        service.selectCampaign(profileId, AdProvider.META,
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE"));

        service.selectCampaign(profileId, AdProvider.META, null);

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertNull(conn.getExternalCampaignId());
        assertNull(conn.getExternalCampaignName());
    }

    @Test
    void selectCampaignBeforeAnAccountIsChosenIsRejected() {
        service.storeGrant(profileId, AdProvider.META, new TokenGrant("T", null, null, "s"));

        assertThrows(IllegalStateException.class, () -> service.selectCampaign(profileId,
                AdProvider.META, new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE")));
    }

    @Test
    void changingTheAdAccountClearsAPreviouslySelectedCampaign() {
        activateMeta();
        service.selectCampaign(profileId, AdProvider.META,
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE"));

        service.selectAccount(profileId, AdProvider.META,
                new AdConnectionDtos.AdAccountOption("act_2", "Acct 2", "PHP"));

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        assertNull(conn.getExternalCampaignId(), "a campaign from the old account must not carry over");
    }
}
