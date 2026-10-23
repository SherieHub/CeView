package com.ceview.email;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * E2E-only: returns the verification / reset code most recently emailed to an address, so
 * Playwright can finish the sign-up flow without a real inbox. Exists only when
 * {@code ceview.test-support.enabled=true}, which RequiredSecretsEnvironmentPostProcessor refuses
 * to combine with a real email provider.
 */
@RestController
@RequestMapping("/api/test-support")
@ConditionalOnProperty(name = "ceview.test-support.enabled", havingValue = "true")
public class TestSupportController {

    private static final Pattern CODE = Pattern.compile("Your code: (\\d{6})");

    private final EmailSender sender;

    public TestSupportController(EmailSender sender) {
        this.sender = sender;
    }

    @GetMapping("/email-codes/latest")
    public ResponseEntity<?> latestCode(@RequestParam String email) {
        if (!(sender instanceof CapturingEmailSender capturing)) {
            return ResponseEntity.status(503).body(Map.of("error", "email capture is not active"));
        }
        EmailMessage message = capturing.last(email);
        if (message == null) {
            return ResponseEntity.status(404).body(Map.of("error", "no email sent to that address"));
        }
        Matcher m = CODE.matcher(message.text());
        if (!m.find()) {
            return ResponseEntity.status(404).body(Map.of("error", "no code in the last email"));
        }
        return ResponseEntity.ok(Map.of("code", m.group(1), "subject", message.subject()));
    }
}
