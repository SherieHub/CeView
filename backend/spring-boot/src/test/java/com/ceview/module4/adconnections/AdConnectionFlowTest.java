package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.client.AdPlatformClient;
import com.ceview.module4.adconnections.client.TokenGrant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end through the controller with the HTTP client mocked — the client's
 * own request/response handling is covered by the MockWebServer tests.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "ceview.adplatform.meta.app-id=test-meta-app",
        "ceview.adplatform.meta.app-secret=test-meta-secret",
        "ceview.adplatform.redirect-base-url=https://tunnel.example.com",
        "ceview.adplatform.frontend-base-url=http://localhost:5173"
})
class AdConnectionFlowTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private AdOAuthStateRepository stateRepo;
    @Autowired private AdConnectionService service;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    /** Replaces the real Meta client so no network call happens. */
    @MockBean private com.ceview.module4.adconnections.client.MetaAdsClient metaClient;

    /** Replaces the real TikTok client so no network call happens. */
    @MockBean private com.ceview.module4.adconnections.client.TikTokAdsClient tiktokClient;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        connectionRepo.deleteAll();
        stateRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorId = UUID.randomUUID();
        testOperators.create(operatorId);
        token = jwtService.issue(operatorId, "operator@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();

        when(metaClient.provider()).thenReturn(AdProvider.META);
        when(metaClient.buildAuthorizeUrl(anyString()))
                .thenAnswer(inv -> "https://facebook.test/dialog?state=" + inv.getArgument(0));

        when(tiktokClient.provider()).thenReturn(AdProvider.TIKTOK);
        when(tiktokClient.buildAuthorizeUrl(anyString()))
                .thenAnswer(inv -> "https://tiktok.test/dialog?state=" + inv.getArgument(0));
    }

    @Test
    void authorizeReturnsAUrlAndPersistsAState() throws Exception {
        mvc.perform(post("/api/ad-connections/meta/authorize")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.authorizeUrl").exists());

        org.junit.jupiter.api.Assertions.assertEquals(1, stateRepo.count());
    }

    @Test
    void authorizeReturns503WhenTheProviderIsNotConfigured() throws Exception {
        // TikTok has no app id in this test's properties.
        mvc.perform(post("/api/ad-connections/tiktok/authorize")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isServiceUnavailable())
           .andExpect(jsonPath("$.code").value("AD_PROVIDER_NOT_CONFIGURED"));
    }

    @Test
    void callbackStoresTheGrantAndRedirectsToTheFrontend() throws Exception {
        when(metaClient.exchangeCode("CODE-1"))
                .thenReturn(new TokenGrant("TOKEN", null, null, "ads_read"));
        UUID state = service.mintState(profileId, AdProvider.META);

        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("code", "CODE-1")
                        .param("state", state.toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   "http://localhost:5173/settings/platforms?adconnect=meta"));

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(
                AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION, saved.getStatus());
    }

    @Test
    void callbackAcceptsTikToksAuthCodeParameter() throws Exception {
        // TikTok's Business API names the callback param auth_code, not code —
        // this is the one line in the controller that translates between the
        // two, and it has no coverage without this test.
        when(tiktokClient.exchangeCode("AUTH-CODE-1"))
                .thenReturn(new TokenGrant("TOKEN", "REFRESH", null, "[4,5]"));
        UUID state = service.mintState(profileId, AdProvider.TIKTOK);

        mvc.perform(get("/api/ad-connections/tiktok/callback")
                        .param("auth_code", "AUTH-CODE-1")
                        .param("state", state.toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   "http://localhost:5173/settings/platforms?adconnect=tiktok"));

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "tiktok").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(
                AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION, saved.getStatus());
    }

    @Test
    void callbackRedirectsWithAnErrorWhenTheOperatorDeclinesConsent() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("error", "access_denied")
                        .param("state", UUID.randomUUID().toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   org.hamcrest.Matchers.containsString("adconnect_error=access_denied")));
    }

    @Test
    void callbackRedirectsWithAnErrorForAnInvalidState() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("code", "CODE-1")
                        .param("state", UUID.randomUUID().toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   org.hamcrest.Matchers.containsString("adconnect_error=invalid_state")));
    }

    @Test
    void callbackNeverEchoesAnUnwhitelistedErrorValueIntoTheRedirect() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("error", "some_random_value")
                        .param("state", UUID.randomUUID().toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   org.hamcrest.Matchers.containsString("adconnect_error=consent_declined")))
           .andExpect(header().string("Location",
                   org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("some_random_value"))));
    }

    @Test
    void callbackRedirectsWithAnErrorWhenTokenExchangeFails() throws Exception {
        when(metaClient.exchangeCode("CODE-1"))
                .thenThrow(new com.ceview.module4.adconnections.client.AdPlatformException("boom"));
        UUID state = service.mintState(profileId, AdProvider.META);

        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("code", "CODE-1")
                        .param("state", state.toString()))
           .andExpect(status().isFound())
           .andExpect(header().string("Location",
                   org.hamcrest.Matchers.containsString("adconnect_error=token_exchange_failed")));
    }

    @Test
    void accountsListsWhatTheGrantCanSee() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption("act_1", "Dive Ads", "PHP"),
                new AdAccountOption("act_2", "Test", "USD")));

        mvc.perform(get("/api/ad-connections/meta/accounts")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2))
           .andExpect(jsonPath("$[0].id").value("act_1"))
           .andExpect(jsonPath("$[0].currency").value("PHP"));
    }

    @Test
    void selectingAnAccountActivatesTheConnection() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption("act_1", "Dive Ads", "PHP")));

        mvc.perform(post("/api/ad-connections/meta/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalAccountId\":\"act_1\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.status").value("ACTIVE"))
           .andExpect(jsonPath("$.accountName").value("Dive Ads"))
           .andExpect(jsonPath("$.currency").value("PHP"));
    }

    @Test
    void selectingAnAccountTheGrantCannotSeeIsRejected() throws Exception {
        // Guards against a client posting an arbitrary ad account id.
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption("act_1", "Dive Ads", "PHP")));

        mvc.perform(post("/api/ad-connections/meta/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalAccountId\":\"act_SOMEONE_ELSE\"}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void disconnectRevokesTheConnection() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));

        mvc.perform(delete("/api/ad-connections/meta")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isNoContent());

        AdPlatformConnection saved = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(
                AdPlatformConnection.STATUS_REVOKED, saved.getStatus());
    }

    @Test
    void anUnknownProviderIsA400NotA500() throws Exception {
        mvc.perform(post("/api/ad-connections/naver/authorize")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isBadRequest());
    }

    // ── campaign list + select ───────────────────────────────────────────────

    private void activateMetaWithAccount(String accountId) throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));
        when(metaClient.listAccounts("TOKEN")).thenReturn(List.of(
                new AdAccountOption(accountId, "Dive Ads", "PHP")));
        mvc.perform(post("/api/ad-connections/meta/account")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalAccountId\":\"" + accountId + "\"}"))
           .andExpect(status().isOk());
    }

    @Test
    void campaignsListsWhatTheAccountCanSee() throws Exception {
        activateMetaWithAccount("act_1");
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Dry-Season Promo", "ACTIVE"),
                new AdConnectionDtos.AdCampaignOption("cmp_2", "Brand", "PAUSED")));

        mvc.perform(get("/api/ad-connections/meta/campaigns")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2))
           .andExpect(jsonPath("$[0].id").value("cmp_1"))
           .andExpect(jsonPath("$[0].status").value("ACTIVE"));
    }

    @Test
    void campaignsIs409WhenNoAccountIsSelectedYet() throws Exception {
        service.storeGrant(profileId, AdProvider.META,
                new TokenGrant("TOKEN", null, null, "ads_read"));

        mvc.perform(get("/api/ad-connections/meta/campaigns")
                        .header("Authorization", "Bearer " + token))
           .andExpect(status().isConflict());
    }

    @Test
    void selectingACampaignRecordsItOnTheConnection() throws Exception {
        activateMetaWithAccount("act_1");
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Dry-Season Promo", "ACTIVE")));

        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":\"cmp_1\"}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.campaignName").value("Dry-Season Promo"));

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals("cmp_1", conn.getExternalCampaignId());
    }

    @Test
    void selectingACampaignTheAccountCannotSeeIsRejected() throws Exception {
        activateMetaWithAccount("act_1");
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE")));

        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":\"cmp_SOMEONE_ELSE\"}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void postingANullCampaignIdClearsBackToWholeAccount() throws Exception {
        activateMetaWithAccount("act_1");
        when(metaClient.listCampaigns("TOKEN", "act_1")).thenReturn(List.of(
                new AdConnectionDtos.AdCampaignOption("cmp_1", "Promo", "ACTIVE")));
        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":\"cmp_1\"}"))
           .andExpect(status().isOk());

        mvc.perform(post("/api/ad-connections/meta/campaign")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"externalCampaignId\":null}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.campaignName").doesNotExist());

        AdPlatformConnection conn = connectionRepo
                .findByBusinessProfileIdAndProvider(profileId, "meta").orElseThrow();
        org.junit.jupiter.api.Assertions.assertNull(conn.getExternalCampaignId());
    }
}
