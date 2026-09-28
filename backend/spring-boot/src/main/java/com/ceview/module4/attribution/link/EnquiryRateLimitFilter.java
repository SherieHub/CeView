package com.ceview.module4.attribution.link;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class EnquiryRateLimitFilter extends OncePerRequestFilter {
    private final AttributionRateLimiter limiter;

    public EnquiryRateLimitFilter(AttributionRateLimiter limiter) { this.limiter = limiter; }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !("POST".equals(request.getMethod()) && path.equals("/api/public/attribution/enquiries"))
                && !("GET".equals(request.getMethod()) && path.equals("/api/public/attribution/enquiries/context"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!limiter.tryAcquire(request.getRemoteAddr())) {
            response.setStatus(429);
            response.setHeader("Retry-After", "60");
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Please try again later.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
