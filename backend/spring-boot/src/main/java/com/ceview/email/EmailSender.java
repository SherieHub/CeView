package com.ceview.email;

/** Delivers a transactional email. Implementations throw {@link EmailSendException} on failure. */
public interface EmailSender {
    void send(EmailMessage message);
}
