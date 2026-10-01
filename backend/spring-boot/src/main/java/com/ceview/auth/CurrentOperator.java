package com.ceview.auth;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Resolves the UUID of the currently-authenticated operator from Spring Security's
 * context, instead of trusting any client-supplied id.
 *
 * <p>{@link JwtAuthenticationFilter} sets the security context's authentication name
 * to the raw operator UUID string (the JWT subject, which {@link JwtService#issue}
 * populates from {@code operatorId.toString()}). This component is the single place
 * that turns that string back into a {@link UUID}, so every controller that needs
 * "the current operator" — Module 1 today, Modules 2/3/4 as they're wired up — resolves
 * it the same way rather than re-parsing the principal ad hoc.
 */
@Component
public class CurrentOperator {

    private final MsmeOperatorRepository repo;

    public CurrentOperator(MsmeOperatorRepository repo) {
        this.repo = repo;
    }

    /**
     * @return the authenticated operator's UUID.
     * @throws ResponseStatusException 401 if there is no authenticated principal, the
     *         principal isn't a well-formed UUID, or no operator row exists for it any
     *         more. That last case is a valid, signature-checked JWT naming an operator
     *         that has since been deleted — or one minted against a different database
     *         entirely, e.g. a stale browser session surviving a local dev reset. Without
     *         this check that id flows straight into a controller's write path (see
     *         BusinessProfileController#save) and fails as a raw, unhandled
     *         DataIntegrityViolationException / foreign-key error instead of a clean
     *         "please sign in again". This should also never happen on a route guarded by
     *         {@code .anyRequest().authenticated()}, but we fail loudly with a clear
     *         status instead of letting a malformed-UUID parse surface as an unrelated
     *         NPE/IllegalArgumentException deeper in the call stack.
     */
    public UUID resolve() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "no authenticated operator in security context");
        }
        UUID operatorId;
        try {
            operatorId = UUID.fromString(auth.getName());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "authenticated principal is not a valid operator id");
        }
        if (!repo.existsById(operatorId)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "operator no longer exists — please sign in again");
        }
        return operatorId;
    }
}
