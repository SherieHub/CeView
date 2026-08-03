package com.ceview.module1.businessinput;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.dto.BusinessProfileDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies BusinessProfileController resolves the operator server-side from the JWT
 * (via {@link com.ceview.auth.CurrentOperator}) rather than trusting a client-supplied
 * operatorId, and that ownership of an existing profile is enforced on save.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class BusinessProfileControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private ObjectMapper objectMapper;

    // Stub out the AI gateway so save() doesn't attempt a real HTTP call to FastAPI.
    @MockBean private AIInferenceGatewayService ai;

    private UUID operatorA;
    private UUID operatorB;
    private String tokenA;
    private String tokenB;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        operatorA = UUID.randomUUID();
        operatorB = UUID.randomUUID();
        tokenA = jwtService.issue(operatorA, "a@example.com");
        tokenB = jwtService.issue(operatorB, "b@example.com");
    }

    @Test
    void getReturnsOnlyTheAuthenticatedOperatorsOwnProfile() throws Exception {
        BusinessProfile profileA = new BusinessProfile();
        profileA.setUserId(operatorA);
        profileA.setBusinessName("Operator A's Business");
        profileRepo.save(profileA);

        BusinessProfile profileB = new BusinessProfile();
        profileB.setUserId(operatorB);
        profileB.setBusinessName("Operator B's Business");
        profileRepo.save(profileB);

        mvc.perform(get("/api/v1/business-profile").header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("Operator A's Business"));

        mvc.perform(get("/api/v1/business-profile").header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("Operator B's Business"));
    }

    @Test
    void putCreatesProfileOwnedByTheAuthenticatedOperatorNotAClientSuppliedId() throws Exception {
        var dto = new BusinessProfileDto(null, "New Business", List.of("Retail"),
            List.of("Service A"), "desc", "uvp", null, null);

        mvc.perform(put("/api/v1/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("New Business"));

        Optional<BusinessProfile> saved = profileRepo.findFirstByUserId(operatorA);
        assertTrue(saved.isPresent(), "profile should have been created for the authenticated operator");
        assertEquals(operatorA, saved.get().getUserId());
    }

    @Test
    void putUpdatesTheAuthenticatedOperatorsOwnExistingProfile() throws Exception {
        BusinessProfile existing = new BusinessProfile();
        existing.setUserId(operatorA);
        existing.setBusinessName("Old Name");
        profileRepo.save(existing);

        var dto = new BusinessProfileDto(existing.getBusinessProfileId(), "Updated Name", List.of(),
            List.of(), "desc", "uvp", null, null);

        mvc.perform(put("/api/v1/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.businessName").value("Updated Name"));

        BusinessProfile reloaded = profileRepo.findById(existing.getBusinessProfileId()).orElseThrow();
        assertEquals("Updated Name", reloaded.getBusinessName());
        assertEquals(operatorA, reloaded.getUserId());
    }

    @Test
    void putWithAnotherOperatorsBusinessProfileIdIsRejectedNotReassigned() throws Exception {
        BusinessProfile ownedByB = new BusinessProfile();
        ownedByB.setUserId(operatorB);
        ownedByB.setBusinessName("Operator B's Business");
        profileRepo.save(ownedByB);

        var dto = new BusinessProfileDto(ownedByB.getBusinessProfileId(), "Hijacked Name", List.of(),
            List.of(), "desc", "uvp", null, null);

        // Operator A attempts to overwrite operator B's profile by id.
        mvc.perform(put("/api/v1/business-profile")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(dto)))
            .andExpect(status().isForbidden());

        BusinessProfile stillB = profileRepo.findById(ownedByB.getBusinessProfileId()).orElseThrow();
        assertEquals("Operator B's Business", stillB.getBusinessName(), "profile must not be mutated");
        assertEquals(operatorB, stillB.getUserId(), "ownership must not be reassigned");
    }

    @Test
    void getWithoutTokenIsUnauthorized() throws Exception {
        mvc.perform(get("/api/v1/business-profile"))
            .andExpect(status().isUnauthorized());
    }
}
