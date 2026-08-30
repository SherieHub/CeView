package com.ceview.ai;

import com.ceview.common.TraceIdFilter;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;

import java.time.Duration;
import java.util.HashMap;
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

    /** Reader for FastAPI *error* bodies, which arrive as a raw String (any Content-Type). */
    private static final ObjectMapper ERROR_BODY_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> ERROR_MAP_TYPE =
            new TypeReference<>() {};

    private final WebClient sbertClient;
    private final WebClient transformerClient;
    private final Duration timeout;
    /** Extended timeout for rank-markets: PyTrends needs up to 75 s (6 batches × 4–12 s jitter). */
    private final Duration rankMarketsTimeout;

    public AIInferenceGatewayService(
            @Qualifier("fastapiSbertClient") WebClient sbertClient,
            @Qualifier("fastapiTransformerClient") WebClient transformerClient,
            @Value("${ceview.fastapi.timeout-seconds}") long timeoutSec,
            @Value("${ceview.fastapi.rank-markets-timeout-seconds:90}") long rankMarketsTimeoutSec) {
        this.sbertClient          = sbertClient;
        this.transformerClient    = transformerClient;
        this.timeout              = Duration.ofSeconds(timeoutSec);
        this.rankMarketsTimeout   = Duration.ofSeconds(rankMarketsTimeoutSec);
    }

    // ─── Module 1 — SBERT classification (fastapi-sbert) ─────────────────────

    public Map<String, Object> classifyCategories(Map<String, Object> payload) {
        return postSbert("/internal/classification/analyze", payload);
    }

    public Map<String, Object> computeUniqueness(Map<String, Object> payload) {
        return postSbert("/internal/classification/uniqueness", payload);
    }

    /**
     * Generate and persist the 768-dim E5 embedding for a saved business profile.
     *
     * <p>Called by {@link com.ceview.module1.businessinput.BusinessProfileController}
     * after each profile save so the uniqueness corpus stays current.  Failures are
     * non-fatal — the corpus will be stale until the next save succeeds.
     */
    public Map<String, Object> embedBusinessProfile(Map<String, Object> payload) {
        return postSbert("/internal/classification/embed", payload);
    }

    /**
     * Aggregate 10-keyword volumes across KR/JP/US and rank markets for one category (FR2.2).
     *
     * <p>Uses {@link #rankMarketsTimeout} (default 90 s) instead of the shared timeout
     * because PyTrends fetches 6 keyword batches with a 4–12 s jitter sleep each,
     * totalling up to ~75 s when live.  The shared 30 s timeout would kill the request
     * before PyTrends responds, causing a silent fallback to stub data.
     */
    public Map<String, Object> rankMarketsForCategory(String category) {
        var payload = new HashMap<String, Object>();
        payload.put("category", category);
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        return transformerClient.post().uri("/api/trends/rank-markets")
                .headers(h -> { if (traceId != null) h.set(TraceIdFilter.HEADER, traceId); })
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(MAP_TYPE)
                .block(rankMarketsTimeout);
    }

    // ─── Module 2.1 — Market data ingestion (fastapi-transformer) ────────────

    /** Fetch Google Trends index via FastAPI PyTrends wrapper (FR2.2). */
    public Map<String, Object> fetchTrends(Map<String, Object> payload) {
        return postTransformer("/internal/market-data/trends", payload);
    }

    /** Fetch N weeks of weekly trend history — used on first ingestion to backfill signal records (FR2.2). */
    public Map<String, Object> fetchTrendHistory(Map<String, Object> payload) {
        return postTransformer("/internal/market-data/trends/history", payload);
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

    /**
     * Batch Gemini demand forecast — all markets in a single API call (FR2.11).
     *
     * <p>Sends all market sequences together so Gemini returns one JSON response
     * with forecasts for every market, consuming only 1 RPM quota slot instead of N.
     *
     * @param sequences list of per-market payload maps (same shape as runForecastInference)
     * @return Map keyed by market name (e.g. "korea"), each value is the ForecastResponse fields
     */
    @SuppressWarnings("unchecked")
    public Map<String, Map<String, Object>> runForecastInferenceBatch(
            List<Map<String, Object>> sequences) {

        Map<String, Object> body = new HashMap<>();
        body.put("markets", sequences);

        Map<String, Object> response = postTransformer("/internal/forecasting/inference-batch", body);

        if (response == null || !response.containsKey("results")) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "MOD22_FORECAST_FAILED :: Batch inference returned empty response");
        }
        return (Map<String, Map<String, Object>>) response.get("results");
    }

    /** Run XGBoost market scoring model (FR2.13). */
    public Map<String, Object> runMarketScoring(Map<String, Object> payload) {
        return postTransformer("/internal/forecasting/score", payload);
    }

    // ─── Module 3 — Content / Creative / Compliance (fastapi-sbert) ──────────

    public Map<String, Object> generateContent(Map<String, Object> payload) {
        return postSbert("/internal/content/generate", payload);
    }

    /** Generate captions via the LangGraph agent with full business context (FR3.5/FR3.6). */
    public Map<String, Object> generateCaption(Map<String, Object> payload) {
        return postSbert("/internal/generation/caption", payload);
    }

    public Map<String, Object> generateCreative(Map<String, Object> payload) {
        return postSbert("/internal/creative/generate", payload);
    }

    /**
     * OMCS compliance audit via the LangGraph omcs_agent (Submodule 3.3).
     *
     * <p>Payload shape (mirrors ComplianceInputClass on the FastAPI side):
     * <pre>
     * {
     *   "caption":          string,
     *   "image_url":        string (http(s):// or data: base64),
     *   "business_profile": { ... },
     *   "recommendations":  { core_business_context, market_cultural_localization, ... }
     * }
     * </pre>
     *
     * <p>Returns the full omcs_agent state: profile_semantic_score, rubric_evaluation_data,
     * recommendations_picture_score, consistency_explanation, pubmat_consistency_score,
     * omcs_score, status, feedback (plus the echoed inputs).
     */
    public Map<String, Object> analyzeOmcsAgent(Map<String, Object> payload) {
        return postSbert("/internal/omcs/analyze", payload);
    }

    // ─── Module 4 — Analytics report + PES deep-analysis (fastapi-sbert) ───────

    public Map<String, Object> generateReport(Map<String, Object> payload) {
        return postSbert("/internal/report/generate", payload);
    }

    /**
     * UC-4.2 / UC-4.3 — Raw campaign data PES computation + AI prescriptive insights.
     *
     * <p>Delegates to FastAPI {@code /internal/pes-compute/analyze} which:
     * <ol>
     *   <li>Computes CTR, CPC, CR, ROAS, CAC from raw inputs.</li>
     *   <li>Applies Min-Max normalization and inverts cost metrics.</li>
     *   <li>Applies the PES weighted-sum formula with edge-case weight recalibration.</li>
     *   <li>Calls DeepSeek/Gemini to identify the weakest funnel stage and generate
     *       3 ranked optimisation recommendations + an executive summary.</li>
     * </ol>
     *
     * <p>Payload shape:
     * <pre>
     * {
     *   "impressions":  int,
     *   "clicks":       int,
     *   "adSpend":      double,
     *   "revenue":      double,
     *   "conversions":  int,
     *   "bookings":     int,
     *   "newCustomers": int
     * }
     * </pre>
     *
     * <p>Response shape (from FastAPI):
     * <pre>
     * {
     *   "base_metrics":       { CTR, CPC, CR, ROAS, CAC },
     *   "normalized_metrics": { ... },
     *   "pes_score":          double,
     *   "pes_label":          string,
     *   "breakdown":          [ { metric, weight, contribution } ],
     *   "flagged_metrics":    [ string ],
     *   "effective_weights":  { ... },
     *   "ai_report":          { weakest_funnel_stage, recommendations[], executive_summary, source }
     * }
     * </pre>
     *
     * @see com.ceview.module4.engagement.EngagementMetricsController#manualIngest
     */
    public Map<String, Object> computePesFromRaw(Map<String, Object> payload) {
        return postSbert("/internal/pes-compute/analyze", payload);
    }

    /**
     * PES time-series deep-analysis via pes_report_agent (LangGraph + Gemini).
     *
     * <p>Payload shape:
     * <pre>
     * {
     *   "metrics_data": { "CTR": [current,...,baseline], "CPC": [...], ... },
     *   "weeks": 4 | 8
     * }
     * </pre>
     *
     * @see com.ceview.module4.report.PrescriptiveReportController#pesAnalysis
     */
    public Map<String, Object> generatePesAnalysis(Map<String, Object> payload) {
        return postSbert("/internal/pes-analysis/generate", payload);
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
        try {
            return doPost(client, path, payload);
        } catch (WebClientRequestException noResponse) {
            // Connection refused / DNS / socket reset — FastAPI never answered, so there
            // is no body to pass through. Translated here rather than in the shared
            // ApiExceptionHandler because only this class knows the dependency is
            // "fastapi"; ExternalMarketDataClient raises the same exception type for
            // World Bank and forex, which must not be mislabelled as an AI outage.
            throw AiDependencyException.unreachable(springPath(path), noResponse);
        }
    }

    private Map<String, Object> doPost(WebClient client, String path, Map<String, Object> payload) {
        String traceId = MDC.get(TraceIdFilter.MDC_KEY);
        return client.post().uri(path)
                .headers(h -> { if (traceId != null) h.set(TraceIdFilter.HEADER, traceId); })
                .bodyValue(payload)
                .retrieve()
                .onStatus(
                    status -> status.is4xxClientError() || status.is5xxServerError(),
                    // Read as String so any Content-Type (text/plain or application/json) is accepted.
                    // The upstream FastAPI may return text/plain on unhandled RuntimeErrors; reading
                    // as MAP_TYPE would throw UnsupportedMediaTypeException in that case.
                    response -> response.bodyToMono(String.class)
                        .defaultIfEmpty("")
                        .map(rawBody -> (Throwable) AiDependencyException.fromBody(
                                response.statusCode().value(),
                                parseErrorBody(rawBody),
                                springPath(path)))
                )
                .bodyToMono(MAP_TYPE)
                .block(timeout);
    }

    /**
     * Parses a FastAPI error body into a Map. A non-JSON body — an HTML proxy page,
     * an empty 502 — yields an empty map, never null, so
     * {@link AiDependencyException#fromBody} falls to its transport-failure branch
     * instead of masking the real status.
     */
    static Map<String, Object> parseErrorBody(String rawBody) {
        if (rawBody == null || rawBody.isBlank()) return Map.of();
        try {
            Map<String, Object> parsed = ERROR_BODY_MAPPER.readValue(rawBody, ERROR_MAP_TYPE);
            return parsed == null ? Map.of() : parsed;
        } catch (Exception notJson) {
            return Map.of();
        }
    }

    /** "/internal/content/generate" -> "content/generate", for the stage chain. */
    private static String springPath(String path) {
        String p = path.startsWith("/internal/") ? path.substring("/internal/".length()) : path;
        return p.startsWith("/") ? p.substring(1) : p;
    }
}
