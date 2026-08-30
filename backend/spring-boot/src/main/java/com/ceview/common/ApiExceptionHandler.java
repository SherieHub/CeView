package com.ceview.common;

import org.slf4j.MDC;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;

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

    /**
     * Non-2xx from a WebClient call that did not go through
     * {@link com.ceview.ai.AIInferenceGatewayService}. AI calls no longer reach here:
     * that class's {@code .onStatus(...)} intercepts every non-2xx and throws an
     * {@code AiDependencyException} carrying the upstream `cause`, which
     * {@code AiDependencyExceptionHandler} renders instead.
     */
    @ExceptionHandler(WebClientResponseException.class)
    public ResponseEntity<?> downstream(WebClientResponseException e) {
        return ResponseEntity.status(502)
                .body(body("ai_service_unavailable", e.getStatusCode().value(), e.getMessage()));
    }

    /**
     * Connection-refused / timeout from a WebClient other than the AI gateway's —
     * e.g. {@code ExternalMarketDataClient}'s World Bank and forex clients. An
     * unreachable *FastAPI* no longer lands here: the gateway translates it into an
     * {@code AiDependencyException} naming {@code dependency: "fastapi"}, which this
     * shared handler could not do without mislabelling those other upstreams.
     */
    @ExceptionHandler(WebClientRequestException.class)
    public ResponseEntity<?> unreachable(WebClientRequestException e) {
        return ResponseEntity.status(503)
                .body(body("ai_service_unreachable", 503, e.getMessage()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> badArgs(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(body(e.getMessage(), 400, null));
    }

    /**
     * Catches {@link ResponseStatusException} thrown directly by controllers/helpers
     * (e.g. {@code CurrentOperator}'s 401, {@code BusinessProfileController}'s 403 on
     * cross-operator ownership) so their status *and* reason land in the same
     * {@code {error, status, traceId, code, message}} shape as every other handled
     * exception here, instead of falling through to Spring Boot's bare default error
     * body (which omits the message unless {@code server.error.include-message} is set).
     */
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> statusException(ResponseStatusException e) {
        HttpStatusCode status = e.getStatusCode();
        String error = switch (status.value()) {
            case 401 -> "unauthorized";
            case 403 -> "forbidden";
            case 404 -> "not_found";
            default -> "request_failed";
        };
        return ResponseEntity.status(status).body(body(error, status.value(), e.getReason()));
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
