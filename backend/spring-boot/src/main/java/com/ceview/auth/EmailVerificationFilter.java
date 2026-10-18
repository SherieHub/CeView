package com.ceview.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Server-side enforcement of the "verify your email" gate: an authenticated operator whose email
 * is not verified yet is blocked from every route except the ones {@link ProfileCompletionFilter}
 * also exempts (auth, actuator, error, public attribution), so the requirement cannot be
 * bypassed by calling the API directly instead of going through the frontend's redirect.
 *
 * <p>Same shape as {@link ProfileCompletionFilter}: unauthenticated requests pass through
 * untouched (the 401 belongs to {@link JwtAuthenticationFilter} / SecurityConfig), and this only
 * ever adds a 403 on top of an otherwise-valid session. Runs before that filter, so an
 * unverified operator is told to verify before being told to complete their profile.
 */
@Component
public class EmailVerificationFilter extends OncePerRequestFilter {

    private final MsmeOperatorRepository repo;
    private final ObjectMapper objectMapper;

    public EmailVerificationFilter(MsmeOperatorRepository repo, ObjectMapper objectMapper) {
        this.repo = repo;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (ProfileCompletionFilter.isExempt(ProfileCompletionFilter.requestPath(req))
                || isTestSupport(ProfileCompletionFilter.requestPath(req))) {
            chain.doFilter(req, res);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            chain.doFilter(req, res);
            return;
        }

        UUID operatorId;
        try {
            operatorId = UUID.fromString(auth.getName());
        } catch (IllegalArgumentException e) {
            chain.doFilter(req, res);
            return;
        }

        Optional<MsmeOperator> op = repo.findById(operatorId);
        if (op.isPresent() && !op.get().isEmailVerified()) {
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json");
            res.getWriter().write(objectMapper.writeValueAsString(
                Map.of("error", "email not verified", "code", "EMAIL_NOT_VERIFIED")));
            res.getWriter().flush();
            return;
        }

        chain.doFilter(req, res);
    }

    /** The e2e code-reading hook; the controller only exists when test support is enabled. */
    private static boolean isTestSupport(String path) {
        return path.startsWith("/api/test-support/");
    }
}
