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
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Standalone unit coverage for {@link CurrentOperator} since it's shared infrastructure
 * that Module 2/3/4 controllers are about to reuse — its 401 paths are cheap to pin down
 * here rather than only indirectly via each controller's own tests.
 */
class CurrentOperatorTest {

    private final MsmeOperatorRepository repo = mock(MsmeOperatorRepository.class);
    private final CurrentOperator currentOperator = new CurrentOperator(repo);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void resolveReturnsTheAuthenticatedOperatorId() {
        UUID operatorId = UUID.randomUUID();
        when(repo.existsById(operatorId)).thenReturn(true);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));

        assertEquals(operatorId, currentOperator.resolve());
    }

    @Test
    void resolveThrows401WhenTheOperatorNoLongerExists() {
        // A JWT can outlive the row it names — the account it was issued for is later
        // deleted, or the token was minted against a different database entirely (a
        // stale session surviving a local dev reset). Letting that reach a controller
        // that writes with this id as a foreign key produces a raw, unhandled 500 from
        // the database instead of a clean "please sign in again".
        UUID operatorId = UUID.randomUUID();
        when(repo.existsById(operatorId)).thenReturn(false);
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(operatorId.toString(), null, List.of()));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, currentOperator::resolve);
        assertEquals(401, ex.getStatusCode().value());
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
