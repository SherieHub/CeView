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
 * Single bridge between Spring Boot orchestrator and FastAPI AI microservice.
 * One method per AI capability the SDD calls out. All calls have a uniform
 * timeout; callers wrap with their own fallback services per SDD §3.
 */
@Service
public class AIInferenceGatewayService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final WebClient client;
    private final Duration timeout;

    public AIInferenceGatewayService(
            @Qualifier("fastapiClient") WebClient client,
            @Value("${ceview.fastapi.timeout-seconds}") long timeoutSec) {
        this.client = client;
        this.timeout = Duration.ofSeconds(timeoutSec);
    }

    public Map<String, Object> classifyCategories(Map<String, Object> payload) {
        return post("/internal/classification/analyze", payload);
    }

    public Map<String, Object> computeUniqueness(Map<String, Object> payload) {
        return post("/internal/classification/uniqueness", payload);
    }

    public List<String> generateKeywords(Map<String, Object> payload) {
        var resp = post("/internal/classification/keywords", payload);
        @SuppressWarnings("unchecked")
        List<String> kws = (List<String>) resp.getOrDefault("keywords", List.of());
        return kws;
    }

    public Map<String, Object> forecastMarkets(Map<String, Object> payload) {
        return post("/internal/forecasting/analyze", payload);
    }

    public Map<String, Object> listNotifications() {
        return post("/internal/forecasting/notifications", Map.of());
    }

    /** 2.1 — Fetch Google Trends index via FastAPI PyTrends wrapper (FR2.2). */
    public Map<String, Object> fetchTrends(Map<String, Object> payload) {
        return post("/internal/market-data/trends", payload);
    }

    /** 2.1 — Compute FFT-based seasonality score via FastAPI scipy (FR2.7). */
    public Map<String, Object> computeSeasonality(Map<String, Object> payload) {
        return post("/internal/market-data/seasonality", payload);
    }

    /** 2.2 — Run BiLSTM+Transformer demand forecast inference (FR2.11). */
    public Map<String, Object> runForecastInference(Map<String, Object> payload) {
        return post("/internal/forecasting/inference", payload);
    }

    /** 2.2 — Run XGBoost market scoring model (FR2.13). */
    public Map<String, Object> runMarketScoring(Map<String, Object> payload) {
        return post("/internal/forecasting/score", payload);
    }

    public Map<String, Object> generateContent(Map<String, Object> payload) {
        return post("/internal/content/generate", payload);
    }

    public Map<String, Object> generateCreative(Map<String, Object> payload) {
        return post("/internal/creative/generate", payload);
    }

    public Map<String, Object> evaluateCompliance(Map<String, Object> payload) {
        return post("/internal/compliance/evaluate", payload);
    }

    /** 3.3 — Full multimodal compliance analysis (FR3.20-FR3.26). */
    public Map<String, Object> evaluateComplianceFull(Map<String, Object> payload) {
        return post("/internal/compliance/evaluate-full", payload);
    }

    public Map<String, Object> generateReport(Map<String, Object> payload) {
        return post("/internal/report/generate", payload);
    }

    public byte[] generateReportPdf(Map<String, Object> payload) {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        return client.post().uri("/internal/report/pdf")
                .headers(h -> { if (traceId != null) h.set(TraceIdFilter.HEADER, traceId); })
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(byte[].class)
                .block(timeout);
    }

    private Map<String, Object> post(String path, Map<String, Object> payload) {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        return client.post().uri(path)
                .headers(h -> { if (traceId != null) h.set(TraceIdFilter.HEADER, traceId); })
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(MAP_TYPE)
                .block(timeout);
    }
}
