package com.ceview.module3.social.publish.client;

import okhttp3.mockwebserver.*;
import org.junit.jupiter.api.*;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import static org.assertj.core.api.Assertions.*;

class DeliveryHttpTest {
    MockWebServer server;
    @BeforeEach void setup() throws Exception { server = new MockWebServer(); server.start(); }
    @AfterEach void close() throws Exception { server.shutdown(); }
    @Test void rateLimitsRetryButNeverExposeResponseSecrets() {
        server.enqueue(new MockResponse().setResponseCode(429).setBody("{\"error\":{\"code\":\"rate_limit_exceeded\",\"message\":\"token=secret https://sensitive.example\"}}"));
        assertThatThrownBy(() -> new DeliveryHttp().json(server.url("/write").toString(), "secret", Map.of()))
                .isInstanceOfSatisfying(DeliveryException.class, e -> {
                    assertThat(e.isRetryable()).isTrue(); assertThat(e.isAuthFailure()).isFalse();
                    assertThat(e.getMessage()).doesNotContain("secret", "sensitive"); assertThat(e.getCause()).isNull();
                });
    }
    @Test void rejectedWriteIsLoggedWithPlatformCodeSoTheCauseCanBeDiagnosed() {
        var logger = (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(DeliveryHttp.class);
        var appender = new ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent>();
        appender.start(); logger.addAppender(appender);
        try {
            server.enqueue(new MockResponse().setResponseCode(400).setBody("{\"error\":{\"code\":100,\"error_subcode\":1815857,\"type\":\"OAuthException\",\"message\":\"Invalid parameter\",\"error_user_title\":\"Budget too low\",\"error_user_msg\":\"Raise the daily budget.\",\"fbtrace_id\":\"AbC123\"}}"));
            String thrownMessage = null;
            try { new DeliveryHttp().json(server.url("/act_1/campaigns?fields=x").toString(), "secret-token", Map.of()); }
            catch (DeliveryException e) { thrownMessage = e.getMessage(); }
            // The platform's wording is for the server log only; the user-facing message stays generic.
            assertThat(thrownMessage).isNotNull().doesNotContain("Invalid parameter").doesNotContain("100");
            assertThat(appender.list).hasSize(1);
            var event = appender.list.get(0);
            assertThat(event.getLevel()).isEqualTo(ch.qos.logback.classic.Level.WARN);
            assertThat(event.getFormattedMessage()).contains("status=400", "code=100", "subcode=1815857", "OAuthException",
                    "Invalid parameter", "user_title=\"Budget too low\"", "user_msg=\"Raise the daily budget.\"", "fbtrace=AbC123", "/act_1/campaigns").doesNotContain("secret-token").doesNotContain("fields=x");
        } finally { logger.detachAppender(appender); }
    }
    @Test void platformExplanationIsCarriedSeparatelyFromTheGenericMessageAndScrubbed() {
        server.enqueue(new MockResponse().setResponseCode(400).setBody("{\"error\":{\"code\":100,\"message\":\"Invalid parameter\",\"error_user_title\":\"Budget Is Too Low\",\"error_user_msg\":\"Your ad set budget must be more than PHP63.32. See https://facebook.example/help?access_token=abc123 token=xyz\"}}"));
        DeliveryException thrown = null;
        try { new DeliveryHttp().json(server.url("/act_1/adsets").toString(), "secret-token", Map.of()); }
        catch (DeliveryException e) { thrown = e; }
        assertThat(thrown).isNotNull();
        assertThat(thrown.getMessage()).doesNotContain("PHP63.32");
        assertThat(thrown.getPlatformDetail()).contains("Your ad set budget must be more than PHP63.32")
                .doesNotContain("https://").doesNotContain("abc123").doesNotContain("xyz");
    }
    @Test void platformExplanationFallsBackToTheTitleAndIsAbsentWhenThePlatformGivesNone() {
        server.enqueue(new MockResponse().setResponseCode(400).setBody("{\"error\":{\"code\":100,\"error_user_title\":\"Budget Is Too Low\"}}"));
        DeliveryException withTitle = null;
        try { new DeliveryHttp().json(server.url("/w").toString(), "t", Map.of()); } catch (DeliveryException e) { withTitle = e; }
        assertThat(withTitle.getPlatformDetail()).isEqualTo("Budget Is Too Low");
        server.enqueue(new MockResponse().setResponseCode(400).setBody("{\"error\":{\"code\":100,\"message\":\"Invalid parameter\"}}"));
        DeliveryException none = null;
        try { new DeliveryHttp().json(server.url("/w").toString(), "t", Map.of()); } catch (DeliveryException e) { none = e; }
        assertThat(none.getPlatformDetail()).isNull();
    }
    @Test void ambiguousTimeoutDoesNotRetryRemoteWriteOrExposeToken() {
        // Warm Reactor's first-request startup before exercising the response timeout.
        server.enqueue(new MockResponse().setBody("{}"));
        new DeliveryHttp().get(server.url("/warmup").toString(), "secret");
        server.enqueue(new MockResponse().setBody("{\"id\":\"created\"}").setBodyDelay(3, TimeUnit.SECONDS));
        assertThatThrownBy(() -> new DeliveryHttp(Duration.ofSeconds(1)).json(server.url("/write").toString(), "secret", Map.of()))
                .isInstanceOfSatisfying(DeliveryException.class, e -> {
                    assertThat(e.isRetryable()).isFalse(); assertThat(e.getMessage()).contains("check the platform").doesNotContain("secret");
                    assertThat(e.getCause()).isNull();
                });
        assertThat(server.getRequestCount()).isEqualTo(2);
    }
    @Test void serverErrorAfterWriteIsAmbiguousAndNotAutomaticallyRepeated() {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("{\"error\":{\"message\":\"secret\"}}"));
        assertThatThrownBy(() -> new DeliveryHttp().json(server.url("/write").toString(), "secret", Map.of()))
                .isInstanceOfSatisfying(DeliveryException.class, e -> assertThat(e.isRetryable()).isFalse());
    }
    @Test void malformedResponseIsSanitized() {
        server.enqueue(new MockResponse().setBody("secret non-json response"));
        assertThatThrownBy(() -> new DeliveryHttp().get(server.url("/read").toString(), "secret"))
                .isInstanceOfSatisfying(DeliveryException.class, e -> { assertThat(e.getMessage()).doesNotContain("secret"); assertThat(e.getCause()).isNull(); });
    }
}
