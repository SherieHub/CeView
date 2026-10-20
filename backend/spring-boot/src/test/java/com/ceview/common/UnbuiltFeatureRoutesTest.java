package com.ceview.common;

import com.ceview.auth.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The frontend treats a 404 from these routes as "this feature has no backend yet" and
 * shows an honest unavailable state (services/apiError.ts isNotAvailable). That only works
 * while they genuinely answer 404 to an authenticated caller — not 401, 403 or 500.
 * If one of these features is built, delete its line here and let the screen use it.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class UnbuiltFeatureRoutesTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    private String token() {
        UUID operator = UUID.randomUUID();
        testOperators.create(operator);
        return "Bearer " + jwtService.issue(operator, "op@example.com");
    }

    @Test
    void workspaceMembersHasNoBackendYet() throws Exception {
        mvc.perform(get("/api/workspace/members").header("Authorization", token())).andExpect(status().isNotFound());
    }

    @Test
    void platformConnectionsHaveNoBackendYet() throws Exception {
        mvc.perform(get("/api/connections").header("Authorization", token())).andExpect(status().isNotFound());
    }

}
