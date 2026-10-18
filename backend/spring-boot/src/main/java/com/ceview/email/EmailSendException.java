package com.ceview.email;

/** The provider rejected or could not be reached for a send; the caller decides how to surface it. */
public class EmailSendException extends RuntimeException {
    public EmailSendException(String message) { super(message); }
    public EmailSendException(String message, Throwable cause) { super(message, cause); }
}
