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
        if (isExempt(requestPath(req))) {
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

    /**
     * Reconstructs the dispatched path exactly as {@code isExempt}'s callers expect.
     *
     * <p>Pre-existing bug, found while adding the ad-connection callback exemption:
     * {@code HttpServletRequest.getServletPath()} alone is only the full path when the
     * dispatcher servlet is mapped with a bare {@code "/"} pattern. Under this app's actual
     * servlet mapping (confirmed via a full {@code @SpringBootTest}, not the pre-existing
     * hand-constructed {@code MockHttpServletRequest} unit tests, which set
     * {@code servletPath} explicitly and so never exercised this), {@code getServletPath()}
     * returns {@code ""} and the whole path lands in {@code getPathInfo()} instead — so
     * every {@code isExempt} check silently evaluated against an empty string and always
     * returned {@code false}, 403'ing every authenticated-but-incomplete-profile request
     * even to the exempted paths (including {@code /api/auth/profile}, the "complete your
     * profile" endpoint itself). Concatenating both fields is correct regardless of which
     * mapping style is in effect, since exactly one of them is ever non-empty.
     */
    private static String requestPath(HttpServletRequest req) {
        String servletPath = req.getServletPath();
        String pathInfo = req.getPathInfo();
        return pathInfo == null ? servletPath : servletPath + pathInfo;
    }

    private boolean isExempt(String path) {
        return path.startsWith("/api/auth/")
            || path.startsWith("/actuator/")
            || path.equals("/error")
            // OAuth callback: a redirect from the ad platform, not a UI call.
            // Blocking it here would 403 an operator mid-redirect with no way
            // to recover the grant they just approved.
            || isAdConnectionCallback(path);
    }

    /**
     * Matches {@code /api/ad-connections/{provider}/callback} and nothing else —
     * kept in lockstep with the single-segment {@code /api/ad-connections/*&#47;callback}
     * Ant matcher in {@code SecurityConfig}.
     */
    private boolean isAdConnectionCallback(String path) {
        return path.matches("^/api/ad-connections/[^/]+/callback$");
    }
}
