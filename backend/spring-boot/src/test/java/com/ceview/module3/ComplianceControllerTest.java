package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The OMCS profile-match score is computed from the authenticated operator's own saved
 * profile. The controller must build that profile from the database — never trust one
 * supplied in the request body.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class ComplianceControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    @MockBean private AIInferenceGatewayService ai;

    private String token;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        UUID operator = UUID.randomUUID();
        testOperators.create(operator);
        token = jwtService.issue(operator, "op@example.com");

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operator);
        profile.setBusinessName("Blue Reef Divers");
        profile.setBusinessDescription("Dive shop on the Moalboal coast.");
        profile.setUvp("Certified freediving instruction");
        profile.setCoreServicesList(List.of("Freediving courses", "Sardine run snorkeling"));
        profile.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(profile);

        when(ai.analyzeOmcsAgent(anyMap())).thenReturn(Map.of(
                "profile_semantic_score", 62.5,
                "recommendations_picture_score", 70.0,
                "pubmat_consistency_score", 80.0,
                "omcs_score", 69.3,
                "status", "Fail"));
    }

    private static final String BODY = """
            {"caption": "Dive the reef wall", "imageUrl": "https://example.invalid/x.jpg"%s}""";

    @Test
    @SuppressWarnings("unchecked")
    void businessProfileSentToTheAgentComesFromTheOperatorsSavedProfile() throws Exception {
        mvc.perform(post("/api/compliance/omcs-analyze")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY.formatted("")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.profileSemanticScore").value(62.5));

        ArgumentCaptor<Map<String, Object>> sent = ArgumentCaptor.forClass(Map.class);
        verify(ai).analyzeOmcsAgent(sent.capture());
        Map<String, Object> profile = (Map<String, Object>) sent.getValue().get("business_profile");
        assertThat(profile)
                .containsEntry("business_name", "Blue Reef Divers")
                .containsEntry("business_description", "Dive shop on the Moalboal coast.")
                .containsEntry("uvp", "Certified freediving instruction")
                .containsEntry("core_services", List.of("Freediving courses", "Sardine run snorkeling"))
                .containsEntry("categories", List.of("Coastal & Island"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void aBusinessProfileSuppliedInTheRequestBodyIsIgnored() throws Exception {
        String forged = """
                , "businessProfile": {"business_name": "Someone Else", "uvp": "forged", "core_services": ["x"]}""";
        mvc.perform(post("/api/compliance/omcs-analyze")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY.formatted(forged)))
            .andExpect(status().isOk());

        ArgumentCaptor<Map<String, Object>> sent = ArgumentCaptor.forClass(Map.class);
        verify(ai).analyzeOmcsAgent(sent.capture());
        Map<String, Object> profile = (Map<String, Object>) sent.getValue().get("business_profile");
        assertThat(profile).containsEntry("business_name", "Blue Reef Divers");
        assertThat(profile).containsEntry("uvp", "Certified freediving instruction");
    }

    @Test
    void anOperatorWithNoBusinessProfileGetsConflictAndNoAgentCall() throws Exception {
        profileRepo.deleteAll();

        mvc.perform(post("/api/compliance/omcs-analyze")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY.formatted("")))
            .andExpect(status().isConflict());

        verify(ai, never()).analyzeOmcsAgent(anyMap());
    }

    @Test
    void unauthenticatedRequestsAreRejected() throws Exception {
        mvc.perform(post("/api/compliance/omcs-analyze")
                .contentType(MediaType.APPLICATION_JSON)
                .content(BODY.formatted("")))
            .andExpect(status().isUnauthorized());
    }
}
