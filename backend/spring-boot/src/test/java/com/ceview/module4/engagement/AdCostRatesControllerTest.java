package com.ceview.module4.engagement;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.dto.AnalyticsDtos.ManualIngestRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CVW-43 — the ad planner's budget estimate rests on the operator's own past
 * cost rates, so they must be the operator's, from paid weeks only, and absent
 * rather than invented when there is no history.
 *
 * <p>Each test uses fresh operators instead of clearing tables: the endpoint is
 * tenant-scoped, so other tests' rows are invisible to it by construction.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AdCostRatesControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private CampaignRecordRepository campaignRepo;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    private String tokenA;
    private String tokenB;
    private UUID profileA;

    @BeforeEach
    void setUp() {
        UUID operatorA = UUID.randomUUID();
        UUID operatorB = UUID.randomUUID();
        testOperators.create(operatorA);
        testOperators.create(operatorB);
        tokenA = jwtService.issue(operatorA, "a-" + operatorA + "@example.com");
        tokenB = jwtService.issue(operatorB, "b-" + operatorB + "@example.com");
        profileA = saveProfile(operatorA);
        saveProfile(operatorB);
    }

    @Test
    void ratesComeFromTheOperatorsOwnPaidWeeks() throws Exception {
        saveWeek(profileA, 20000, 400, 1500);   // paid
        saveWeek(profileA, 30000, 600, 2500);   // paid
        saveWeek(profileA, 50000, 900, 0);      // no spend: excluded, or ads would look cheaper

        mvc.perform(get("/api/analytics/cost-rates").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periods").value(2))
                .andExpect(jsonPath("$.totalImpressions").value(50000))
                .andExpect(jsonPath("$.totalClicks").value(1000))
                // ₱4,000 over 50,000 impressions and 1,000 clicks.
                .andExpect(jsonPath("$.costPerThousandImpressions").value(80.0))
                .andExpect(jsonPath("$.costPerClick").value(4.0));
    }

    @Test
    void noHistoryMeansNoRatesRatherThanInventedOnes() throws Exception {
        saveWeek(profileA, 20000, 400, 1500);

        mvc.perform(get("/api/analytics/cost-rates").header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.periods").value(0))
                .andExpect(jsonPath("$.costPerThousandImpressions").doesNotExist())
                .andExpect(jsonPath("$.costPerClick").doesNotExist());
    }

    private UUID saveProfile(UUID operatorId) {
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Operator " + operatorId);
        return profileRepo.save(profile).getBusinessProfileId();
    }

    private void saveWeek(UUID profileId, int impressions, int clicks, double spend) {
        CampaignRecord week = CampaignRecord.from(new ManualIngestRequest(
                impressions, clicks, spend, 0.0, 10, 2, 1, "2026-09-01", "2026-09-07"));
        week.setBusinessProfileId(profileId);
        campaignRepo.save(week);
    }
}
