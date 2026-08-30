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
 * Server-side enforcement of the "complete your profile" gate: an authenticated operator
 * with no contactNumber yet (freshly provisioned via Google sign-in — see
 * AuthController#google) is blocked from every route except auth/actuator/error, so the
 * requirement can't be bypassed by calling the API directly instead of going through the
 * frontend's redirect.
 *
 * <p>Unauthenticated requests are passed through untouched — {@link JwtAuthenticationFilter}
 * / {@code SecurityConfig}'s entry point already own the 401 case; this filter only ever
 * adds a 403 on top of an otherwise-valid session.
 */
@Component
public class ProfileCompletionFilter extends OncePerRequestFilter {

    private final MsmeOperatorRepository repo;
    private final ObjectMapper objectMapper;

    public ProfileCompletionFilter(MsmeOperatorRepository repo, ObjectMapper objectMapper) {
        this.repo = repo;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (isExempt(req.getServletPath())) {
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
        if (op.isPresent() && !op.get().isProfileCompleted()) {
            res.setStatus(HttpServletResponse.SC_FORBIDDEN);
            res.setContentType("application/json");
            res.getWriter().write(objectMapper.writeValueAsString(
                Map.of("error", "profile incomplete", "code", "PROFILE_INCOMPLETE")));
            res.getWriter().flush();
            return;
        }

        chain.doFilter(req, res);
    }

    private boolean isExempt(String path) {
        return path.startsWith("/api/auth/") || path.startsWith("/actuator/") || path.equals("/error");
    }
}
