package com.ceview.auth;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Standalone unit coverage for {@link CurrentOperator} since it's shared infrastructure
 * that Module 2/3/4 controllers are about to reuse — its 401 paths are cheap to pin down
 * here rather than only indirectly via each controller's own tests.
 */
class CurrentOperatorTest {

    private final CurrentOperator currentOperator = new CurrentOperator();

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void resolveReturnsTheAuthenticatedOperatorId() {
        UUID operatorId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));

        assertEquals(operatorId, currentOperator.resolve());
    }

    @Test
    void resolveThrows401WhenNoAuthenticationIsPresent() {
        SecurityContextHolder.clearContext();

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, currentOperator::resolve);
        assertEquals(401, ex.getStatusCode().value());
    }

    @Test
    void resolveThrows401WhenPrincipalIsNotAWellFormedUuid() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken("not-a-uuid", null, List.of()));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, currentOperator::resolve);
        assertEquals(401, ex.getStatusCode().value());
    }
}
