package com.ceview.module3.social.publish.client;

/**
 * Safe messages only: never retain response bodies, request URLs or token-bearing causes.
 *
 * <p>{@code platformDetail} is the platform's own user-facing explanation (already scrubbed of
 * links and tokens), kept apart from the generic message so callers choose whether to show it.
 */
public class DeliveryException extends RuntimeException {
    private final boolean authFailure;
    private final boolean retryable;
    private final String platformDetail;
    public DeliveryException(String message, boolean authFailure, boolean retryable) {
        this(message, authFailure, retryable, null);
    }
    public DeliveryException(String message, boolean authFailure, boolean retryable, String platformDetail) {
        super(message); this.authFailure = authFailure; this.retryable = retryable; this.platformDetail = platformDetail;
    }
    public boolean isAuthFailure() { return authFailure; }
    public boolean isRetryable() { return retryable; }
    public String getPlatformDetail() { return platformDetail; }
}
