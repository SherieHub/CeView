package com.ceview.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link EmailVerificationFilter}: an authenticated operator who has not verified their email
 * cannot reach the rest of the API by calling it directly, bypassing the frontend's redirect.
 */
class EmailVerificationFilterTest {

    private final MsmeOperatorRepository repo = mock(MsmeOperatorRepository.class);
    private final EmailVerificationFilter filter = new EmailVerificationFilter(repo, new ObjectMapper());

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private UUID signedInOperator(boolean verified) {
        UUID operatorId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));
        MsmeOperator op = new MsmeOperator();
        op.setOperatorId(operatorId);
        op.setEmailVerifiedAt(verified ? OffsetDateTime.now() : null);
        when(repo.findById(operatorId)).thenReturn(Optional.of(op));
        return operatorId;
    }

    private static MockHttpServletRequest request(String method, String path) {
        MockHttpServletRequest req = new MockHttpServletRequest(method, path);
        req.setServletPath(path);
        return req;
    }

    @Test
    void blocksAnUnverifiedOperatorWithEmailNotVerified() throws Exception {
        signedInOperator(false);
        MockHttpServletRequest req = request("GET", "/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        assertEquals(403, res.getStatus());
        assertTrue(res.getContentAsString().contains("EMAIL_NOT_VERIFIED"));
        verify(chain, never()).doFilter(req, res);
    }

    @Test
    void letsAVerifiedOperatorThrough() throws Exception {
        signedInOperator(true);
        MockHttpServletRequest req = request("GET", "/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
    }

    @Test
    void reachesThePathWhenOnlyPathInfoIsSet() throws Exception {
        // Under the app's real servlet mapping the whole path lands in pathInfo and servletPath
        // is empty (see ProfileCompletionFilter#requestPath); the gate must still apply.
        signedInOperator(false);
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/business-profile");
        req.setServletPath("");
        req.setPathInfo("/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();

        filter.doFilter(req, res, mock(FilterChain.class));

        assertEquals(403, res.getStatus());
    }

    @Test
    void exemptsAuthPathsSoAnUnverifiedOperatorCanVerify() throws Exception {
        signedInOperator(false);
        for (String path : List.of("/api/auth/email-verification/verify", "/api/auth/email", "/actuator/health")) {
            MockHttpServletRequest req = request("POST", path);
            MockHttpServletResponse res = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);

            filter.doFilter(req, res, chain);

            verify(chain).doFilter(req, res);
        }
    }

    @Test
    void exemptsPublicAttributionAndTheTestSupportHook() throws Exception {
        signedInOperator(false);
        for (String path : List.of("/r/abc", "/api/public/attribution/enquiries", "/api/test-support/email-codes/latest")) {
            MockHttpServletRequest req = request("GET", path);
            MockHttpServletResponse res = new MockHttpServletResponse();
            FilterChain chain = mock(FilterChain.class);

            filter.doFilter(req, res, chain);

            verify(chain).doFilter(req, res);
        }
    }

    @Test
    void passesUnauthenticatedRequestsToTheEntryPoint() throws Exception {
        MockHttpServletRequest req = request("GET", "/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
    }

    @Test
    void passesThroughWhenTheOperatorRowIsGone() throws Exception {
        // CurrentOperator turns this into a clean 401 further down; the gate must not 403 it.
        UUID operatorId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));
        when(repo.findById(operatorId)).thenReturn(Optional.empty());
        MockHttpServletRequest req = request("GET", "/api/business-profile");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(req, res, chain);

        verify(chain).doFilter(req, res);
    }
}
