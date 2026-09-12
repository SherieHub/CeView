package com.ceview.module4.adconnections;

import com.ceview.auth.JwtService;
import com.ceview.auth.MsmeOperator;
import com.ceview.auth.MsmeOperatorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The OAuth callback must be reachable without a JWT — it is a redirect from the
 * ad platform, not an XHR from our own frontend. Every OTHER ad-connection route
 * must stay locked down.
 *
 * <p>Guards two separate filters: SecurityConfig's authenticated-by-default rule
 * and ProfileCompletionFilter's 403 for operators without a contact number.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AdCallbackSecurityTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private MsmeOperatorRepository operatorRepository;

    @Test
    void callbackIsReachableWithoutAuthentication() throws Exception {
        // Not asserting the body: with no state row this resolves to an error
        // redirect. What matters is that it is NOT 401 — i.e. the filter chain
        // let it through to the controller.
        mvc.perform(get("/api/ad-connections/meta/callback")
                        .param("code", "irrelevant")
                        .param("state", "00000000-0000-0000-0000-000000000000"))
           .andExpect(status().is3xxRedirection());
    }

    @Test
    void listingConnectionsStillRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/ad-connections"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void listingAccountsStillRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/ad-connections/meta/accounts"))
           .andExpect(status().isUnauthorized());
    }

    @Test
    void callbackIsReachableEvenWithIncompleteProfile() throws Exception {
        // This is the case ProfileCompletionFilter's exemption exists for: an
        // authenticated operator whose profile is incomplete (blank contact
        // number) must still be let through to the callback — otherwise a
        // freshly-provisioned operator mid-OAuth-redirect gets a 403 with no
        // way to recover the grant they just approved.
        MsmeOperator op = new MsmeOperator();
        op.setEmail("incomplete-" + System.nanoTime() + "@example.com");
        op.setPasswordHash("hashed");
        op.setContactNumber(null);
        op = operatorRepository.save(op);

        String token = jwtService.issue(op.getOperatorId(), op.getEmail());

        mvc.perform(get("/api/ad-connections/meta/callback")
                        .header("Authorization", "Bearer " + token)
                        .param("code", "irrelevant")
                        .param("state", "00000000-0000-0000-0000-000000000000"))
           .andExpect(status().is3xxRedirection());
    }

    /**
     * Regression test for a bug this file's own addition exposed, not something the ad-
     * connections feature introduced: {@code ProfileCompletionFilter.isExempt} was being
     * checked against {@code HttpServletRequest.getServletPath()} alone, which is empty
     * under this app's actual servlet dispatch (the path lands in {@code getPathInfo()}
     * instead — see {@code ProfileCompletionFilter.requestPath}). That silently made EVERY
     * exemption evaluate to false, including the pre-existing {@code /api/auth/**} one —
     * meaning an authenticated operator with an incomplete profile could never reach
     * {@code PATCH /api/auth/profile}, the very endpoint that completes their profile and
     * lifts the block. No prior test caught this because the existing unit test
     * (ProfileCompletionFilterTest) hand-builds its MockHttpServletRequest and calls
     * setServletPath() directly, never exercising real dispatch.
     */
    @Test
    void completingAnIncompleteProfileRemainsReachable() throws Exception {
        MsmeOperator op = new MsmeOperator();
        op.setEmail("still-incomplete-" + System.nanoTime() + "@example.com");
        op.setPasswordHash("hashed");
        op.setContactNumber(null);
        op = operatorRepository.save(op);

        String token = jwtService.issue(op.getOperatorId(), op.getEmail());

        mvc.perform(patch("/api/auth/profile")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contactNumber\":\"09171234567\"}"))
           .andExpect(status().isOk());
    }
}
