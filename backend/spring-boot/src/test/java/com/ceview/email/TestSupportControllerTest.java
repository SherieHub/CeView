package com.ceview.email;

import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class TestSupportControllerTest {

    private final CapturingEmailSender capture = new CapturingEmailSender(mock(EmailSender.class));
    private final TestSupportController controller = new TestSupportController(capture);

    @Test
    void returnsTheCodeFromTheLastEmailSentToTheAddress() {
        capture.send(EmailTemplates.verificationCode("Ana@Example.com", "Ana", "111111", 10));
        capture.send(EmailTemplates.verificationCode("ana@example.com", "Ana", "222222", 10));

        ResponseEntity<?> response = controller.latestCode("ANA@example.com");

        assertEquals(200, response.getStatusCode().value());
        assertEquals("222222", ((Map<?, ?>) response.getBody()).get("code"));
    }

    @Test
    void is404WhenNothingWasSentToTheAddress() {
        assertEquals(404, controller.latestCode("nobody@example.com").getStatusCode().value());
    }

    @Test
    void is503WhenTheSenderIsNotTheCapturingOne() {
        TestSupportController plain = new TestSupportController(mock(EmailSender.class));

        assertEquals(503, plain.latestCode("ana@example.com").getStatusCode().value());
    }

    @Test
    void capturingSenderStillForwardsToTheRealSender() {
        EmailSender delegate = mock(EmailSender.class);
        EmailMessage message = EmailTemplates.verificationCode("a@example.com", "Ana", "123456", 10);

        new CapturingEmailSender(delegate).send(message);

        org.mockito.Mockito.verify(delegate).send(message);
    }
}
