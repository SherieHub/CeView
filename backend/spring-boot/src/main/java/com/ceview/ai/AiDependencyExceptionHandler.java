package com.ceview.ai;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * Renders {@link AiDependencyException} as the unavailability contract body.
 *
 * <p>{@code @Order(HIGHEST_PRECEDENCE)} so this advice is consulted before
 * {@link com.ceview.common.ApiExceptionHandler}. Without it both sit at
 * {@code LOWEST_PRECEDENCE} and their relative dispatch order is unspecified — it
 * happens to work today only because no exception type overlaps between the two.
 * Ordering makes the guarantee real rather than incidental, and stays correct if
 * the generic handler ever gains a broader {@code RuntimeException} mapping.
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice
public class AiDependencyExceptionHandler {

    @ExceptionHandler(AiDependencyException.class)
    public ResponseEntity<Map<String, Object>> handle(AiDependencyException ex) {
        return ResponseEntity.status(ex.getStatus()).body(ex.toBody());
    }
}
