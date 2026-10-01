package com.ceview.module4.adconnections.client;

/**
 * Any failure talking to an ad platform: transport, non-2xx, an in-body error
 * code, or an unparseable payload. The message is surfaced to the operator, so
 * it must never contain a token.
 */
public class AdPlatformException extends RuntimeException {

    public AdPlatformException(String message) {
        super(message);
    }

    public AdPlatformException(String message, Throwable cause) {
        super(message, cause);
    }
}
