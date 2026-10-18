package com.ceview.email;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Test-support decorator: forwards to the real sender and remembers the last message sent to each
 * address, so the e2e suite can read the verification code through
 * {@code TestSupportController}. Only wired when {@code ceview.test-support.enabled=true}.
 */
public class CapturingEmailSender implements EmailSender {

    private final EmailSender delegate;
    private final Map<String, EmailMessage> lastByRecipient = new ConcurrentHashMap<>();

    public CapturingEmailSender(EmailSender delegate) {
        this.delegate = delegate;
    }

    @Override
    public void send(EmailMessage message) {
        delegate.send(message);
        lastByRecipient.put(message.to().toLowerCase(), message);
    }

    public EmailMessage last(String recipient) {
        return lastByRecipient.get(recipient.toLowerCase());
    }
}
