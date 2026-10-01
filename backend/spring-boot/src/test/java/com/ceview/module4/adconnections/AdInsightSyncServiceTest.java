package com.ceview.module4.adconnections;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.AdConnectionDtos.InsightsResponse;
import com.ceview.module4.adconnections.client.AdInsightData;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.MetaAdsClient;
import com.ceview.module4.adconnections.client.TikTokAdsClient;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@SpringBootTest
class AdInsightSyncServiceTest {

    private static final LocalDate START = LocalDate.of(2026, 8, 31);
    private static final LocalDate END   = LocalDate.of(2026, 9, 6);

    @Autowired private AdInsightSyncService syncService;
    @Autowired private AdConnectionService connectionService;
    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private AdInsightRepository insightRepo;
    @Autowired private BusinessProfileRepository profileRepo;

    @MockBean private MetaAdsClient metaClient;
    @MockBean private TikTokAdsClient tiktokClient;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        insightRepo.deleteAll();
        connectionRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();

        when(metaClient.provider()).thenReturn(AdProvider.META);
        when(tiktokClient.provider()).thenReturn(AdProvider.TIKTOK);
    }

    /** Connects a provider and puts it in ACTIVE with the given account/currency. */
    private void activate(AdProvider provider, String accountId, String currency) {
        connectionService.storeGrant(profileId, provider,
                new TokenGrant("TOKEN-" + provider.key(), null, null, "scope"));
        connectionService.selectAccount(profileId, provider,
                new AdConnectionDtos.AdAccountOption(accountId, provider.key() + " Ads", currency));
    }

    @Test
    void returnsEmptyTotalsWhenNothingIsConnected() {
        InsightsResponse response = syncService.sync(profileId, START, END);

        assertTrue(response.sources().isEmpty());
        assertNull(response.impressions());
        assertTrue(response.warnings().stream()
                .anyMatch(w -> w.toLowerCase().contains("no connected")));
    }

    @Test
    void sumsASingleProvidersMetricsIntoTheTotals() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(48210, 1327,
                        new BigDecimal("4820.55"), 45, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(1, response.sources().size());
        assertEquals(48210L, response.impressions());
        assertEquals(1327L, response.clicks());
        assertEquals(0, new BigDecimal("4820.55").compareTo(response.spend()));
        assertEquals(45L, response.conversions());
        assertEquals("PHP", response.currency());
        assertTrue(response.warnings().isEmpty());
    }

    @Test
    void combinesTwoProvidersThatShareACurrency() {
        activate(AdProvider.META, "act_1", "PHP");
        activate(AdProvider.TIKTOK, "adv_2", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("500.00"), 5, null, "{}"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("250.50"), 3, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(2, response.sources().size());
        assertEquals(3000L, response.impressions());
        assertEquals(120L, response.clicks());
        assertEquals(0, new BigDecimal("750.50").compareTo(response.spend()));
        assertEquals(8L, response.conversions());
        assertEquals("PHP", response.currency());
    }

    @Test
    void refusesToSumAcrossDifferentCurrencies() {
        // Summing USD and PHP would produce a number that means nothing, and
        // would flow straight into ROAS. Report both sources and say why.
        activate(AdProvider.META, "act_1", "USD");
        activate(AdProvider.TIKTOK, "adv_2", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("100.00"), 5, null, "{}"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("5000.00"), 3, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(2, response.sources().size());
        assertNull(response.spend(), "totals must be withheld on a currency mismatch");
        assertNull(response.impressions());
        assertNull(response.currency());
        assertTrue(response.warnings().stream()
                .anyMatch(w -> w.toLowerCase().contains("currency")), response.warnings().toString());
    }

    @Test
    void refusesToSumWhenOneSourceHasNoCurrency() {
        // A null currency must never be treated as "matches everything else" —
        // that would silently sum a source of unknown currency into the total.
        activate(AdProvider.META, "act_1", "PHP");
        connectionService.storeGrant(profileId, AdProvider.TIKTOK,
                new TokenGrant("TOKEN-tiktok", null, null, "scope"));
        connectionService.selectAccount(profileId, AdProvider.TIKTOK,
                new AdConnectionDtos.AdAccountOption("adv_2", "tiktok Ads", null));

        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("100.00"), 5, null, "{}"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("5000.00"), 3, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(2, response.sources().size());
        assertNull(response.spend(), "totals must be withheld when a source has no currency");
        assertNull(response.impressions());
        assertNull(response.currency());
        assertTrue(response.warnings().stream()
                .anyMatch(w -> w.toLowerCase().contains("currency")), response.warnings().toString());
    }

    @Test
    void persistsOneInsightRowPerProviderAndPeriod() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("500.00"), 5, null, "{\"a\":1}"));

        syncService.sync(profileId, START, END);

        AdInsight saved = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                        profileId, "meta", START, END).orElseThrow();
        assertEquals(1000L, saved.getImpressions());
        assertEquals("PHP", saved.getCurrency());
        assertEquals("{\"a\":1}", saved.getRawResponse());
    }

    @Test
    void resyncingThePeriodUpdatesTheRowRatherThanDuplicatingIt() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("500.00"), 5, null, "{}"));
        syncService.sync(profileId, START, END);

        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1800, 90, new BigDecimal("900.00"), 9, null, "{}"));
        syncService.sync(profileId, START, END);

        assertEquals(1, insightRepo.count());
        assertEquals(1800L, insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(
                        profileId, "meta", START, END).orElseThrow().getImpressions());
    }

    @Test
    void stampsLastSyncedAtOnTheConnection() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1, 1, BigDecimal.ONE, 1, null, "{}"));

        syncService.sync(profileId, START, END);

        assertNotNull(connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow()
                .getLastSyncedAt());
    }

    @Test
    void oneProviderFailingDoesNotLoseTheOther() {
        activate(AdProvider.META, "act_1", "PHP");
        activate(AdProvider.TIKTOK, "adv_2", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenThrow(new AdPlatformException("Session has expired"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("250.50"), 3, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertEquals(1, response.sources().size());
        assertEquals("tiktok", response.sources().get(0).provider());
        assertTrue(response.warnings().stream()
                .anyMatch(w -> w.contains("meta")), response.warnings().toString());
    }

    @Test
    void skipsAConnectionThatHasNoChosenAccount() {
        connectionService.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "scope"));   // still PENDING

        InsightsResponse response = syncService.sync(profileId, START, END);

        assertTrue(response.sources().isEmpty());
    }

    @Test
    void syncsAgainstTheSelectedCampaignAndRecordsItOnTheCachedRow() {
        activate(AdProvider.META, "act_1", "PHP");
        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        conn.setExternalCampaignId("cmp_1");
        conn.setExternalCampaignName("Dry-Season Promo");
        connectionRepo.save(conn);

        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(100, 10, new BigDecimal("50.00"), 2, null, "{}"));

        InsightsResponse response = syncService.sync(profileId, START, END);

        org.mockito.ArgumentCaptor<String> campaignArg = org.mockito.ArgumentCaptor.forClass(String.class);
        org.mockito.Mockito.verify(metaClient).fetchInsights(anyString(), any(),
                campaignArg.capture(), any(), any());
        assertEquals("cmp_1", campaignArg.getValue());

        assertEquals("Dry-Season Promo", response.sources().get(0).campaignName());

        AdInsight cached = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(profileId, "meta", START, END)
                .orElseThrow();
        assertEquals("cmp_1", cached.getExternalCampaignId());
    }

    @Test
    void onlySyncsTheRequestedProviders() {
        activate(AdProvider.META, "act_1", "PHP");
        activate(AdProvider.TIKTOK, "adv_2", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(1000, 50, new BigDecimal("500.00"), 5, null, "{}"));
        when(tiktokClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(2000, 70, new BigDecimal("250.00"), 3, null, "{}"));

        InsightsResponse response =
                syncService.sync(profileId, START, END, java.util.Set.of(AdProvider.TIKTOK));

        assertEquals(1, response.sources().size());
        assertEquals("tiktok", response.sources().get(0).provider());
        org.mockito.Mockito.verify(metaClient, org.mockito.Mockito.never())
                .fetchInsights(anyString(), any(), any(), any(), any());
    }

    @Test
    void aWholeAccountSyncLeavesTheCampaignScopeNull() {
        activate(AdProvider.META, "act_1", "PHP");
        when(metaClient.fetchInsights(anyString(), any(), any(), any(), any()))
                .thenReturn(new AdInsightData(100, 10, new BigDecimal("50.00"), 2, null, "{}"));

        syncService.sync(profileId, START, END);

        AdInsight cached = insightRepo
                .findByBusinessProfileIdAndProviderAndPeriodStartAndPeriodEnd(profileId, "meta", START, END)
                .orElseThrow();
        assertNull(cached.getExternalCampaignId());
    }
}
