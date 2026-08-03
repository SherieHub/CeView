package com.ceview.security;

import com.ceview.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityLockdownVerificationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JwtService jwtService;

    @Test
    void actuatorHealthIsPublic() throws Exception {
        mvc.perform(get("/actuator/health"))
            .andExpect(status().isOk());
    }

    @Test
    void loginWithBadCredsIsPublicNot401FromSecurity() throws Exception {
        // Hits the /api/v1/auth/** permitAll route; controller itself returns 401
        // for bad creds, but the request must reach the controller (not be blocked
        // by the security filter chain) and must NOT get our JSON entry-point body,
        // since AuthController already returns Map.of("error","invalid credentials").
        mvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"nobody@example.com\",\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.error").value("invalid credentials"));
    }

    @Test
    void protectedModuleEndpointWithoutTokenReturns401WithJsonBody() throws Exception {
        mvc.perform(get("/api/v1/business-profile"))
            .andExpect(status().isUnauthorized())
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.error").value("authentication required"));
    }

    @Test
    void protectedModuleEndpointWithValidTokenIsNotRejected() throws Exception {
        String token = jwtService.issue(UUID.randomUUID(), "someone@example.com");
        mvc.perform(get("/api/v1/business-profile").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk());
    }
}
