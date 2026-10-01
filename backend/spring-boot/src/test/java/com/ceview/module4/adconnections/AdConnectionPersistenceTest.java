package com.ceview.module4.adconnections;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Schema-and-mapping guard. The test schema is generated from these entities
 * (ddl-auto=create-drop), so this asserts the JPA mapping works end to end — it
 * does NOT exercise the Flyway SQL in V27, which no test covers.
 */
@SpringBootTest
class AdConnectionPersistenceTest {

    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private AdOAuthStateRepository stateRepo;
    @Autowired private AdInsightRepository insightRepo;
    @Autowired private BusinessProfileRepository profileRepo;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        insightRepo.deleteAll();
        connectionRepo.deleteAll();
        stateRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void assignsAnIdAndCreatedAtOnPersist() {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("cipher-text");
        conn.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);

        AdPlatformConnection saved = connectionRepo.save(conn);

        assertNotNull(saved.getConnectionId());
        assertNotNull(saved.getCreatedAt());
    }

    @Test
    void findsAConnectionByProfileAndProvider() {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.TIKTOK.key());
        conn.setAccessTokenEncrypted("cipher-text");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        connectionRepo.save(conn);

        assertTrue(connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, AdProvider.TIKTOK.key())
                .isPresent());
        assertTrue(connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, AdProvider.META.key())
                .isEmpty());
    }

    @Test
    void listsOnlyActiveConnections() {
        AdPlatformConnection active = new AdPlatformConnection();
        active.setBusinessProfileId(profileId);
        active.setProvider(AdProvider.META.key());
        active.setAccessTokenEncrypted("c");
        active.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        connectionRepo.save(active);

        AdPlatformConnection pending = new AdPlatformConnection();
        pending.setBusinessProfileId(profileId);
        pending.setProvider(AdProvider.TIKTOK.key());
        pending.setAccessTokenEncrypted("c");
        pending.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        connectionRepo.save(pending);

        assertEquals(1, connectionRepo
                .findByBusinessProfileIdAndStatus(profileId, AdPlatformConnection.STATUS_ACTIVE)
                .size());
    }

    @Test
    void roundTripsAnOAuthStateRow() {
        AdOAuthState state = new AdOAuthState();
        state.setBusinessProfileId(profileId);
        state.setProvider(AdProvider.META.key());
        state.setExpiresAt(OffsetDateTime.now().plusMinutes(10));
        UUID token = stateRepo.save(state).getState();

        Optional<AdOAuthState> found = stateRepo.findById(token);
        assertTrue(found.isPresent());
        assertNull(found.get().getConsumedAt());
    }

    @Test
    void findsAnInsightByItsUniquePeriodKey() {
        AdInsight insight = new AdInsight();
        insight.setBusinessProfileId(profileId);
        insight.setProvider(AdProvider.META.key());
        insight.setExternalAccountId("act_123");
        insight.setPeriodStart(LocalDate.of(2026, 8, 31));
        insight.setPeriodEnd(LocalDate.of(2026, 9, 6));
        insight.setImpressions(1000L);
        insight.setClicks(50L);
        insight.setSpend(new BigDecimal("250.00"));
        insight.setConversions(3L);
        insight.setCurrency("PHP");
        insightRepo.save(insight);

        assertTrue(insightRepo.findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                profileId, AdProvider.META.key(),
                LocalDate.of(2026, 8, 31), LocalDate.of(2026, 9, 6)).isPresent());
    }

    @Test
    void doesNotLeakTokensThroughToString() {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("super-secret-access-token");
        conn.setRefreshTokenEncrypted("super-secret-refresh-token");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);

        String rendered = conn.toString();

        assertFalse(rendered.contains("super-secret-access-token"));
        assertFalse(rendered.contains("super-secret-refresh-token"));
    }

    @Test
    void persistsAndReadsBackTheSelectedCampaign() {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider("meta");
        conn.setAccessTokenEncrypted("enc");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        conn.setExternalAccountId("act_1");
        conn.setExternalCampaignId("cmp_123");
        conn.setExternalCampaignName("Dry-Season Promo");
        connectionRepo.saveAndFlush(conn);

        AdPlatformConnection reloaded = connectionRepo.findById(conn.getConnectionId()).orElseThrow();
        assertEquals("cmp_123", reloaded.getExternalCampaignId());
        assertEquals("Dry-Season Promo", reloaded.getExternalCampaignName());
    }

    @Test
    void rejectsADuplicateConnectionForTheSameProfileAndProvider() {
        AdPlatformConnection first = new AdPlatformConnection();
        first.setBusinessProfileId(profileId);
        first.setProvider(AdProvider.META.key());
        first.setAccessTokenEncrypted("c1");
        first.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        connectionRepo.saveAndFlush(first);

        AdPlatformConnection duplicate = new AdPlatformConnection();
        duplicate.setBusinessProfileId(profileId);
        duplicate.setProvider(AdProvider.META.key());
        duplicate.setAccessTokenEncrypted("c2");
        duplicate.setStatus(AdPlatformConnection.STATUS_ACTIVE);

        assertThrows(DataIntegrityViolationException.class,
                () -> connectionRepo.saveAndFlush(duplicate));
    }

    @Test
    void rejectsADuplicateInsightForTheSamePeriodKey() {
        AdInsight first = new AdInsight();
        first.setBusinessProfileId(profileId);
        first.setProvider(AdProvider.META.key());
        first.setExternalAccountId("act_123");
        first.setPeriodStart(LocalDate.of(2026, 8, 31));
        first.setPeriodEnd(LocalDate.of(2026, 9, 6));
        first.setSpend(new BigDecimal("100.00"));
        insightRepo.saveAndFlush(first);

        AdInsight duplicate = new AdInsight();
        duplicate.setBusinessProfileId(profileId);
        duplicate.setProvider(AdProvider.META.key());
        duplicate.setExternalAccountId("act_123");
        duplicate.setPeriodStart(LocalDate.of(2026, 8, 31));
        duplicate.setPeriodEnd(LocalDate.of(2026, 9, 6));
        duplicate.setSpend(new BigDecimal("200.00"));

        assertThrows(DataIntegrityViolationException.class,
                () -> insightRepo.saveAndFlush(duplicate));
    }
}
