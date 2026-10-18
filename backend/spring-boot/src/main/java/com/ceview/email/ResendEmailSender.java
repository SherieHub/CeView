package com.ceview.email;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Sends through Resend's HTTPS API (https://resend.com/docs/api-reference/emails/send-email).
 * HTTPS rather than SMTP on purpose: Render's free web services block outbound SMTP ports
 * 25/465/587, and Resend's free tier (3,000/month, 100/day) keeps this at no cost.
 */
public class ResendEmailSender implements EmailSender {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final WebClient http;
    private final String from;

    public ResendEmailSender(String baseUrl, String apiKey, String from) {
        this.from = from;
        this.http = WebClient.builder()
            .baseUrl(baseUrl)
            .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
            .build();
    }

    @Override
    public void send(EmailMessage message) {
        try {
            http.post()
                .uri("/emails")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of(
                    "from", from,
                    "to", List.of(message.to()),
                    "subject", message.subject(),
                    "html", message.html(),
                    "text", message.text()))
                .retrieve()
                .toBodilessEntity()
                .block(TIMEOUT);
        } catch (WebClientResponseException e) {
            // Includes 429 (daily cap reached) and 4xx for undeliverable domains such as .local.
            throw new EmailSendException("email provider rejected the message: HTTP " + e.getStatusCode().value(), e);
        } catch (RuntimeException e) {
            throw new EmailSendException("email provider unreachable", e);
        }
    }
}
