package com.ceview.auth;

import com.ceview.testsupport.MutableClock;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.Duration;
import java.time.Instant;
import java.util.OptionalLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class AuthEmailRateLimiterTest {

    // Window boundaries fall on multiples of 15 minutes since the epoch; start 1 minute in.
    private final MutableClock clock = new MutableClock(Instant.parse("2026-10-18T08:01:00Z"));
    private final AuthEmailRateLimiter limiter = new AuthEmailRateLimiter(clock, 3, Duration.ofMinutes(15));

    @Test
    void allowsRequestsUpToTheLimitThenReportsTheSecondsUntilReset() {
        for (int i = 0; i < 3; i++) {
            assertTrue(limiter.tryAcquire("1.2.3.4").isEmpty());
        }

        OptionalLong blocked = limiter.tryAcquire("1.2.3.4");

        assertTrue(blocked.isPresent());
        assertEquals(14 * 60, blocked.getAsLong(), "window ends at 08:15:00, 14 minutes away");
    }

    @Test
    void countsEachAddressSeparately() {
        for (int i = 0; i < 3; i++) limiter.tryAcquire("1.2.3.4");

        assertTrue(limiter.tryAcquire("5.6.7.8").isEmpty());
    }

    @Test
    void startsAFreshBudgetInTheNextWindow() {
        for (int i = 0; i < 4; i++) limiter.tryAcquire("1.2.3.4");

        clock.advance(Duration.ofMinutes(15));

        assertTrue(limiter.tryAcquire("1.2.3.4").isEmpty());
    }

    @Test
    void filterRejectsWith429AndRetryAfterOnceTheBudgetIsSpent() throws Exception {
        AuthEmailRateLimitFilter filter = new AuthEmailRateLimitFilter(limiter);
        FilterChain chain = mock(FilterChain.class);
        for (int i = 0; i < 3; i++) {
            filter.doFilter(post("/api/auth/register"), new MockHttpServletResponse(), chain);
        }

        MockHttpServletResponse res = new MockHttpServletResponse();
        MockHttpServletRequest fourth = post("/api/auth/password-reset/request");
        filter.doFilter(fourth, res, chain);

        assertEquals(429, res.getStatus());
        assertEquals("840", res.getHeader("Retry-After"));
        assertTrue(res.getContentAsString().contains("RATE_LIMITED"));
        verify(chain, never()).doFilter(fourth, res);
    }

    @Test
    void filterOnlyCountsTheEndpointsThatSendEmail() throws Exception {
        AuthEmailRateLimitFilter filter = new AuthEmailRateLimitFilter(limiter);
        FilterChain chain = mock(FilterChain.class);

        // Far more than the budget of 3 against endpoints that send nothing.
        for (int i = 0; i < 10; i++) {
            filter.doFilter(post("/api/auth/login"), new MockHttpServletResponse(), chain);
        }
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(post("/api/auth/register"), res, chain);

        assertEquals(200, res.getStatus(), "login traffic did not use up the email-sending budget");
    }

    @Test
    void filterCoversEveryEmailSendingEndpoint() throws Exception {
        AuthEmailRateLimitFilter filter = new AuthEmailRateLimitFilter(limiter);
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(post("/api/auth/register"), new MockHttpServletResponse(), chain);
        filter.doFilter(post("/api/auth/email-verification/send"), new MockHttpServletResponse(), chain);
        MockHttpServletRequest patch = new MockHttpServletRequest("PATCH", "/api/auth/email");
        patch.setRemoteAddr("1.2.3.4");
        filter.doFilter(patch, new MockHttpServletResponse(), chain);

        // Three requests across three different endpoints exhausted the shared budget of 3.
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(post("/api/auth/password-reset/request"), res, chain);

        assertEquals(429, res.getStatus());
    }

    private static MockHttpServletRequest post(String path) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", path);
        req.setRemoteAddr("1.2.3.4");
        return req;
    }
}
