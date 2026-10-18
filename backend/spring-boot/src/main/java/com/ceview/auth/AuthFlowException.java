package com.ceview.auth;

import java.util.Map;

/**
 * A client-facing failure in the sign-up / verification / reset flows. Carries a stable
 * machine-readable {@code code} (the frontend switches on it) plus optional extra fields such as
 * {@code retryAfterSeconds} or {@code attemptsRemaining}. Rendered by
 * {@link AuthController#authFlow(AuthFlowException)}.
 */
public class AuthFlowException extends RuntimeException {

    private final int status;
    private final String code;
    private final Map<String, Object> details;

    public AuthFlowException(int status, String code, String message) {
        this(status, code, message, Map.of());
    }

    public AuthFlowException(int status, String code, String message, Map<String, Object> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }

    public int status() { return status; }
    public String code() { return code; }
    public Map<String, Object> details() { return details; }
}
