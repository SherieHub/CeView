package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.common.crypto.TokenCipher;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.social.publish.SocialPost;
import com.ceview.module3.social.publish.SocialPostRepository;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.MetaTargetingClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Spend limits, Meta's minimum budget and interest search: what the Publish window needs before a paid ad. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "ceview.adplatform.meta.app-id=test-meta-app",
        "ceview.adplatform.meta.app-secret=test-meta-secret"
})
class MetaAdPlanningControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AdPlatformConnectionRepository connectionRepo;
    @Autowired private AdSpendLimitRepository limitRepo;
    @Autowired private SocialPostRepository postRepo;
    @Autowired private TokenCipher cipher;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;
    @MockBean private MetaTargetingClient meta;

    private String token;
    private String otherToken;
    private UUID profileId;
    private UUID otherProfileId;

    @BeforeEach
    void setUp() {
        postRepo.deleteAll();
        limitRepo.deleteAll();
        connectionRepo.deleteAll();
        profileRepo.deleteAll();
        token = operator("a@example.com", "Operator A", true);
        profileId = profileRepo.findAll().stream().filter(p -> "Operator A".equals(p.getBusinessName())).findFirst().orElseThrow().getBusinessProfileId();
        otherToken = operator("b@example.com", "Operator B", true);
        otherProfileId = profileRepo.findAll().stream().filter(p -> "Operator B".equals(p.getBusinessName())).findFirst().orElseThrow().getBusinessProfileId();
        connect(profileId, "act_111");
        connect(otherProfileId, "act_222");
    }

    private String operator(String email, String business, boolean withProfile) {
        UUID operator = UUID.randomUUID();
        testOperators.create(operator);
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operator);
        profile.setBusinessName(business);
        profileRepo.save(profile);
        return jwtService.issue(operator, email);
    }

    private void connect(UUID profile, String accountId) {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profile);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted(cipher.encrypt("meta-token-" + accountId));
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        conn.setExternalAccountId(accountId);
        conn.setCurrency("PHP");
        connectionRepo.save(conn);
    }

    private static MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void limitsAreNotSetUntilTheOperatorSavesThemAndShowTheAccountCurrency() throws Exception {
        mvc.perform(as(get("/api/ad-connections/meta/limits"), token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.configured").value(false))
           .andExpect(jsonPath("$.currency").value("PHP"))
           .andExpect(jsonPath("$.committedMinor").value(0));
    }

    @Test
    void savingLimitsStoresThemInTheAccountCurrencyAndUpdatesThemInPlace() throws Exception {
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":50000,\"maxTotalMinor\":1000000}"))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.configured").value(true))
           .andExpect(jsonPath("$.currency").value("PHP"))
           .andExpect(jsonPath("$.maxDailyMinor").value(50000))
           .andExpect(jsonPath("$.maxTotalMinor").value(1000000));
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":20000,\"maxTotalMinor\":300000}"))
           .andExpect(status().isOk());

        mvc.perform(as(get("/api/ad-connections/meta/limits"), token))
           .andExpect(jsonPath("$.maxDailyMinor").value(20000))
           .andExpect(jsonPath("$.maxTotalMinor").value(300000));
        org.junit.jupiter.api.Assertions.assertEquals(1, limitRepo.findAll().stream().filter(l -> l.getBusinessProfileId().equals(profileId)).count());
    }

    @Test
    void rejectsLimitsThatAreNotPositiveOrWhoseTotalIsBelowTheDailyAmount() throws Exception {
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":0,\"maxTotalMinor\":1000}"))
           .andExpect(status().isBadRequest());
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":1000,\"maxTotalMinor\":999}"))
           .andExpect(status().isBadRequest());
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":1000}"))
           .andExpect(status().isBadRequest());
    }

    @Test
    void aLimitSavedUnderAnotherCurrencyShowsAsNotSet() throws Exception {
        AdSpendLimit old = new AdSpendLimit();
        old.setBusinessProfileId(profileId); old.setCurrency("USD"); old.setMaxDailyMinor(100); old.setMaxTotalMinor(1000);
        limitRepo.save(old);

        mvc.perform(as(get("/api/ad-connections/meta/limits"), token))
           .andExpect(jsonPath("$.configured").value(false))
           .andExpect(jsonPath("$.currency").value("PHP"));
    }

    @Test
    void limitsAreSeparatePerBusiness() throws Exception {
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":50000,\"maxTotalMinor\":1000000}"))
           .andExpect(status().isOk());

        mvc.perform(as(get("/api/ad-connections/meta/limits"), otherToken))
           .andExpect(jsonPath("$.configured").value(false));
    }

    @Test
    void reportsWhatActiveAdsAlreadyCommitToTheTotal() throws Exception {
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":50000,\"maxTotalMinor\":1000000}"));
        postRepo.save(ad(profileId, "PUBLISHED", 10_000L, 10));
        postRepo.save(ad(profileId, "FAILED", 99_999L, 10));      // failed ads commit nothing
        postRepo.save(ad(otherProfileId, "PUBLISHED", 77_777L, 10)); // nor do another business's

        mvc.perform(as(get("/api/ad-connections/meta/limits"), token))
           .andExpect(jsonPath("$.committedMinor").value(100_000));
    }

    private SocialPost ad(UUID profile, String status, long daily, int days) {
        SocialPost p = new SocialPost();
        p.setBusinessProfileId(profile); p.setRequestId(UUID.randomUUID()); p.setMediaAssetId(UUID.randomUUID());
        p.setPlatform("meta_ads"); p.setCaption("c"); p.setVisibility("public"); p.setStatus(status);
        p.setAdDailyBudgetMinor(daily);
        p.setAdStartTime(OffsetDateTime.now().minusMinutes(1)); p.setAdEndTime(OffsetDateTime.now().minusMinutes(1).plusDays(days));
        return p;
    }

    @Test
    void limitsNeedAConnectedMetaAdAccount() throws Exception {
        connectionRepo.deleteAll();

        mvc.perform(as(get("/api/ad-connections/meta/limits"), token)).andExpect(status().isConflict());
        mvc.perform(as(put("/api/ad-connections/meta/limits"), token).content("{\"maxDailyMinor\":1,\"maxTotalMinor\":1}"))
           .andExpect(status().isConflict());
    }

    /** The minimum is remembered per ad account, so each test uses an account of its own. */
    private String freshAccount() {
        String account = "act_" + System.nanoTime();
        connectionRepo.deleteAll();
        connect(profileId, account);
        return account;
    }

    @Test
    void minimumBudgetComesFromMetaForTheObjectiveAndIsRemembered() throws Exception {
        String account = freshAccount();
        when(meta.minimumDailyBudget(eq("meta-token-" + account), eq(account), eq("OUTCOME_TRAFFIC")))
                .thenReturn(Optional.of(new MetaTargetingClient.MinimumBudget("PHP", 6332)));

        for (int i = 0; i < 2; i++) {
            mvc.perform(as(get("/api/ad-connections/meta/minimum-budget").param("objective", "OUTCOME_TRAFFIC"), token))
               .andExpect(status().isOk())
               .andExpect(jsonPath("$.currency").value("PHP"))
               .andExpect(jsonPath("$.minDailyMinor").value(6332));
        }
        verify(meta, times(1)).minimumDailyBudget(anyString(), anyString(), anyString());
    }

    @Test
    void minimumBudgetIsNullWhenMetaGivesNone() throws Exception {
        String account = freshAccount();
        when(meta.minimumDailyBudget(anyString(), eq(account), eq("OUTCOME_AWARENESS"))).thenReturn(Optional.empty());

        mvc.perform(as(get("/api/ad-connections/meta/minimum-budget").param("objective", "OUTCOME_AWARENESS"), token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.currency").value("PHP"))
           .andExpect(jsonPath("$.minDailyMinor").doesNotExist());
    }

    @Test
    void aFailedMinimumLookupIsNotRememberedSoTheNextRequestTriesAgain() throws Exception {
        String account = freshAccount();
        when(meta.minimumDailyBudget(anyString(), eq(account), eq("OUTCOME_ENGAGEMENT")))
                .thenThrow(new AdPlatformException("Meta API call failed"))
                .thenReturn(Optional.of(new MetaTargetingClient.MinimumBudget("PHP", 6332)));

        mvc.perform(as(get("/api/ad-connections/meta/minimum-budget").param("objective", "OUTCOME_ENGAGEMENT"), token))
           .andExpect(status().isOk()).andExpect(jsonPath("$.minDailyMinor").doesNotExist());
        mvc.perform(as(get("/api/ad-connections/meta/minimum-budget").param("objective", "OUTCOME_ENGAGEMENT"), token))
           .andExpect(status().isOk()).andExpect(jsonPath("$.minDailyMinor").value(6332));
    }

    @Test
    void minimumBudgetRejectsAnUnknownObjective() throws Exception {
        mvc.perform(as(get("/api/ad-connections/meta/minimum-budget").param("objective", "OUTCOME_SALES"), token))
           .andExpect(status().isBadRequest());
    }

    @Test
    void interestSearchReturnsMetasOptions() throws Exception {
        when(meta.searchInterests("meta-token-act_111", "scuba"))
                .thenReturn(List.of(new MetaTargetingClient.InterestOption("6003020834693", "Scuba diving", "Interests › Sports")));

        mvc.perform(as(get("/api/ad-connections/meta/interests").param("q", "scuba"), token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[0].id").value("6003020834693"))
           .andExpect(jsonPath("$[0].name").value("Scuba diving"))
           .andExpect(jsonPath("$[0].path").value("Interests › Sports"));
    }

    @Test
    void interestSearchNeedsAReasonableQueryAndReportsMetaFailuresAsABadGateway() throws Exception {
        mvc.perform(as(get("/api/ad-connections/meta/interests").param("q", "s"), token)).andExpect(status().isBadRequest());
        mvc.perform(as(get("/api/ad-connections/meta/interests").param("q", "x".repeat(101)), token)).andExpect(status().isBadRequest());

        when(meta.searchInterests(anyString(), eq("diving"))).thenThrow(new AdPlatformException("Meta API 400: boom"));
        mvc.perform(as(get("/api/ad-connections/meta/interests").param("q", "diving"), token)).andExpect(status().isBadGateway());
    }

    @Test
    void everyRouteNeedsALogin() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/limits")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/ad-connections/meta/minimum-budget").param("objective", "OUTCOME_TRAFFIC")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/ad-connections/meta/interests").param("q", "scuba")).andExpect(status().isUnauthorized());
    }
}
