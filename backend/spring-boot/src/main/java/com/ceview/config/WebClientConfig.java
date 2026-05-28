package com.ceview.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

/**
 * Produces three named WebClient beans:
 *
 *  - {@code fastapiSbertClient}       → fastapi-sbert (port 8000)
 *                                       Modules 1, 3, 4 — SBERT / Groq endpoints
 *
 *  - {@code fastapiTransformerClient} → fastapi-transformer (port 8001)
 *                                       Module 2 — Gemini demand forecasting, XGBoost economic
 *                                       viability scoring, PyTrends, Seasonal Shift Detection
 *
 *  - {@code fastapiComplianceClient}  → fastapi-compliance (port 8002)
 *                                       Module 3.3 — Groq OMCS evaluator
 */
@Configuration
public class WebClientConfig {

    @Value("${ceview.fastapi.sbert.base-url}")
    private String sbertBaseUrl;

    @Value("${ceview.fastapi.transformer.base-url}")
    private String transformerBaseUrl;

    @Value("${ceview.fastapi.compliance.base-url}")
    private String complianceBaseUrl;

    /** WebClient for fastapi-sbert — Modules 1, 3, 4. */
    @Bean(name = "fastapiSbertClient")
    public WebClient fastapiSbertClient() {
        return WebClient.builder()
                .baseUrl(sbertBaseUrl)
                .build();
    }

    /**
     * Legacy alias so any existing {@code @Qualifier("fastapiClient")} injection
     * continues to resolve to the SBERT service without code changes.
     */
    @Bean(name = "fastapiClient")
    public WebClient fastapiClient() {
        return fastapiSbertClient();
    }

    /** WebClient for fastapi-transformer — Module 2. */
    @Bean(name = "fastapiTransformerClient")
    public WebClient fastapiTransformerClient() {
        return WebClient.builder()
                .baseUrl(transformerBaseUrl)
                .build();
    }

    /** WebClient for fastapi-compliance — Module 3.3 Groq OMCS. */
    @Bean(name = "fastapiComplianceClient")
    public WebClient fastapiComplianceClient() {
        return WebClient.builder()
                .baseUrl(complianceBaseUrl)
                .build();
    }
}
