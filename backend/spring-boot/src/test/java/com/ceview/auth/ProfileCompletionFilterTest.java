package com.ceview.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers {@link ProfileCompletionFilter} — the server-side enforcement that an operator
 * with an incomplete profile (contactNumber missing, e.g. a freshly-provisioned Google
 * sign-in) can't reach the rest of the API by hitting it directly, bypassing the frontend's
 * own redirect-to-/complete-profile gate.
 */
class ProfileCompletionFilterTest {

    private final MsmeOperatorRepository repo = mock(MsmeOperatorRepository.class);
    private final ProfileCompletionFilter filter =
        new ProfileCompletionFilter(repo, new ObjectMapper());

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void blocksAuthenticatedRequestWithIncompleteProfile() throws Exception {
        UUID operatorId = UUID.randomUUID();
        authenticateAs(operatorId);
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(operatorId);
        op.setContactNumber(null);
        when(repo.findById(operatorId)).thenReturn(Optional.of(op));

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/business-profile");
        req.setServletPath("/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertEquals(403, res.getStatus());
        assertTrue(res.getContentAsString().contains("PROFILE_INCOMPLETE"));
        verify(chain, times(0)).doFilter(req, res);
    }

    @Test
    void allowsAuthenticatedRequestWithCompleteProfile() throws Exception {
        UUID operatorId = UUID.randomUUID();
        authenticateAs(operatorId);
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(operatorId);
        op.setContactNumber("0917");
        when(repo.findById(operatorId)).thenReturn(Optional.of(op));

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/business-profile");
        req.setServletPath("/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
    }

    @Test
    void exemptsAuthPathsEvenWithIncompleteProfile() throws Exception {
        UUID operatorId = UUID.randomUUID();
        authenticateAs(operatorId);

        MockHttpServletRequest req = new MockHttpServletRequest("PATCH", "/api/auth/profile");
        req.setServletPath("/api/auth/profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
    }

    @Test
    void passesThroughUnauthenticatedRequestsToDownstreamEntryPoint() throws Exception {
        SecurityContextHolder.clearContext();

        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/business-profile");
        req.setServletPath("/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
    }

    private void authenticateAs(UUID operatorId) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));
    }
}
