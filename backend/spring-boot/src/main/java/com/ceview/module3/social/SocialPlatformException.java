package com.ceview.module3.social;

/**
 * Any failure talking to a social platform (Meta Graph, TikTok): transport, non-2xx, an
 * in-body error, or an unparseable payload. The message is shown to operators, so it must
 * never contain a token or a client secret.
 */
public class SocialPlatformException extends RuntimeException {

    private final boolean authFailure;

    public SocialPlatformException(String message) {
        this(message, false, null);
    }

    public SocialPlatformException(String message, Throwable cause) {
        this(message, false, cause);
    }

    public SocialPlatformException(String message, boolean authFailure) {
        this(message, authFailure, null);
    }

    public SocialPlatformException(String message, boolean authFailure, Throwable cause) {
        super(message, cause);
        this.authFailure = authFailure;
    }

    /** The platform said the access token is invalid or expired — the operator must reconnect. */
    public boolean isAuthFailure() {
        return authFailure;
    }
}
