package com.ceview.module2;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
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
 * Verifies NotificationController scopes GET /api/notifications to the
 * authenticated operator's own business profile instead of trusting a
 * client-supplied profileId — see Task 7.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class NotificationControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;

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
    }

    @Test
    void omittingProfileIdDerivesTheCallersOwnProfile() throws Exception {
        mvc.perform(get("/api/notifications").header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.notifications").isArray());
    }

    @Test
    void suppliedOwnProfileIdWorksNormally() throws Exception {
        mvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileA.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.notifications").isArray());
    }

    @Test
    void suppliedAnotherOperatorsProfileIdIsRejected() throws Exception {
        mvc.perform(get("/api/notifications")
                .header("Authorization", "Bearer " + tokenA)
                .param("profileId", profileB.toString()))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.error").value("forbidden"));
    }

    @Test
    void withoutAuthenticationIsRejected() throws Exception {
        mvc.perform(get("/api/notifications"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void operatorWithNoBusinessProfileGets409() throws Exception {
        UUID operatorWithoutProfile = UUID.randomUUID();
        String tokenWithoutProfile = jwtService.issue(operatorWithoutProfile, "no-profile@example.com");

        mvc.perform(get("/api/notifications").header("Authorization", "Bearer " + tokenWithoutProfile))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.status").value(409))
            .andExpect(jsonPath("$.error").value("request_failed"))
            .andExpect(jsonPath("$.message").value(
                    "operator " + operatorWithoutProfile + " has no business profile yet"));
    }
}
