package com.ceview.email;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.time.Clock;

@Configuration
public class EmailConfig {

    private static final Logger log = LoggerFactory.getLogger(EmailConfig.class);

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }

    /**
     * {@code ceview.email.provider}: {@code log} (default; prints the code to the console) or
     * {@code resend}. The startup guard in RequiredSecretsEnvironmentPostProcessor guarantees the
     * API key and sender address exist whenever {@code resend} is selected.
     */
    @Bean
    public EmailSender emailSender(
        Environment env,
        @Value("${ceview.email.provider:log}") String provider,
        @Value("${ceview.email.resend.base-url:https://api.resend.com}") String baseUrl,
        @Value("${ceview.email.resend.api-key:}") String apiKey,
        @Value("${ceview.email.from:}") String from,
        @Value("${ceview.test-support.enabled:false}") boolean testSupport
    ) {
        EmailSender sender;
        if ("resend".equalsIgnoreCase(provider)) {
            sender = new ResendEmailSender(baseUrl, apiKey, from);
        } else {
            if (!env.acceptsProfiles(Profiles.of("h2")) && !testSupport) {
                log.warn("EMAIL_PROVIDER is 'log': verification codes are printed to this log and NO email is sent."
                    + " Set EMAIL_PROVIDER=resend with RESEND_API_KEY and EMAIL_FROM for real delivery.");
            }
            sender = new LogEmailSender();
        }
        return testSupport ? new CapturingEmailSender(sender) : sender;
    }
}
