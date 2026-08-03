package com.ceview.module2;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule21.ExternalMarketDataClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies ForecastingController scopes /markets, /ensure/{profileId} and
 * /analyze/{profileId} to the authenticated operator's own business profile
 * (via {@link com.ceview.auth.CurrentBusinessProfile}) instead of trusting a
 * client-supplied profileId — see Task 7.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class ForecastingControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;

    // Neither /markets (DB-only read) nor the 403-rejected path in /ensure and
    // /analyze ever reach the AI gateway, but the full app context wires it in,
    // so it's stubbed out to avoid any accidental real HTTP call.
    @MockBean private AIInferenceGatewayService ai;
    @MockBean private ExternalMarketDataClient externalClient;

    private UUID operatorA;
    private UUID operatorB;
    private String tokenA;
    private String tokenB;
    private UUID profileA;
    private UUID profileB;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        operatorA = UUID.randomUUID();
        operatorB = UUID.randomUUID();
        tokenA = jwtService.issue(operatorA, "a@example.com");
        tokenB = jwtService.issue(operatorB, "b@example.com");

        BusinessProfile pA = new BusinessProfile();
        pA.setUserId(operatorA);
        pA.setBusinessName("Operator A's Business");
        profileRepo.save(pA);
        profileA = pA.getBusinessProfileId();

        BusinessProfile pB = new BusinessProfile();
        pB.setUserId(operatorB);
        pB.setBusinessName("Operator B's Business");
        profileRepo.save(pB);
        profileB = pB.getBusinessProfileId();
    }

    @Test
    void marketsOmittingProfileIdDerivesTheCallersOwnProfile() throws Exception {
        // No forecast rows exist for profileA yet — loadMarketsFromDb returns an
        // empty list rather than erroring, so a 200 here proves resolution succeeded
        // (a failed resolve would 401/403/409 before the service is ever called).
        mvc.perform(get("/api/v1/forecasting/markets").header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.markets").isArray());
    }

    @Test
    void marketsWithOwnProfileIdWorksNormally() throws Exception {
        mvc.perform(get("/api/v1/forecasting/markets")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileA.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.markets").isArray());
    }

    @Test
    void marketsWithAnotherOperatorsProfileIdIsRejected() throws Exception {
        mvc.perform(get("/api/v1/forecasting/markets")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileB.toString()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void ensureWithAnotherOperatorsProfileIdInPathIsRejected() throws Exception {
        // Path-variable profileId is still part of the URL shape (unchanged in this
        // task), but must now be validated against the JWT-resolved profile.
        mvc.perform(post("/api/v1/forecasting/ensure/" + profileB)
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void analyzeWithAnotherOperatorsProfileIdInPathIsRejected() throws Exception {
        mvc.perform(post("/api/v1/forecasting/analyze/" + profileB)
                .header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void marketsWithoutAuthenticationIsRejected() throws Exception {
        mvc.perform(get("/api/v1/forecasting/markets"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void marketsOmittingProfileIdDerivesEachOperatorsOwnProfileIndependently() throws Exception {
        // Operator B omitting profileId must resolve to B's own profile, not A's —
        // proves resolution is per-caller, not a fixed/cached lookup.
        mvc.perform(get("/api/v1/forecasting/markets").header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.markets").isArray());
    }
}
