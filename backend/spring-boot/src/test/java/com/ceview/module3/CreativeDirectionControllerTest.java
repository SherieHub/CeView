package com.ceview.module3;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.dto.CreativeDirectionDtos.CreativeDirectionDto;
import com.ceview.module3.submodule32.CreativeApprovalService;
import com.ceview.module3.submodule32.CreativeDirectionService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies CreativeDirectionController scopes POST /generate/{profileId} and
 * POST /approve/{profileId} to the authenticated operator's own business profile
 * (via {@link com.ceview.auth.CurrentBusinessProfile}) instead of trusting the
 * client-supplied path variable outright — see Task 8 (mirrors Task 7 for Module 2).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class CreativeDirectionControllerTest {

    @Autowired private org.springframework.test.web.servlet.MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;

    // Direction generation/approval hit the AI gateway + persistence; mocked out
    // here so these tests exercise only the ownership-resolution layer.
    @MockBean private CreativeDirectionService directionService;
    @MockBean private CreativeApprovalService approvalService;

    private String tokenA;
    private UUID profileA;
    private UUID profileB;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        UUID operatorA = UUID.randomUUID();
        UUID operatorB = UUID.randomUUID();
        tokenA = jwtService.issue(operatorA, "a@example.com");

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

        CreativeDirectionDto dummy = new CreativeDirectionDto(List.of(), List.of(), null);
        when(directionService.generate(any(), anyString())).thenReturn(dummy);
        when(approvalService.approveLatest(any(), anyString()))
                .thenReturn(Optional.of(UUID.randomUUID()));
    }

    @Test
    void generateWithOwnProfileIdWorksNormally() throws Exception {
        mvc.perform(post("/api/v1/creative-direction/generate/" + profileA)
                .header("Authorization", "Bearer " + tokenA)
                .param("market", "korea"))
            .andExpect(status().isOk());
    }

    @Test
    void generateWithAnotherOperatorsProfileIdIsRejected() throws Exception {
        mvc.perform(post("/api/v1/creative-direction/generate/" + profileB)
                .header("Authorization", "Bearer " + tokenA)
                .param("market", "korea"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void generateForOperatorWithNoBusinessProfileGets409() throws Exception {
        UUID operatorWithoutProfile = UUID.randomUUID();
        String tokenWithoutProfile = jwtService.issue(operatorWithoutProfile, "no-profile@example.com");

        // profileId in the path must be a real UUID; since the caller has no
        // profile at all, resolution fails with 409 before the mismatch check.
        mvc.perform(post("/api/v1/creative-direction/generate/" + UUID.randomUUID())
                .header("Authorization", "Bearer " + tokenWithoutProfile)
                .param("market", "korea"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409))
            .andExpect(jsonPath("$.error").value("request_failed"))
            .andExpect(jsonPath("$.message").value(
                    "operator " + operatorWithoutProfile + " has no business profile yet"));
    }

    @Test
    void approveWithOwnProfileIdWorksNormally() throws Exception {
        mvc.perform(post("/api/v1/creative-direction/approve/" + profileA)
                .header("Authorization", "Bearer " + tokenA)
                .param("market", "korea"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.market").value("korea"));
    }

    @Test
    void approveWithAnotherOperatorsProfileIdIsRejected() throws Exception {
        mvc.perform(post("/api/v1/creative-direction/approve/" + profileB)
                .header("Authorization", "Bearer " + tokenA)
                .param("market", "korea"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void approveForOperatorWithNoBusinessProfileGets409() throws Exception {
        UUID operatorWithoutProfile = UUID.randomUUID();
        String tokenWithoutProfile = jwtService.issue(operatorWithoutProfile, "no-profile2@example.com");

        mvc.perform(post("/api/v1/creative-direction/approve/" + UUID.randomUUID())
                .header("Authorization", "Bearer " + tokenWithoutProfile)
                .param("market", "korea"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409))
            .andExpect(jsonPath("$.error").value("request_failed"))
            .andExpect(jsonPath("$.message").value(
                    "operator " + operatorWithoutProfile + " has no business profile yet"));
    }

    @Test
    void generateWithoutAuthenticationIsRejected() throws Exception {
        mvc.perform(post("/api/v1/creative-direction/generate/" + UUID.randomUUID())
                .param("market", "korea"))
            .andExpect(status().isUnauthorized());
    }
}
