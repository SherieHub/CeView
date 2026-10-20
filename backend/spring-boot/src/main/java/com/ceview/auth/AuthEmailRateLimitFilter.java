package com.ceview.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.OptionalLong;
import java.util.Set;

/** Applies {@link AuthEmailRateLimiter} to the endpoints that cause an email to be sent. */
@Component
public class AuthEmailRateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> EMAIL_SENDING = Set.of(
        "POST /api/auth/register",
        "POST /api/auth/email-verification/send",
        "PATCH /api/auth/email",
        "POST /api/auth/password-reset/request");

    private final AuthEmailRateLimiter limiter;

    public AuthEmailRateLimitFilter(AuthEmailRateLimiter limiter) {
        this.limiter = limiter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !EMAIL_SENDING.contains(request.getMethod() + " " + path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        OptionalLong retryAfter = limiter.tryAcquire(request.getRemoteAddr());
        if (retryAfter.isPresent()) {
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter.getAsLong()));
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\","
                + "\"code\":\"RATE_LIMITED\",\"retryAfterSeconds\":" + retryAfter.getAsLong() + "}");
            return;
        }
        chain.doFilter(request, response);
    }
}
