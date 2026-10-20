package com.ceview.module3.social.publish.client;

/** Safe messages only: never retain response bodies, request URLs or token-bearing causes. */
public class DeliveryException extends RuntimeException {
    private final boolean authFailure;
    private final boolean retryable;
    public DeliveryException(String message, boolean authFailure, boolean retryable) {
        super(message); this.authFailure = authFailure; this.retryable = retryable;
    }
    public boolean isAuthFailure() { return authFailure; }
    public boolean isRetryable() { return retryable; }
}
