package com.ceview.email;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResendEmailSenderTest {

    private static final EmailMessage MESSAGE =
        new EmailMessage("ana@example.com", "Your CeView verification code", "<p>html</p>", "Your code: 123456");

    private MockWebServer server;
    private ResendEmailSender sender;

    @BeforeEach
    void start() throws IOException {
        server = new MockWebServer();
        server.start();
        sender = new ResendEmailSender(server.url("/").toString().replaceAll("/$", ""),
            "re_test_key", "CeView <no-reply@example.com>");
    }

    @AfterEach
    void stop() throws IOException {
        server.shutdown();
    }

    @Test
    void postsTheMessageToResendWithTheApiKey() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(200).setBody("{\"id\":\"abc\"}"));

        sender.send(MESSAGE);

        RecordedRequest request = server.takeRequest();
        assertEquals("POST", request.getMethod());
        assertEquals("/emails", request.getPath());
        assertEquals("Bearer re_test_key", request.getHeader("Authorization"));
        String body = request.getBody().readUtf8();
        assertTrue(body.contains("\"from\":\"CeView <no-reply@example.com>\""), body);
        assertTrue(body.contains("\"to\":[\"ana@example.com\"]"), body);
        assertTrue(body.contains("\"subject\":\"Your CeView verification code\""), body);
        assertTrue(body.contains("Your code: 123456"), body);
        assertTrue(body.contains("<p>html</p>"), body);
    }

    @Test
    void reportsAProviderRejectionAsAnEmailSendException() {
        server.enqueue(new MockResponse().setResponseCode(422).setBody("{\"message\":\"invalid to\"}"));

        EmailSendException e = assertThrows(EmailSendException.class, () -> sender.send(MESSAGE));

        assertTrue(e.getMessage().contains("422"));
    }

    @Test
    void reportsTheDailyQuotaBeingHitAsAnEmailSendException() {
        server.enqueue(new MockResponse().setResponseCode(429));

        EmailSendException e = assertThrows(EmailSendException.class, () -> sender.send(MESSAGE));

        assertTrue(e.getMessage().contains("429"));
    }

    @Test
    void reportsAnUnreachableProviderAsAnEmailSendException() throws IOException {
        server.shutdown();

        assertThrows(EmailSendException.class, () -> sender.send(MESSAGE));
    }

    @Test
    void neverPutsTheApiKeyInTheExceptionMessage() {
        server.enqueue(new MockResponse().setResponseCode(401));

        EmailSendException e = assertThrows(EmailSendException.class, () -> sender.send(MESSAGE));

        assertTrue(!e.getMessage().contains("re_test_key"));
    }
}
