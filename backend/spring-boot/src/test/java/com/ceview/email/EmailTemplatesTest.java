package com.ceview.email;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EmailTemplatesTest {

    @Test
    void verificationEmailCarriesTheCodeInBothHtmlAndText() {
        EmailMessage m = EmailTemplates.verificationCode("ana@example.com", "Ana", "042917", 10);

        assertEquals("ana@example.com", m.to());
        assertEquals("Your CeView verification code", m.subject());
        assertTrue(m.text().contains("Your code: 042917"), "leading zeros are preserved");
        assertTrue(m.html().contains("042917"));
        assertTrue(m.text().contains("Hi Ana"));
        assertTrue(m.text().contains("expires in 10 minutes"));
    }

    @Test
    void resetEmailHasItsOwnSubjectAndWording() {
        EmailMessage m = EmailTemplates.passwordReset("ana@example.com", "Ana", "123456", 10);

        assertEquals("Reset your CeView password", m.subject());
        assertTrue(m.text().contains("choose a new password"));
        assertTrue(m.text().contains("Your code: 123456"));
    }

    @Test
    void htmlEscapesTheRecipientsNameSoItCannotInjectMarkup() {
        EmailMessage m = EmailTemplates.verificationCode("a@example.com", "<script>alert(1)</script>", "123456", 10);

        assertFalse(m.html().contains("<script>"));
        assertTrue(m.html().contains("&lt;script&gt;"));
    }

    @Test
    void fallsBackToThereWhenTheNameIsMissing() {
        assertTrue(EmailTemplates.verificationCode("a@example.com", null, "123456", 10).text().contains("Hi there"));
        assertTrue(EmailTemplates.verificationCode("a@example.com", "  ", "123456", 10).text().contains("Hi there"));
    }

    @Test
    void htmlIsAWellFormedStandaloneDocument() {
        String html = EmailTemplates.verificationCode("a@example.com", "Ana", "123456", 10).html();

        assertTrue(html.startsWith("<!doctype html>"));
        assertTrue(html.contains("</html>"));
        assertFalse(html.contains("%s"), "every placeholder was filled");
    }
}
