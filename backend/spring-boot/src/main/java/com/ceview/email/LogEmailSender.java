package com.ceview.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Dev/e2e sender: writes the message to the application log instead of sending it. The plain-text
 * body carries the verification code, so a developer (or the seeded {@code @ceview.local}
 * operators, which have no real inbox) reads it from the backend console.
 */
public class LogEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(LogEmailSender.class);

    @Override
    public void send(EmailMessage message) {
        log.info("[email:log] to={} subject=\"{}\"\n{}", message.to(), message.subject(), message.text());
    }
}
