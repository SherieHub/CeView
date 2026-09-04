package com.ceview.module3;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.dto.ContentDtos.CaptionsDto;
import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.ceview.module3.dto.ContentDtos.ContentSource;
import com.ceview.module3.dto.ContentDtos.MarketHeaderDto;
import com.ceview.module3.submodule31.ContentApprovalService;
import com.ceview.module3.submodule31.ContentGenerationService;
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
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Verifies ContentController scopes POST /generate and POST /approve to the
 * authenticated operator's own business profile (via
 * {@link com.ceview.auth.CurrentBusinessProfile}) instead of trusting a
 * client-supplied profileId — see Task 8 (mirrors Task 7 for Module 2).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class ContentControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private ObjectMapper objectMapper;

    // Content generation/approval hit the AI gateway + persistence; mocked out
    // here so these tests exercise only the ownership-resolution layer.
    @MockBean private ContentGenerationService generationService;
    @MockBean private ContentApprovalService approvalService;

    private UUID operatorA;
    private String tokenA;
    private UUID profileA;
    private UUID profileB;

    @BeforeEach
    void setUp() {
        profileRepo.deleteAll();
        operatorA = UUID.randomUUID();
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

        ContentResponseDto dummy = new ContentResponseDto(
                new MarketHeaderDto("South Korea", "Seoul", "kr"),
                "framework",
                new CaptionsDto(null, null, null),
                ContentSource.GROQ);
        when(generationService.generate(any(), anyString(), any(), any(), any(), any()))
                .thenReturn(dummy);
        when(approvalService.approveForMarket(any(), anyString()))
                .thenReturn(List.of(UUID.randomUUID()));
    }

    private String generateBody() throws Exception {
        return objectMapper.writeValueAsString(Map.of(
                "market", "korea",
                "businessName", "Test Biz",
                "description", "desc",
                "categories", List.of("food"),
                "trend", "trend"
        ));
    }

    @Test
    void generateOmittingProfileIdDerivesTheCallersOwnProfile() throws Exception {
        mvc.perform(post("/api/content/generate")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(generateBody()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.source").value("groq"));
    }

    @Test
    void generateWithOwnProfileIdWorksNormally() throws Exception {
        mvc.perform(post("/api/content/generate")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileA.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(generateBody()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.source").value("groq"));
    }

    @Test
    void generateWithAnotherOperatorsProfileIdIsRejected() throws Exception {
        mvc.perform(post("/api/content/generate")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileB.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(generateBody()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void generateForOperatorWithNoBusinessProfileGets409() throws Exception {
        UUID operatorWithoutProfile = UUID.randomUUID();
        String tokenWithoutProfile = jwtService.issue(operatorWithoutProfile, "no-profile@example.com");

        mvc.perform(post("/api/content/generate")
                .header("Authorization", "Bearer " + tokenWithoutProfile)
                .contentType(MediaType.APPLICATION_JSON)
                .content(generateBody()))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409))
            .andExpect(jsonPath("$.error").value("request_failed"))
            .andExpect(jsonPath("$.message").value(
                    "operator " + operatorWithoutProfile + " has no business profile yet"));
    }

    @Test
    void approveWithOwnProfileIdWorksNormally() throws Exception {
        mvc.perform(post("/api/content/approve")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileA.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("market", "korea"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.market").value("korea"));
    }

    @Test
    void approveWithAnotherOperatorsProfileIdIsRejected() throws Exception {
        mvc.perform(post("/api/content/approve")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileB.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("market", "korea"))))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void approveForOperatorWithNoBusinessProfileGets409() throws Exception {
        UUID operatorWithoutProfile = UUID.randomUUID();
        String tokenWithoutProfile = jwtService.issue(operatorWithoutProfile, "no-profile2@example.com");

        mvc.perform(post("/api/content/approve")
                .header("Authorization", "Bearer " + tokenWithoutProfile)
                .param("profileId", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("market", "korea"))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409))
            .andExpect(jsonPath("$.error").value("request_failed"))
            .andExpect(jsonPath("$.message").value(
                    "operator " + operatorWithoutProfile + " has no business profile yet"));
    }

    @Test
    void generateWithoutAuthenticationIsRejected() throws Exception {
        mvc.perform(post("/api/content/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(generateBody()))
            .andExpect(status().isUnauthorized());
    }
}
