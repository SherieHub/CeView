package com.ceview.ai;

import com.ceview.common.TraceIdFilter;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Single bridge between Spring Boot orchestrator and the two FastAPI AI microservices.
 *
 *  - {@code sbertClient}       → fastapi-sbert (port 8000) — Modules 1, 3, 4
 *  - {@code transformerClient} → fastapi-transformer (port 8001) — Module 2
 *
 * One method per AI capability the SDD calls out.  All calls share a uniform
 * timeout; callers wrap with their own fallback logic per SDD §3.
 */
@Service
public class AIInferenceGatewayService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final WebClient sbertClient;
    private final WebClient transformerClient;
    private final Duration timeout;

    public AIInferenceGatewayService(
            @Qualifier("fastapiSbertClient") WebClient sbertClient,
            @Qualifier("fastapiTransformerClient") WebClient transformerClient,
            @Value("${ceview.fastapi.timeout-seconds}") long timeoutSec) {
        this.sbertClient       = sbertClient;
        this.transformerClient = transformerClient;
        this.timeout           = Duration.ofSeconds(timeoutSec);
    }

    // ─── Module 1 — SBERT classification (fastapi-sbert) ─────────────────────

    public Map<String, Object> classifyCategories(Map<String, Object> payload) {
        return postSbert("/internal/classification/analyze", payload);
    }

    public Map<String, Object> computeUniqueness(Map<String, Object> payload) {
        return postSbert("/internal/classification/uniqueness", payload);
    }

    public List<String> generateKeywords(Map<String, Object> payload) {
        var resp = postSbert("/internal/classification/keywords", payload);
        @SuppressWarnings("unchecked")
        List<String> kws = (List<String>) resp.getOrDefault("keywords", List.of());
        return kws;
    }

    // ─── Module 2.1 — Market data ingestion (fastapi-transformer) ────────────

    /** Fetch Google Trends index via FastAPI PyTrends wrapper (FR2.2). */
    public Map<String, Object> fetchTrends(Map<String, Object> payload) {
        return postTransformer("/internal/market-data/trends", payload);
    }

    /** Compute FFT-based seasonality score via FastAPI scipy (FR2.7). */
    public Map<String, Object> computeSeasonality(Map<String, Object> payload) {
        return postTransformer("/internal/market-data/seasonality", payload);
    }

    // ─── Module 2.2 — Gemini demand forecasting + XGBoost economic scoring ───

    /** Run Gemini-powered demand forecasting — 4w + 12w predictions (FR2.11). */
    public Map<String, Object> runForecastInference(Map<String, Object> payload) {
        return postTransformer("/internal/forecasting/inference", payload);
    }

    /** Run XGBoost market scoring model (FR2.13). */
    public Map<String, Object> runMarketScoring(Map<String, Object> payload) {
        return postTransformer("/internal/forecasting/score", payload);
    }

    /**
     * Legacy stub fallback — called when no enriched data exists for a profile.
     * Routes to the transformer's /analyze stub which returns MOCK_MARKETS-shaped data.
     */
    public Map<String, Object> forecastMarkets(Map<String, Object> payload) {
        return postTransformer("/internal/forecasting/analyze", payload);
    }

    /**
     * Legacy stub fallback — called when no demand alerts exist for a profile.
     * Routes to the transformer's /notifications stub.
     */
    public Map<String, Object> listNotifications() {
        return postTransformer("/internal/forecasting/notifications", Map.of());
    }

    // ─── Module 3 — Content / Creative / Compliance (fastapi-sbert) ──────────

    public Map<String, Object> generateContent(Map<String, Object> payload) {
        return postSbert("/internal/content/generate", payload);
    }

    public Map<String, Object> generateCreative(Map<String, Object> payload) {
        return postSbert("/internal/creative/generate", payload);
    }

    public Map<String, Object> evaluateCompliance(Map<String, Object> payload) {
        return postSbert("/internal/compliance/evaluate", payload);
    }

    /** Full multimodal compliance analysis (FR3.20-FR3.26). */
    public Map<String, Object> evaluateComplianceFull(Map<String, Object> payload) {
        return postSbert("/internal/compliance/evaluate-full", payload);
    }

    // ─── Module 4 — Analytics report (fastapi-sbert) ─────────────────────────

    public Map<String, Object> generateReport(Map<String, Object> payload) {
        return postSbert("/internal/report/generate", payload);
    }

    public byte[] generateReportPdf(Map<String, Object> payload) {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        return sbertClient.post().uri("/internal/report/pdf")
                .headers(h -> { if (traceId != null) h.set(TraceIdFilter.HEADER, traceId); })
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(byte[].class)
                .block(timeout);
    }

    // ─── private helpers ──────────────────────────────────────────────────────

    private Map<String, Object> postSbert(String path, Map<String, Object> payload) {
        return post(sbertClient, path, payload);
    }

    private Map<String, Object> postTransformer(String path, Map<String, Object> payload) {
        return post(transformerClient, path, payload);
    }

    private Map<String, Object> post(WebClient client, String path, Map<String, Object> payload) {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        return client.post().uri(path)
                .headers(h -> { if (traceId != null) h.set(TraceIdFilter.HEADER, traceId); })
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(MAP_TYPE)
                .block(timeout);
    }
}
