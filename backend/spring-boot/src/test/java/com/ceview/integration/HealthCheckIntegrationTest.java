package com.ceview.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Example integration test — boots the real Spring context (full autowiring,
 * security filter chain, JPA/H2 schema from src/test/resources/application.properties)
 * and exercises an actual HTTP endpoint through MockMvc.
 *
 * Pattern to copy: MOCK web environment avoids binding a real port while still
 * routing requests through the full filter chain, matching ChartDataVisualTest's
 * approach in module2/submodule22.
 *
 * Run with: mvnw test -Dtest=HealthCheckIntegrationTest
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class HealthCheckIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void actuatorHealth_isPubliclyReachable_andReportsUp() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"UP\"}"));
    }
}
