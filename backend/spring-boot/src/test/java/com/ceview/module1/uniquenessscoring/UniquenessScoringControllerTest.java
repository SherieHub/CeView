package com.ceview.module1.uniquenessscoring;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Task 11 (03-spring-calibration.md): every field the FastAPI uniqueness call
 * returns must survive the trip through Spring intact, and a response that is
 * <em>missing</em> a field the frontend renders as fact must fail loudly with the
 * dependency-unavailable contract rather than silently defaulting to zero.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class UniquenessScoringControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private AIInferenceGatewayService ai;

    private String token;

    private static final String REQUEST_BODY = """
        {
          "businessProfileId": null,
          "businessName": "Sumilon Sandbar Day Charters",
          "categories": ["Coastal & Island"],
          "coreServices": ["Sandbar day charters"],
          "description": "Day-boat charters timed around the tide tables.",
          "uvp": "The only Oslob charter that publishes its sandbar timings a week ahead."
        }
        """;

    @BeforeEach
    void setUp() {
        token = jwtService.issue(UUID.randomUUID(), "operator@example.com");
    }

    /** A complete FastAPI uniqueness result — every key the frozen contract lists. */
    private static Map<String, Object> fullResult() {
        var r = new HashMap<String, Object>();
        r.put("overallScore", 68);
        r.put("semanticsScore", 37);
        r.put("categoryScore", 100);
        r.put("semanticPercentile", 68);
        r.put("cohortSize", 34);
        r.put("cohortMedianScore", 41);
        r.put("cohortCategories", List.of("Adventure & Nature"));
        r.put("categoryDensity", "dense");
        r.put("sufficientCohort", true);
        r.put("descriptionFeedback", "");
        r.put("categoryFeedback", "");
        return r;
    }

    private org.springframework.test.web.servlet.ResultActions callWith(Map<String, Object> gatewayResult)
            throws Exception {
        when(ai.computeUniqueness(anyMap())).thenReturn(gatewayResult);
        return mvc.perform(post("/api/classification/uniqueness")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(REQUEST_BODY));
    }

    @Test
    void everyFieldFromTheGatewaySurvivesToTheResponse() throws Exception {
        callWith(fullResult())
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.overallScore").value(68))
            .andExpect(jsonPath("$.semanticsScore").value(37))
            .andExpect(jsonPath("$.categoryScore").value(100))
            .andExpect(jsonPath("$.semanticPercentile").value(68))
            .andExpect(jsonPath("$.cohortSize").value(34))
            .andExpect(jsonPath("$.cohortMedianScore").value(41))
            .andExpect(jsonPath("$.cohortCategories[0]").value("Adventure & Nature"))
            .andExpect(jsonPath("$.categoryDensity").value("dense"))
            .andExpect(jsonPath("$.sufficientCohort").value(true));
    }

    @Test
    void aResponseMissingCohortSizeFailsLoudlyInsteadOfDefaultingToZero() throws Exception {
        var missingCohortSize = fullResult();
        missingCohortSize.remove("cohortSize");

        callWith(missingCohortSize)
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.cohortSize").doesNotExist())
            .andExpect(jsonPath("$.dependency").value("fastapi"))
            .andExpect(jsonPath("$.cause", org.hamcrest.Matchers.containsString("cohortSize")))
            .andExpect(jsonPath("$.stage", org.hamcrest.Matchers.containsString("spring/classification/uniqueness")));
    }

    @Test
    void aMissingStringFieldAlsoFailsLoudly() throws Exception {
        var missingDensity = fullResult();
        missingDensity.remove("categoryDensity");

        callWith(missingDensity)
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.cause", org.hamcrest.Matchers.containsString("categoryDensity")));
    }

    @Test
    void aNullValuedFieldIsTreatedAsMissing() throws Exception {
        var nullPercentile = fullResult();
        nullPercentile.put("semanticPercentile", null);

        callWith(nullPercentile)
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.cause", org.hamcrest.Matchers.containsString("semanticPercentile")));
    }

    @Test
    void theSelectedCategoriesAreForwardedToTheGateway() throws Exception {
        // Task 12 Step 3: Dev B's category-filtered cohort is inert unless the
        // selected categories actually reach FastAPI.
        callWith(fullResult()).andExpect(status().isOk());

        @SuppressWarnings("unchecked")
        var payload = ArgumentCaptor.forClass(Map.class);
        verify(ai).computeUniqueness(payload.capture());

        assertThat(payload.getValue().get("categories")).isEqualTo(List.of("Coastal & Island"));
    }

    @Test
    void sufficientCohortFalseIsAValidResponseNotAnError() throws Exception {
        var smallCohort = fullResult();
        smallCohort.put("sufficientCohort", false);
        smallCohort.put("cohortSize", 2);

        callWith(smallCohort)
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sufficientCohort").value(false))
            .andExpect(jsonPath("$.cohortSize").value(2));
    }
}
