package com.ceview.ai;

import com.ceview.common.ApiExceptionHandler;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A FastAPI 503 carrying the unavailability contract must reach the browser with
 * its `cause` unchanged. Re-wording it here would defeat the whole point: the
 * developer needs the sentence written by the service that actually knows why.
 */
class AiDependencyPassthroughTest {

    @Test
    void parsesTheContractBodyIntoAnException() {
        Map<String, Object> body = Map.of(
                "code", "MOD31_LLM_UNAVAILABLE",
                "message", "Caption generation is unavailable.",
                "dependency", "groq",
                "cause", "GROQ_API_KEY is not set",
                "stage", "fastapi-sbert/caption_agent");

        AiDependencyException ex = AiDependencyException.fromBody(503, body, "content/generate");

        assertThat(ex.getCode()).isEqualTo("MOD31_LLM_UNAVAILABLE");
        assertThat(ex.getDependency()).isEqualTo("groq");
        assertThat(ex.getCause2()).isEqualTo("GROQ_API_KEY is not set");
        assertThat(ex.getStatus()).isEqualTo(503);
    }

    @Test
    void appendsItsOwnHopToTheStage() {
        Map<String, Object> body = Map.of(
                "code", "X", "message", "y", "dependency", "groq",
                "cause", "z", "stage", "fastapi-sbert/caption_agent");

        AiDependencyException ex = AiDependencyException.fromBody(503, body, "content/generate");

        assertThat(ex.getStage())
                .isEqualTo("fastapi-sbert/caption_agent -> spring/content/generate");
    }

    @Test
    void aBodyWithoutTheContractIsNotSwallowed() {
        AiDependencyException ex =
                AiDependencyException.fromBody(502, Map.of(), "content/generate");

        assertThat(ex.getCode()).isEqualTo("AI_SERVICE_UNREACHABLE");
        assertThat(ex.getDependency()).isEqualTo("fastapi");
        assertThat(ex.getCause2()).contains("502");
    }

    @Test
    void preservesTheBodyForRendering() {
        Map<String, Object> body = Map.of(
                "code", "MOD31_LLM_UNAVAILABLE",
                "message", "Caption generation is unavailable.",
                "dependency", "groq",
                "cause", "GROQ_API_KEY is not set",
                "stage", "fastapi-sbert/caption_agent");

        AiDependencyException ex = AiDependencyException.fromBody(503, body, "content/generate");

        assertThat(ex.toBody())
                .containsEntry("code", "MOD31_LLM_UNAVAILABLE")
                .containsEntry("dependency", "groq")
                .containsEntry("cause", "GROQ_API_KEY is not set")
                .containsKey("stage")
                .containsKey("message");
    }

    // ─── transport failure: FastAPI never answered at all ────────────────────

    /**
     * Connection-refused is the most common local-dev failure (the operator forgot
     * to start the container). It must arrive as the same contract as any other
     * unavailability, or the frontend's dependency-presence check misfiles it as a
     * generic "Something went wrong".
     */
    @Test
    void aTransportFailureBecomesTheContract() {
        AiDependencyException ex = AiDependencyException.unreachable(
                "content/generate",
                new java.net.ConnectException("Connection refused: localhost/127.0.0.1:8000"));

        assertThat(ex.getStatus()).isEqualTo(503);
        assertThat(ex.getCode()).isEqualTo("AI_SERVICE_UNREACHABLE");
        assertThat(ex.getDependency()).isEqualTo("fastapi");
        assertThat(ex.getStage()).isEqualTo("spring/content/generate");
        assertThat(ex.getCause2())
                .contains("ConnectException")
                .contains("localhost/127.0.0.1:8000");
    }

    /** A connection exception's message can be long, and this reaches the browser. */
    @Test
    void truncatesALongTransportCause() {
        AiDependencyException ex = AiDependencyException.unreachable(
                "content/generate", new IllegalStateException("x".repeat(500)));

        assertThat(ex.getCause2())
                .startsWith("IllegalStateException: ")
                .endsWith("… (truncated)")
                .hasSizeLessThan(260);
    }

    /**
     * With both advices registered, the dedicated handler must win — otherwise the
     * generic {error, status} shape would swallow `cause`. Proven, not assumed.
     */
    @Test
    void theDedicatedHandlerWinsOverTheGenericOne() throws Exception {
        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new ThrowingController())
                .setControllerAdvice(new ApiExceptionHandler(), new AiDependencyExceptionHandler())
                .build();

        mvc.perform(get("/boom"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("MOD31_LLM_UNAVAILABLE"))
                .andExpect(jsonPath("$.dependency").value("groq"))
                .andExpect(jsonPath("$.cause").value("GROQ_API_KEY is not set"))
                .andExpect(jsonPath("$.stage")
                        .value("fastapi-sbert/caption_agent -> spring/content/generate"));
    }

    // ─── read timeout: connection accepted, no response ──────────────────────



    /** The timeout cause is authored, not raw: "30000000000 NANOSECONDS" helps nobody. */
    @Test
    void anAuthoredTimeoutCauseBecomesTheContract() {
        AiDependencyException ex = AiDependencyException.unreachableAfterTimeout(
                "content/generate",
                "no response within 30s (the service may still be loading its model)");

        assertThat(ex.getStatus()).isEqualTo(503);
        assertThat(ex.getCode()).isEqualTo("AI_SERVICE_UNREACHABLE");
        assertThat(ex.getDependency()).isEqualTo("fastapi");
        assertThat(ex.getCause2()).isEqualTo(
                "no response within 30s (the service may still be loading its model)");
        assertThat(ex.getStage()).isEqualTo("spring/content/generate");
    }

    // ─── parseErrorBody never returns null, whatever arrives ──────────────────

    /**
     * {@code fromBody}'s never-null contract rests on this. An HTML proxy page, a
     * JSON array, a bare scalar, or nothing at all must all yield an empty map so the
     * transport-failure branch reports the real status.
     */
    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {
            "   ",
            "<html><body>502 Bad Gateway</body></html>",
            "[1,2,3]",
            "just a string",
            "\"just a quoted string\"",
            "42",
            "null",
            "{ truncated json"})
    void parseErrorBodyNeverReturnsNull(String rawBody) {
        assertThat(AIInferenceGatewayService.parseErrorBody(rawBody))
                .isNotNull()
                .isEmpty();
    }

    /** A well-formed contract body still parses, of course. */
    @Test
    void parseErrorBodyReadsAContractBody() {
        assertThat(AIInferenceGatewayService.parseErrorBody(
                "{\"code\":\"MOD31_LLM_UNAVAILABLE\",\"dependency\":\"groq\"}"))
                .containsEntry("code", "MOD31_LLM_UNAVAILABLE")
                .containsEntry("dependency", "groq");
    }

    /** A non-string value must not blow up {@code fromBody}'s string extraction. */
    @Test
    void aNonStringCodeIsTreatedAsAbsent() {
        AiDependencyException ex =
                AiDependencyException.fromBody(502, Map.of("code", 123), "content/generate");

        assertThat(ex.getCode()).isEqualTo("AI_SERVICE_UNREACHABLE");
    }

    /**
     * The transport path must not fall through to {@link ApiExceptionHandler}'s
     * legacy {@code {error: "ai_service_unreachable", status}} body, which carries
     * no `dependency` and no `cause`.
     */
    @Test
    void theTransportFailureIsRenderedAsTheContractNotTheLegacyShape() throws Exception {
        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new ThrowingController())
                .setControllerAdvice(new ApiExceptionHandler(), new AiDependencyExceptionHandler())
                .build();

        mvc.perform(get("/unreachable"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_SERVICE_UNREACHABLE"))
                .andExpect(jsonPath("$.dependency").value("fastapi"))
                .andExpect(jsonPath("$.cause").value(
                        org.hamcrest.Matchers.containsString("Connection refused")))
                .andExpect(jsonPath("$.stage").value("spring/content/generate"))
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    // ─── end to end through the real gateway, over real sockets ──────────────

    /**
     * A server that accepts the connection and then never writes a byte — exactly
     * what a cold-starting fastapi-sbert looks like while it loads its ~1.1 GB E5
     * encoder. Reactor raises the bare IllegalStateException here for real, not as
     * a hand-built stand-in.
     *
     * <p><b>This path does NOT produce the unavailability contract.</b>
     * {@code post(...)} catches only {@link WebClientRequestException}, and Reactor
     * signals a blocking-read timeout as a plain {@link IllegalStateException} with
     * no distinct type. It therefore propagates untranslated: the browser gets a
     * generic error with no {@code dependency}, {@code cause} or {@code stage}, so
     * a cold start is indistinguishable from a bug.
     *
     * <p>Pinned as-is deliberately. The test asserts what the gateway actually does
     * rather than what the unavailability contract asks for, so the gap is visible
     * in the suite instead of being discovered from a support ticket.
     */
    @Test
    void aServerThatNeverAnswersPropagatesReactorsRawTimeout() throws Exception {
        // The accepted peer socket MUST stay strongly reachable. Discarding it (the
        // obvious `silent.accept();`) leaves it unreferenced, so a GC inside the 1 s
        // window finalizes it, resets the connection, and the call fails as a
        // transport error in ~0.1 s instead of timing out. That made this test pass
        // alone and fail in the full suite, where allocation pressure triggers GC.
        List<Socket> held = new ArrayList<>();
        try (ServerSocket silent = loopbackServerSocket()) {
            Thread accepting = new Thread(() -> {
                try {
                    Socket peer = silent.accept();
                    synchronized (held) { held.add(peer); }
                    Thread.sleep(30_000);
                } catch (Exception ignored) { }
            });
            accepting.setDaemon(true);
            accepting.start();

            AIInferenceGatewayService gateway = gatewayPointedAt(silent.getLocalPort());

            assertThatThrownBy(() -> gateway.classifyCategories(Map.of("description", "dive shop")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Timeout on blocking read")
                    .isNotInstanceOf(AiDependencyException.class);
        } finally {
            synchronized (held) {
                for (Socket peer : held) {
                    try { peer.close(); } catch (IOException ignored) { }
                }
            }
        }
    }

    /**
     * rank-markets builds its own WebClient chain rather than going through
     * {@code post(...)}, so unlike every other JSON call it never translates a
     * transport failure.
     *
     * <p><b>This path does NOT produce the unavailability contract.</b> A refused
     * connection surfaces as {@link WebClientRequestException} and lands in the
     * legacy {@code ApiExceptionHandler}, where {@code cause} is discarded — so
     * Module 2 market-ranking outages read differently from every other AI outage
     * in the system.
     *
     * <p>Pinned as-is deliberately: the asymmetry between this call and the rest of
     * the gateway is intentional in the current code, and asserting it keeps the
     * difference explicit rather than incidental.
     */
    @Test
    void rankMarketsForCategoryPropagatesTheRawTransportFailure() throws Exception {
        int closedPort;
        try (ServerSocket probe = loopbackServerSocket()) {
            closedPort = probe.getLocalPort();
        }

        AIInferenceGatewayService gateway = gatewayPointedAt(closedPort);

        assertThatThrownBy(() -> gateway.rankMarketsForCategory("diving"))
                .isInstanceOf(WebClientRequestException.class)
                .isNotInstanceOf(AiDependencyException.class);
    }

    /**
     * Both clients aimed at one port, with 1 s bounds so the tests stay fast.
     *
     * <p>Uses the literal 127.0.0.1 rather than "localhost". On a dual-stack host
     * "localhost" can resolve to ::1 while a {@link ServerSocket} opened below binds
     * IPv4 only — the connection is then refused instantly instead of hanging, and
     * the silent-server test measures a connect failure rather than the read timeout
     * it exists to exercise. That divergence is real: it passes on Linux CI and
     * fails on Windows. Pinning both ends to IPv4 removes it.
     */
    private static AIInferenceGatewayService gatewayPointedAt(int port) {
        WebClient client = WebClient.create("http://127.0.0.1:" + port);
        return new AIInferenceGatewayService(client, client, 1, 1);
    }

    /** Loopback-bound so the address matches what {@link #gatewayPointedAt} dials. */
    private static ServerSocket loopbackServerSocket() throws Exception {
        return new ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"));
    }

    @RestController
    static class ThrowingController {
        @GetMapping("/unreachable")
        String unreachable() {
            throw AiDependencyException.unreachable(
                    "content/generate",
                    new java.net.ConnectException("Connection refused: localhost/127.0.0.1:8000"));
        }

        @GetMapping("/boom")
        String boom() {
            throw AiDependencyException.fromBody(503, Map.of(
                    "code", "MOD31_LLM_UNAVAILABLE",
                    "message", "Caption generation is unavailable.",
                    "dependency", "groq",
                    "cause", "GROQ_API_KEY is not set",
                    "stage", "fastapi-sbert/caption_agent"), "content/generate");
        }
    }
}
