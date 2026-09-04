package com.ceview.module4.engagement;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies EngagementMetricsController scopes /manual and /history to the
 * authenticated operator's own business profile (via
 * {@link com.ceview.auth.CurrentBusinessProfile}) — see Task 9.
 *
 * <p>{@code /metrics} is intentionally NOT covered here: it only returns
 * synthetic demo data (out of scope per Task 9), and is already covered by
 * Task 5's blanket authentication requirement on all {@code /api/**} routes.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class EngagementMetricsControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private CampaignRecordRepository campaignRepo;

    @MockBean private AIInferenceGatewayService ai;

    private UUID operatorA;
    private UUID operatorB;
    private UUID operatorNoProfile;
    private String tokenA;
    private String tokenB;
    private String tokenNoProfile;
    private UUID profileA;
    private UUID profileB;

    @BeforeEach
    void setUp() {
        campaignRepo.deleteAll();
        profileRepo.deleteAll();

        operatorA = UUID.randomUUID();
        operatorB = UUID.randomUUID();
        operatorNoProfile = UUID.randomUUID();
        tokenA = jwtService.issue(operatorA, "a@example.com");
        tokenB = jwtService.issue(operatorB, "b@example.com");
        tokenNoProfile = jwtService.issue(operatorNoProfile, "noprofile@example.com");

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

        // FastAPI PES compute is stubbed to fail so /manual exercises the FR4.26
        // rule-based fallback deterministically, without depending on a real
        // FastAPI service being reachable during tests.
        when(ai.computePesFromRaw(any())).thenThrow(new RuntimeException("FastAPI unavailable in test"));
    }

    private String manualIngestBody() throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "impressions", 1000,
                "clicks", 50,
                "adSpend", 200.0,
                "revenue", 800.0,
                "conversions", 20,
                "bookings", 5,
                "newCustomers", 3,
                "periodStart", "2026-07-01",
                "periodEnd", "2026-07-07"
        ));
    }

    @Test
    void manualIngestPersistsRecordWithAuthenticatedOperatorsBusinessProfileId() throws Exception {
        mvc.perform(post("/api/analytics/manual")
                        .header("Authorization", "Bearer " + tokenA)
                        .contentType("application/json")
                        .content(manualIngestBody()))
                .andExpect(status().isOk());

        var records = campaignRepo.findByBusinessProfileIdOrderByCreatedAtDesc(profileA, PageRequest.of(0, 10));
        org.junit.jupiter.api.Assertions.assertEquals(1, records.size());
        org.junit.jupiter.api.Assertions.assertEquals(profileA, records.get(0).getBusinessProfileId());
    }

    @Test
    void manualIngestWithoutBusinessProfileReturns409() throws Exception {
        mvc.perform(post("/api/analytics/manual")
                        .header("Authorization", "Bearer " + tokenNoProfile)
                        .contentType("application/json")
                        .content(manualIngestBody()))
                .andExpect(status().isConflict());

        org.junit.jupiter.api.Assertions.assertEquals(0, campaignRepo.count());
    }

    @Test
    void historyOnlyReturnsAuthenticatedOperatorsOwnRecords() throws Exception {
        // Seed one record for operator A and two for operator B directly via the
        // repository (bypassing the endpoint) to prove /history filters by the
        // caller's resolved business_profile_id rather than returning everything.
        CampaignRecord recA = CampaignRecord.from(new com.ceview.module4.dto.AnalyticsDtos.ManualIngestRequest(
                1000, 50, 200.0, 800.0, 20, 5, 3, "2026-07-01", "2026-07-07"));
        recA.setBusinessProfileId(profileA);
        recA.enrichWithKpis(5.0, 4.0, 40.0, 4.0, 10.0);
        campaignRepo.save(recA);

        CampaignRecord recB1 = CampaignRecord.from(new com.ceview.module4.dto.AnalyticsDtos.ManualIngestRequest(
                2000, 100, 300.0, 900.0, 30, 8, 4, "2026-07-01", "2026-07-07"));
        recB1.setBusinessProfileId(profileB);
        recB1.enrichWithKpis(5.0, 4.0, 40.0, 4.0, 10.0);
        campaignRepo.save(recB1);

        CampaignRecord recB2 = CampaignRecord.from(new com.ceview.module4.dto.AnalyticsDtos.ManualIngestRequest(
                2500, 120, 350.0, 950.0, 32, 9, 5, "2026-07-08", "2026-07-14"));
        recB2.setBusinessProfileId(profileB);
        recB2.enrichWithKpis(5.0, 4.0, 40.0, 4.0, 10.0);
        campaignRepo.save(recB2);

        mvc.perform(get("/api/analytics/history")
                        .header("Authorization", "Bearer " + tokenA)
                        .param("weeks", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshots.length()").value(1))
                .andExpect(jsonPath("$.snapshots[0].periodStart").value("2026-07-01"));

        mvc.perform(get("/api/analytics/history")
                        .header("Authorization", "Bearer " + tokenB)
                        .param("weeks", "4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.snapshots.length()").value(2));
    }

    @Test
    void historyWithoutBusinessProfileReturns409() throws Exception {
        mvc.perform(get("/api/analytics/history")
                        .header("Authorization", "Bearer " + tokenNoProfile)
                        .param("weeks", "4"))
                .andExpect(status().isConflict());
    }

    @Test
    void manualIngestWithoutAuthenticationIsRejected() throws Exception {
        mvc.perform(post("/api/analytics/manual")
                        .contentType("application/json")
                        .content(manualIngestBody()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void historyWithoutAuthenticationIsRejected() throws Exception {
        mvc.perform(get("/api/analytics/history"))
                .andExpect(status().isUnauthorized());
    }
}
