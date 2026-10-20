package com.ceview.module3.social;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.social.client.MetaGraphClient;
import com.ceview.module3.social.client.MetaGraphClient.PageInfo;
import com.ceview.module3.social.client.TikTokContentClient;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import com.ceview.module4.adconnections.AdConnectionService;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.common.crypto.TokenCipher;
import com.ceview.testsupport.TestOperators;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "ceview.adplatform.frontend-base-url=http://localhost:5173",
        "ceview.adplatform.meta.app-id=test-meta-app",
        "ceview.adplatform.meta.app-secret=test-meta-secret"
})
class SocialConnectionControllerTest {

    private static final String PUBLISH_SCOPES =
            "ads_read,pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish";

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private PublishingAccountRepository accountRepo;
    @Autowired private AdPlatformConnectionRepository metaRepo;
    @Autowired private AdConnectionService adConnectionService;
    @Autowired private TokenCipher cipher;
    @Autowired private TestOperators testOperators;
    @MockBean private MetaGraphClient graph;
    @MockBean private TikTokContentClient tiktok;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        accountRepo.deleteAll();
        metaRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorId = UUID.randomUUID();
        testOperators.create(operatorId);
        token = jwtService.issue(operatorId, "operator@example.com");
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();

        when(tiktok.isConfigured()).thenReturn(true);
    }

    private String bearer() {
        return "Bearer " + token;
    }

    private void metaLogin() {
        AdPlatformConnection c = new AdPlatformConnection();
        c.setBusinessProfileId(profileId);
        c.setProvider("meta");
        c.setAccessTokenEncrypted(cipher.encrypt("USER-TOKEN"));
        c.setScopes(PUBLISH_SCOPES);
        c.setStatus(AdPlatformConnection.STATUS_PENDING_ACCOUNT_SELECTION);
        metaRepo.save(c);
    }

    @Test
    void listRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/social-connections")).andExpect(status().isUnauthorized());
    }

    @Test
    void listReportsAllThreePlatformsAndNeverLeaksTokens() throws Exception {
        metaLogin();
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                new PageInfo("111", "Cebu Dive Co.", "PAGE-TOKEN-SECRET", "179", "cebu.dive")));
        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                .contentType(MediaType.APPLICATION_JSON).content("{\"pageId\":\"111\"}")).andExpect(status().isOk());

        mvc.perform(get("/api/social-connections").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.platform=='facebook')].status").value("ACTIVE"))
                .andExpect(jsonPath("$[?(@.platform=='facebook')].handle").value("Cebu Dive Co."))
                .andExpect(jsonPath("$[?(@.platform=='instagram')].handle").value("@cebu.dive"))
                .andExpect(jsonPath("$[?(@.platform=='tiktok')].status").value("DISCONNECTED"))
                .andExpect(content().string(not(containsString("PAGE-TOKEN-SECRET"))))
                .andExpect(content().string(not(containsString("USER-TOKEN"))))
                .andExpect(content().string(not(containsString("ccessToken"))));
    }

    @Test
    void metaPagesIsAConflictBeforeMetaIsConnected() throws Exception {
        mvc.perform(get("/api/social-connections/meta/pages").header("Authorization", bearer()))
                .andExpect(status().isConflict());
    }

    @Test
    void metaPagesListsTheChoices() throws Exception {
        metaLogin();
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(
                new PageInfo("111", "Cebu Dive Co.", "T1", "179", "cebu.dive"),
                new PageInfo("222", "Mactan Cafe", "T2", null, null)));

        mvc.perform(get("/api/social-connections/meta/pages").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("111"))
                .andExpect(jsonPath("$[0].instagramUsername").value("cebu.dive"))
                .andExpect(jsonPath("$[1].instagramUsername").doesNotExist());
    }

    @Test
    void selectingAPageReturnsTheFreshConnectionList() throws Exception {
        metaLogin();
        when(graph.listPages("USER-TOKEN")).thenReturn(List.of(new PageInfo("222", "Mactan Cafe", "T2", null, null)));

        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"pageId\":\"222\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.platform=='facebook')].status").value("ACTIVE"))
                .andExpect(jsonPath("$[?(@.platform=='instagram')].status").value("NO_LINKED_INSTAGRAM"));
    }

    @Test
    void selectingAnUnknownPageIsABadRequest() throws Exception {
        metaLogin();
        when(graph.listPages(anyString())).thenReturn(List.of(new PageInfo("111", "X", "T", null, null)));

        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"pageId\":\"999\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void selectingWithoutAPageIdIsABadRequest() throws Exception {
        metaLogin();

        mvc.perform(put("/api/social-connections/meta/page").header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void tiktokAuthorizeReturnsTheConsentUrl() throws Exception {
        when(tiktok.buildAuthorizeUrl(anyString())).thenReturn("https://www.tiktok.com/v2/auth/authorize/?client_key=K");

        mvc.perform(post("/api/social-connections/tiktok/authorize").header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorizeUrl").value("https://www.tiktok.com/v2/auth/authorize/?client_key=K"));
    }

    @Test
    void tiktokAuthorizeIsUnavailableWhenTheServerHasNoCredentials() throws Exception {
        when(tiktok.isConfigured()).thenReturn(false);

        mvc.perform(post("/api/social-connections/tiktok/authorize").header("Authorization", bearer()))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void tiktokCallbackOnlyRedirectsWithCodeAndStateAndTouchesNothing() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");

        // No Authorization header: the browser arrives straight from TikTok.
        mvc.perform(get("/api/social-connections/tiktok/callback").param("code", "CODE-1").param("state", state.toString()))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("http://localhost:5173/settings/platforms")))
                .andExpect(header().string("Location", containsString("tiktok_code=CODE-1")))
                .andExpect(header().string("Location", containsString("state=" + state)))
                .andExpect(header().string("Location", not(containsString("social=tiktok"))));

        verify(tiktok, never()).exchangeCode(anyString());
        assertThat(accountRepo.findAll()).isEmpty();
        // The state was not burned by the redirect: the authenticated completion can still use it.
        assertThat(adConnectionService.consumeState(state, "tiktok_creator")).isEqualTo(profileId);
    }

    @Test
    void tiktokCallbackPercentEncodesTheAttackerInfluencedValues() throws Exception {
        mvc.perform(get("/api/social-connections/tiktok/callback")
                        .param("code", "a+b&c=d#e/f").param("state", "x y&z"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("tiktok_code=a%2Bb%26c%3Dd%23e%2Ff")))
                .andExpect(header().string("Location", containsString("state=x%20y%26z")));
    }

    @Test
    void tiktokCallbackMapsOAuthErrorsToASafeBoundedCode() throws Exception {
        mvc.perform(get("/api/social-connections/tiktok/callback").param("error", "access_denied"))
                .andExpect(header().string("Location", containsString("social_error=access_denied")));

        mvc.perform(get("/api/social-connections/tiktok/callback").param("error", "<script>alert(1)</script>"))
                .andExpect(header().string("Location", containsString("social_error=consent_declined")))
                .andExpect(header().string("Location", not(containsString("script"))));
    }

    @Test
    void tiktokCallbackWithoutCodeOrStateRedirectsWithAnError() throws Exception {
        mvc.perform(get("/api/social-connections/tiktok/callback"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", containsString("social_error=missing_code_or_state")));
    }

    private ResultActions complete(String authorization, String code, String state) throws Exception {
        var request = post("/api/social-connections/tiktok/complete")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"" + code + "\",\"state\":\"" + state + "\"}");
        if (authorization != null) {
            request = request.header("Authorization", authorization);
        }
        return mvc.perform(request);
    }

    @Test
    void completeStoresTheGrantForTheCallerAndReturnsTheFreshList() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode("CODE-1")).thenReturn(new CreatorGrant(
                "ACCESS-1", "REFRESH-1", OffsetDateTime.now().plusDays(1), OffsetDateTime.now().plusDays(365), "OPEN-1", "video.upload"));
        when(tiktok.fetchDisplayName("ACCESS-1")).thenReturn("Cebu Dive");

        complete(bearer(), "CODE-1", state.toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3))
                .andExpect(jsonPath("$[?(@.platform=='tiktok')].status").value("ACTIVE"))
                .andExpect(jsonPath("$[?(@.platform=='tiktok')].handle").value("Cebu Dive"))
                .andExpect(content().string(not(containsString("ACCESS-1"))));

        PublishingAccount account = accountRepo.findByBusinessProfileIdAndPlatform(profileId, "tiktok").orElseThrow();
        assertThat(account.getDisplayName()).isEqualTo("Cebu Dive");
        assertThat(account.getStatus()).isEqualTo("ACTIVE");
    }

    @Test
    void completeRequiresAuthentication() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");

        complete(null, "CODE-1", state.toString()).andExpect(status().isUnauthorized());

        verify(tiktok, never()).exchangeCode(anyString());
    }

    @Test
    void completeRefusesAStateThatAnotherOperatorStartedAndBurnsIt() throws Exception {
        UUID otherOperator = UUID.randomUUID();
        testOperators.create(otherOperator);
        BusinessProfile other = new BusinessProfile();
        other.setUserId(otherOperator);
        other.setBusinessName("Someone Else");
        UUID otherProfileId = profileRepo.save(other).getBusinessProfileId();
        UUID foreignState = adConnectionService.mintState(otherProfileId, "tiktok_creator");

        complete(bearer(), "CODE-1", foreignState.toString()).andExpect(status().isForbidden());

        verify(tiktok, never()).exchangeCode(anyString());
        assertThat(accountRepo.findAll()).isEmpty();
        // Burned: even the rightful owner cannot reuse it now.
        String otherToken = jwtService.issue(otherOperator, "other@example.com");
        complete("Bearer " + otherToken, "CODE-1", foreignState.toString()).andExpect(status().isBadRequest());
    }

    @Test
    void completeRejectsAReplayedState() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode("CODE-1")).thenReturn(new CreatorGrant("A", "R", null, null, "OPEN-1", "s"));
        complete(bearer(), "CODE-1", state.toString()).andExpect(status().isOk());

        complete(bearer(), "CODE-1", state.toString()).andExpect(status().isBadRequest());
    }

    @Test
    void completeRejectsAStateMintedForAnotherProviderAndAMalformedState() throws Exception {
        UUID metaState = adConnectionService.mintState(profileId, "meta");

        complete(bearer(), "CODE-1", metaState.toString()).andExpect(status().isBadRequest());
        complete(bearer(), "CODE-1", "not-a-uuid").andExpect(status().isBadRequest());
        assertThat(accountRepo.findAll()).isEmpty();
    }

    @Test
    void completeRejectsABlankCodeOrState() throws Exception {
        complete(bearer(), "", UUID.randomUUID().toString()).andExpect(status().isBadRequest());
        complete(bearer(), "CODE-1", "").andExpect(status().isBadRequest());
    }

    @Test
    void completeReportsAFailedTokenExchangeAs502() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode(anyString())).thenThrow(new SocialPlatformException("TikTok rejected the authorization"));

        complete(bearer(), "BAD", state.toString()).andExpect(status().isBadGateway());
        assertThat(accountRepo.findAll()).isEmpty();
    }

    @Test
    void disconnectRemovesTheConnection() throws Exception {
        UUID state = adConnectionService.mintState(profileId, "tiktok_creator");
        when(tiktok.exchangeCode(anyString())).thenReturn(new CreatorGrant("A", "R", null, null, "OPEN-1", "s"));
        complete(bearer(), "C", state.toString()).andExpect(status().isOk());

        mvc.perform(delete("/api/social-connections/tiktok").header("Authorization", bearer()))
                .andExpect(status().isNoContent());

        mvc.perform(get("/api/social-connections").header("Authorization", bearer()))
                .andExpect(jsonPath("$[?(@.platform=='tiktok')].status").value("DISCONNECTED"));
    }

    @Test
    void disconnectingAnUnknownPlatformIsABadRequest() throws Exception {
        mvc.perform(delete("/api/social-connections/myspace").header("Authorization", bearer()))
                .andExpect(status().isBadRequest());
    }
}
