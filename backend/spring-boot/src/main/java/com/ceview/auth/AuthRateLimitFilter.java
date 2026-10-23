package com.ceview.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Applies {@link AuthRateLimiter} to POST /api/auth/register and PATCH /api/auth/profile. */
@Component
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private final AuthRateLimiter limiter;

    public AuthRateLimitFilter(AuthRateLimiter limiter) { this.limiter = limiter; }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        boolean register = "POST".equals(request.getMethod()) && path.equals("/api/auth/register");
        boolean profile = "PATCH".equals(request.getMethod()) && path.equals("/api/auth/profile");
        return !(register || profile);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String key = request.getRemoteAddr();
        if (!limiter.tryAcquire(key)) {
            long retryAfter = limiter.retryAfterSeconds(key);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retryAfter));
            response.setContentType("application/json");
            // Same body as AuthEmailRateLimitFilter, so the frontend's RATE_LIMITED handling covers both.
            response.getWriter().write("{\"error\":\"Too many requests. Please try again later.\","
                + "\"code\":\"RATE_LIMITED\",\"retryAfterSeconds\":" + retryAfter + "}");
            return;
        }
        chain.doFilter(request, response);
    }
}
