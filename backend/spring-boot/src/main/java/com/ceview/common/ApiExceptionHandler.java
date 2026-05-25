package com.ceview.common;

import org.slf4j.MDC;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Global exception → JSON shape. Adds {@code traceId} (always present, sourced
 * from {@link TraceIdFilter}'s MDC entry) and {@code code} (when a controller
 * tagged the failure via {@code MDC.put("code", ...)}) so the frontend can
 * surface both in its error banner and match them against backend logs.
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> validation(MethodArgumentNotValidException e) {
        return ResponseEntity.badRequest().body(body("validation_failed", 400, e.getMessage()));
    }

    @ExceptionHandler(WebClientResponseException.class)
    public ResponseEntity<?> downstream(WebClientResponseException e) {
        return ResponseEntity.status(502)
                .body(body("ai_service_unavailable", e.getStatusCode().value(), e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> badArgs(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(body(e.getMessage(), 400, null));
    }

    private Map<String, Object> body(String error, int status, String message) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("error", error);
        out.put("status", status);
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        if (traceId != null) out.put("traceId", traceId);
        String code = MDC.get(TraceIdFilter.MDC_CODE_KEY);
        if (code != null) out.put("code", code);
        if (message != null && !message.isBlank()) out.put("message", message);
        return out;
    }
}
