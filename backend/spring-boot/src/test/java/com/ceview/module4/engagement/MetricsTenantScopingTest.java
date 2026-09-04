package com.ceview.module4.engagement;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.dto.AnalyticsDtos.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression guard for Task 13: {@code GET /api/analytics/metrics} must be scoped to
 * the JWT-resolved business profile rather than the old unscoped
 * {@code defaultMetrics(int weeks)} signature that returned identical hardcoded demo
 * numbers to every operator.
 *
 * <p>Follows the same Mockito/MockMvc conventions as {@link EngagementMetricsControllerTest}:
 * a real JWT + real {@link BusinessProfileRepository} resolve the profile id, while
 * {@link MetricsCalculationService} is mocked so we can assert exactly which profile id
 * the controller passed through.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class MetricsTenantScopingTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;

    @MockBean private MetricsCalculationService metricsSvc;
    @MockBean private AIInferenceGatewayService ai;

    private String tokenA;
    private String tokenB;
    private UUID profileA;
    private UUID profileB;

    private static final Metrics EMPTY_METRICS = new Metrics(
            new MetricCard(0, "%", 0, true),
            new MetricCard(0, "₱", 0, true),
            new MetricCard(0, "x", 0, true),
            new MetricCard(0, "%", 0, false),
            new MetricCard(0, "₱", 0, false)
    );
    private static final MetricsResponse EMPTY_RESPONSE =
            new MetricsResponse(EMPTY_METRICS, List.of());

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();

        UUID operatorA = UUID.randomUUID();
        UUID operatorB = UUID.randomUUID();
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

        when(metricsSvc.defaultMetrics(eq(profileA), eq(4))).thenReturn(EMPTY_RESPONSE);
        when(metricsSvc.defaultMetrics(eq(profileB), eq(4))).thenReturn(EMPTY_RESPONSE);
    }

    @Test
    void metricsPassesJwtResolvedProfileIdThroughToService() throws Exception {
        mvc.perform(get("/api/analytics/metrics")
                        .header("Authorization", "Bearer " + tokenA)
                        .param("weeks", "4"))
                .andExpect(status().isOk());

        verify(metricsSvc).defaultMetrics(profileA, 4);
    }

    @Test
    void differentProfilesProduceDifferentServiceCalls() throws Exception {
        mvc.perform(get("/api/analytics/metrics")
                        .header("Authorization", "Bearer " + tokenA)
                        .param("weeks", "4"))
                .andExpect(status().isOk());

        mvc.perform(get("/api/analytics/metrics")
                        .header("Authorization", "Bearer " + tokenB)
                        .param("weeks", "4"))
                .andExpect(status().isOk());

        verify(metricsSvc).defaultMetrics(profileA, 4);
        verify(metricsSvc).defaultMetrics(profileB, 4);
    }
}
