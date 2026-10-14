package com.ceview.module4.report;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.dto.AnalyticsDtos.*;
import com.ceview.module4.engagement.MetricsCalculationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * An operator with no saved campaign records must not get a report: the funnel would be
 * four zeros, and the model would return "diagnostics" of a campaign that never ran.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class PrescriptiveReportNoDataTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    @MockBean private MetricsCalculationService metricsSvc;
    @MockBean private AIInferenceGatewayService ai;

    private String token;
    private UUID profileId;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        UUID operator = UUID.randomUUID();
        testOperators.create(operator);
        token = jwtService.issue(operator, "op@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operator);
        profile.setBusinessName("Blue Reef Divers");
        profileRepo.save(profile);
        profileId = profile.getBusinessProfileId();
    }

    @Test
    void noCampaignRecordsIs424WithTheMissingInputCodeAndNoAiCall() throws Exception {
        when(metricsSvc.hasCampaignRecords(profileId)).thenReturn(false);

        mvc.perform(post("/api/analytics/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().is(424))
            .andExpect(jsonPath("$.code").value("MOD4_REPORT_NO_CAMPAIGN_DATA"))
            .andExpect(jsonPath("$.dependency").value("campaign_records"));

        verify(ai, never()).generateReport(anyMap());
    }

    @Test
    void withCampaignRecordsTheReportIsRequestedAsBefore() throws Exception {
        Metrics metrics = new Metrics(new MetricCard(0, "%"), new MetricCard(0, "₱"),
                new MetricCard(0, "x"), new MetricCard(0, "%"), new MetricCard(0, "₱"));
        when(metricsSvc.hasCampaignRecords(profileId)).thenReturn(true);
        when(metricsSvc.defaultMetrics(eq(profileId), anyInt())).thenReturn(new MetricsResponse(metrics, List.of()));
        when(metricsSvc.computeFunnelTransitions(any())).thenReturn(List.of());
        when(ai.generateReport(anyMap())).thenReturn(Map.of("executiveSummary", "ok"));

        mvc.perform(post("/api/analytics/report")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.executiveSummary").value("ok"));

        verify(ai).generateReport(anyMap());
    }
}
