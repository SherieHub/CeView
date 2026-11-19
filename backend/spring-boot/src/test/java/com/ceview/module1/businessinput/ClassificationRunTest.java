package com.ceview.module1.businessinput;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.testsupport.TestOperators;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import java.util.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ClassificationRunTest {
    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired TestOperators operators;
    @Autowired ObjectMapper mapper;
    @Autowired ClassificationRunRepository runs;
    @Autowired BusinessProfileRepository profiles;
    @MockBean AIInferenceGatewayService ai;
    UUID owner;
    String token;
    static final String COAST = "Coastal & Island";
    static final String ADVENTURE = "Adventure & Nature";

    @BeforeEach void setup() {
        runs.deleteAll();
        profiles.deleteAll();
        owner = UUID.randomUUID();
        operators.create(owner);
        token = jwt.issue(owner, "run@example.com");
        when(ai.classifyCategories(anyMap())).thenReturn(prediction());
    }

    static Map<String, Object> prediction() {
        var scores = Map.of(COAST, 0.9999988079071045, ADVENTURE, 0.19,
            "Cultural & Heritage", 0.005, "Theme Parks / Entertainment", 0.0006,
            "Urban & City", 0.00005, "Culinary & Gastronomy", 0.00001,
            "Accommodation & Staycation", 0.0003, "OUT_OF_SCOPE", 0.00004);
        return Map.of("categories", List.of(Map.of("name", COAST, "percentage", 100)),
            "inference", Map.of("topCategory", COAST, "topConfidence", scores.get(COAST),
                "predictedCategories", Map.of(COAST, scores.get(COAST)), "categoryScores", scores,
                "modelVersion", "test:v1", "inferenceLatencyMs", 125.75));
    }

    Map<String, Object> input() {
        return new HashMap<>(Map.of("businessName", "Dive shop", "description", " Exact description. ",
            "uvp", "Exact UVP", "coreServices", List.of("Diving, guided", "Snorkeling")));
    }

    UUID analyze() throws Exception {
        var response = mvc.perform(post("/api/classification/analyze")
            .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
            .content(mapper.writeValueAsString(input()))).andExpect(status().isOk()).andReturn();
        return UUID.fromString(mapper.readTree(response.getResponse().getContentAsString()).get("runId").asText());
    }

    Map<String, Object> confirmation(UUID id, List<String> categories) {
        var body = input();
        body.put("classificationRunId", id);
        body.put("categories", categories);
        return body;
    }

    void save(String bearer, Map<String, Object> body, int expectedStatus) throws Exception {
        mvc.perform(put("/api/business-profile").header("Authorization", "Bearer " + bearer)
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)))
            .andExpect(status().is(expectedStatus));
    }

    @Test void retainsEveryRunAndRawInputsUntilConfirmation() throws Exception {
        UUID first = analyze();
        UUID second = analyze();
        assertThat(first).isNotEqualTo(second);
        var run = runs.findById(first).orElseThrow();
        assertThat(run.getOperatorId()).isEqualTo(owner);
        assertThat(run.getInputDescription()).isEqualTo(" Exact description. ");
        assertThat(run.getInputServices()).containsExactly("Diving, guided", "Snorkeling");
        assertThat(run.getCategoryScores()).hasSize(8);
        assertThat(run.getTopConfidence()).isEqualTo(0.9999988079071045);
        assertThat(run.getModelVersion()).isEqualTo("test:v1");
        assertThat(run.getInferenceLatencyMs()).isEqualTo(125.75);
        assertThat(run.getFinalCategories()).isNull();
        assertThat(run.getIsOverridden()).isNull();
        save(token, confirmation(second, List.of(COAST)), 200);
        var confirmed = runs.findById(second).orElseThrow();
        assertThat(confirmed.getIsOverridden()).isFalse();
        assertThat(confirmed.getBusinessProfileId()).isEqualTo(profiles.findFirstByUserId(owner).orElseThrow().getBusinessProfileId());
        assertThat(runs.findById(first).orElseThrow().getConfirmedAt()).isNull();
        save(token, confirmation(second, List.of(COAST)), 200);
        assertThat(runs.findById(second).orElseThrow().getConfirmedAt()).isEqualTo(confirmed.getConfirmedAt());
    }

    @Test void recordsOverrideAndRejectsRewritingConfirmedFeedback() throws Exception {
        UUID id = analyze();
        save(token, confirmation(id, List.of(ADVENTURE)), 200);
        assertThat(runs.findById(id).orElseThrow().getIsOverridden()).isTrue();
        save(token, confirmation(id, List.of(COAST)), 409);
        assertThat(profiles.findFirstByUserId(owner).orElseThrow().categoriesList()).containsExactly(ADVENTURE);
    }

    @Test void rejectsOtherTenantAndChangedInputWithoutSavingProfile() throws Exception {
        UUID id = analyze();
        UUID other = UUID.randomUUID();
        operators.create(other);
        save(jwt.issue(other, "other@example.com"), confirmation(id, List.of(COAST)), 404);
        assertThat(profiles.findFirstByUserId(other)).isEmpty();
        var changed = confirmation(id, List.of(COAST));
        changed.put("description", "Edited description");
        save(token, changed, 409);
        assertThat(profiles.findFirstByUserId(owner)).isEmpty();
        assertThat(runs.findById(id).orElseThrow().getConfirmedAt()).isNull();
    }

    @Test void rejectsMissingMetadataWithoutInventingScores() throws Exception {
        when(ai.classifyCategories(anyMap())).thenReturn(Map.of("categories", List.of()));
        mvc.perform(post("/api/classification/analyze").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input())))
            .andExpect(status().isBadGateway());
        assertThat(runs.count()).isZero();
    }

    @Test void logsTheSeparateClassifierCallUsedForUniqueness() throws Exception {
        var result = new HashMap<String, Object>();
        result.put("overallScore", 60);
        result.put("semanticsScore", 30);
        result.put("categoryScore", 100);
        result.put("semanticPercentile", 60);
        result.put("cohortSize", 5);
        result.put("cohortMedianScore", 40);
        result.put("cohortCategories", List.of(COAST));
        result.put("categoryDensity", "sparse");
        result.put("sufficientCohort", true);
        result.put("classification", prediction());
        when(ai.computeUniqueness(anyMap())).thenReturn(result);
        var request = input();
        request.put("categories", List.of(COAST));
        mvc.perform(post("/api/classification/uniqueness").header("Authorization", "Bearer " + token)
            .contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(request)))
            .andExpect(status().isOk());
        var stored = runs.findAll();
        assertThat(stored).hasSize(1);
        assertThat(stored.get(0).getRunPurpose()).isEqualTo("UNIQUENESS");
        assertThat(stored.get(0).getIsOverridden()).isNull();
        assertThat(stored.get(0).getOperatorId()).isEqualTo(owner);
    }
}
