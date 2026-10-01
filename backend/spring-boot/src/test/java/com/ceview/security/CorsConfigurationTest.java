package com.ceview.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Proves CORS preflight requests to /api/** are actually honored by Spring
 * Security's filter chain (not just Spring MVC's CorsRegistry), for every
 * origin configured in ceview.cors.allowed-origins, and rejected for any
 * origin outside that list.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CorsConfigurationTest {

    @Autowired
    private MockMvc mvc;

    @Test
    void preflightFromAllowedOrigin3001Succeeds() throws Exception {
        mvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "http://localhost:3001")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3001"));
    }

    @Test
    void preflightFromAllowedOrigin3002Succeeds() throws Exception {
        mvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "http://localhost:3002")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
            .andExpect(status().isOk())
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:3002"));
    }

    @Test
    void preflightFromDisallowedOriginIsRejected() throws Exception {
        mvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "http://evil.example.com")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
            .andExpect(status().isForbidden())
            .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
    }
}
