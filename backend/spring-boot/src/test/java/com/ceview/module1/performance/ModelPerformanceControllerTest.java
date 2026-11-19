package com.ceview.module1.performance;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.ClassificationRun;
import com.ceview.module1.businessinput.ClassificationRunRepository;
import com.ceview.testsupport.TestOperators;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import java.time.OffsetDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "ceview.model-performance.admin-operator-ids=50000000-0000-0000-0000-000000000001")
@AutoConfigureMockMvc
class ModelPerformanceControllerTest {
    private static final UUID ADMIN = UUID.fromString("50000000-0000-0000-0000-000000000001");
    private static final UUID OTHER = UUID.fromString("50000000-0000-0000-0000-000000000002");
    private static final String URL = "/api/admin/model-performance";
    private static final OffsetDateTime START = OffsetDateTime.parse("2026-11-01T00:00:00Z");
    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired TestOperators operators;
    @Autowired ClassificationRunRepository runs;
    @Autowired ObjectMapper mapper;
    String token;

    @BeforeEach void setup() {
        runs.deleteAll();
        operators.create(ADMIN);
        operators.create(OTHER);
        token = jwt.issue(ADMIN, "admin@example.com");
    }

    void seed(UUID operator, String version, String purpose, double confidence, double latency,
              Boolean overridden, OffsetDateTime at) {
        var run = new ClassificationRun();
        run.setRunId(UUID.randomUUID());
        run.setOperatorId(operator);
        run.setCreatedAt(at);
        run.setRunPurpose(purpose);
        run.setInputDescription("Private description that must not be returned");
        run.setInputUvp("Private UVP");
        run.setInputServices(List.of("Private service"));
        run.setTopCategory("Coastal & Island");
        run.setTopConfidence(confidence);
        run.setCategoryScores(Map.of("Coastal & Island", confidence));
        run.setPredictedCategories(Map.of("Coastal & Island", confidence));
        run.setRecommendedCategories(List.of("Coastal & Island"));
        run.setModelVersion(version);
        run.setInferenceLatencyMs(latency);
        if (overridden != null) {
            run.setConfirmedAt(at.plusHours(1));
            run.setIsOverridden(overridden);
            run.setFinalCategories(List.of(overridden ? "Adventure & Nature" : "Coastal & Island"));
        }
        runs.save(run);
    }

    @Test void deniesAnonymousInvalidTokensAndNonAdministrators() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(get(URL).header("Authorization", "Bearer invalid")).andExpect(status().isUnauthorized());
        mvc.perform(get(URL).header("Authorization", "Bearer " + jwt.issue(OTHER, "other@example.com"))
                .param("adminOperatorId", ADMIN.toString()))
            .andExpect(status().isForbidden());
    }

    @Test void aggregatesAcrossBusinessesWithoutExposingInputsOrCountingUnconfirmedAsAccepted() throws Exception {
        seed(ADMIN, "v1", "ANALYZE", 0.9, 100, false, START);
        seed(OTHER, "v1", "ANALYZE", 0.8, 200, true, START.plusDays(1));
        seed(OTHER, "v2", "ANALYZE", 0.7, 300, null, START.plusDays(2));
        seed(OTHER, "v2", "UNIQUENESS", 0.6, 400, false, START.plusDays(3));
        // Outside the [from, to) window, including its exact upper boundary.
        seed(OTHER, "v1", "ANALYZE", 0.1, 999, true, START.minusSeconds(1));
        seed(OTHER, "v1", "ANALYZE", 0.1, 999, true, START.plusDays(4));
        var response = mvc.perform(get(URL).header("Authorization", "Bearer " + token)
                .param("from", START.toString()).param("to", START.plusDays(4).toString()))
            .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.scope").value("ALL_BUSINESSES"))
            .andExpect(jsonPath("$.summary.totalRuns").value(4))
            .andExpect(jsonPath("$.summary.analysisRuns").value(3))
            .andExpect(jsonPath("$.summary.confirmedAnalysisRuns").value(2))
            .andExpect(jsonPath("$.summary.unconfirmedAnalysisRuns").value(1))
            .andExpect(jsonPath("$.summary.overriddenRuns").value(1))
            .andExpect(jsonPath("$.summary.acceptedRuns").value(1))
            .andExpect(jsonPath("$.summary.overrideRate").value(0.5))
            .andExpect(jsonPath("$.summary.agreementRate").value(0.5))
            .andExpect(jsonPath("$.summary.averageLatencyMs").value(250.0))
            .andExpect(jsonPath("$.summary.minLatencyMs").value(100.0))
            .andExpect(jsonPath("$.summary.maxLatencyMs").value(400.0))
            .andExpect(jsonPath("$.breakdown.length()").value(3))
            .andExpect(jsonPath("$.topCategoryDistribution[0].totalRuns").value(3))
            .andReturn().getResponse().getContentAsString();
        var summary = mapper.readTree(response).get("summary");
        assertThat(summary.get("averageTopConfidence").asDouble()).isCloseTo(0.75, org.assertj.core.data.Offset.offset(1e-10));
        assertThat(summary.get("confirmationRate").asDouble()).isCloseTo(2.0 / 3, org.assertj.core.data.Offset.offset(1e-10));
        assertThat(response).doesNotContain("Private", ADMIN.toString(), OTHER.toString(), "operatorId", "inputDescription");
    }

    @Test void filtersByModelAndReturnsNullRatesWhenNoFeedbackExists() throws Exception {
        seed(OTHER, "v1", "ANALYZE", 0.9, 100, true, START);
        seed(OTHER, "v2", "ANALYZE", 0.6, 300, null, START);
        mvc.perform(get(URL).header("Authorization", "Bearer " + token)
                .param("from", START.toString()).param("to", START.plusDays(1).toString()).param("modelVersion", "v2"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.totalRuns").value(1))
            .andExpect(jsonPath("$.summary.averageLatencyMs").value(300.0))
            .andExpect(jsonPath("$.summary.confirmationRate").value(0.0))
            .andExpect(jsonPath("$.summary.overrideRate").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.summary.agreementRate").value(org.hamcrest.Matchers.nullValue()));
    }

    @Test void emptyDatabaseUsesNullMeasurementsAndDefaultsToThirtyDays() throws Exception {
        var body = mvc.perform(get(URL).header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary.totalRuns").value(0))
            .andExpect(jsonPath("$.summary.confirmationRate").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.summary.averageTopConfidence").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.summary.averageLatencyMs").value(org.hamcrest.Matchers.nullValue()))
            .andExpect(jsonPath("$.breakdown").isEmpty())
            .andReturn().getResponse().getContentAsString();
        var json = mapper.readTree(body);
        assertThat(java.time.Duration.between(OffsetDateTime.parse(json.get("from").asText()),
            OffsetDateTime.parse(json.get("to").asText())).toDays()).isEqualTo(30);
    }

    @Test void rejectsInvalidDateRangesAndBlankModelFilter() throws Exception {
        mvc.perform(get(URL).header("Authorization", "Bearer " + token)
            .param("from", START.plusDays(1).toString()).param("to", START.toString()))
            .andExpect(status().isBadRequest());
        mvc.perform(get(URL).header("Authorization", "Bearer " + token).param("from", "not-a-date"))
            .andExpect(status().isBadRequest());
        mvc.perform(get(URL).header("Authorization", "Bearer " + token).param("modelVersion", " "))
            .andExpect(status().isBadRequest());
    }
}
