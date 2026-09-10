package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * GET /api/ad-connections always answers for BOTH providers, so the Settings UI
 * can render a row per provider without guessing. Meta is configured here,
 * TikTok is not — the response must distinguish them.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "ceview.adplatform.meta.app-id=test-meta-app",
        "ceview.adplatform.meta.app-secret=test-meta-secret"
})
class AdConnectionListTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AdPlatformConnectionRepository connectionRepo;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        connectionRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorId = UUID.randomUUID();
        token = jwtService.issue(operatorId, "operator@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Cebu Dive Co.");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void reportsBothProvidersWithTheirConfiguredFlag() throws Exception {
        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$.length()").value(2))
           .andExpect(jsonPath("$[?(@.provider=='meta')].configured").value(true))
           .andExpect(jsonPath("$[?(@.provider=='tiktok')].configured").value(false))
           .andExpect(jsonPath("$[?(@.provider=='meta')].status").value("DISCONNECTED"));
    }

    @Test
    void reportsAnActiveConnectionWithItsAccountAndCurrency() throws Exception {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("cipher");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        conn.setExternalAccountId("act_123");
        conn.setExternalAccountName("Cebu Dive Ads");
        conn.setCurrency("PHP");
        connectionRepo.save(conn);

        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[?(@.provider=='meta')].status").value("ACTIVE"))
           .andExpect(jsonPath("$[?(@.provider=='meta')].accountName").value("Cebu Dive Ads"))
           .andExpect(jsonPath("$[?(@.provider=='meta')].currency").value("PHP"));
    }

    @Test
    void neverLeaksTokensToTheClient() throws Exception {
        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(profileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("SUPER-SECRET-CIPHERTEXT");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        connectionRepo.save(conn);

        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(content().string(org.hamcrest.Matchers.not(
                   org.hamcrest.Matchers.containsString("SUPER-SECRET-CIPHERTEXT"))))
           .andExpect(content().string(org.hamcrest.Matchers.not(
                   org.hamcrest.Matchers.containsString("accessToken"))));
    }

    @Test
    void doesNotReturnAnotherOperatorsConnection() throws Exception {
        UUID otherOperator = UUID.randomUUID();
        BusinessProfile other = new BusinessProfile();
        other.setUserId(otherOperator);
        other.setBusinessName("Someone Else");
        UUID otherProfileId = profileRepo.save(other).getBusinessProfileId();

        AdPlatformConnection conn = new AdPlatformConnection();
        conn.setBusinessProfileId(otherProfileId);
        conn.setProvider(AdProvider.META.key());
        conn.setAccessTokenEncrypted("cipher");
        conn.setStatus(AdPlatformConnection.STATUS_ACTIVE);
        conn.setExternalAccountName("Not Yours");
        connectionRepo.save(conn);

        mvc.perform(get("/api/ad-connections").header("Authorization", "Bearer " + token))
           .andExpect(status().isOk())
           .andExpect(jsonPath("$[?(@.provider=='meta')].status").value("DISCONNECTED"));
    }
}
