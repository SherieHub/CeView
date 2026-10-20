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
