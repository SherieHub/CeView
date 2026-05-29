package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.common.TraceIdFilter;
import com.ceview.module3.dto.ComplianceDtos.ComplianceResultDto;
import com.ceview.module3.dto.ComplianceDtos.OmcsAuditRequest;
import com.ceview.module3.dto.ComplianceDtos.OmcsAuditResultDto;
import com.ceview.module3.submodule33.ComplianceAnalysisService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

/** SDD §3.3 — Multimodal Compliance. Returns { score, aligned[], gaps[], source }. */
@RestController
@RequestMapping("/api/v1/compliance")
public class ComplianceController {

    private static final Logger log = LoggerFactory.getLogger(ComplianceController.class);

    private final AIInferenceGatewayService ai;
    private final ComplianceAnalysisService analysisService;
    private final ObjectMapper mapper;

    public ComplianceController(AIInferenceGatewayService ai,
                                ComplianceAnalysisService analysisService,
                                ObjectMapper mapper) {
        this.ai              = ai;
        this.analysisService = analysisService;
        this.mapper          = mapper;
    }

    @PostMapping(value = "/evaluate", consumes = {"multipart/form-data", "application/json"})
    public ComplianceResultDto evaluate(
            @RequestPart(value = "caption", required = false) String caption,
            @RequestPart(value = "market", required = false) String market,
            @RequestPart(value = "media", required = false) MultipartFile media) {
        var payload = new HashMap<String, Object>();
        payload.put("caption", caption);
        payload.put("market", market);
        payload.put("mediaName", media == null ? null : media.getOriginalFilename());
        payload.put("mediaSize", media == null ? 0 : media.getSize());
        return invoke(payload);
    }

    /** JSON-only variant used by the React studio (no file upload). */
    @PostMapping(value = "/evaluate-json", consumes = "application/json")
    public ComplianceResultDto evaluateJson(@RequestBody Map<String, Object> body) {
        return invoke(body == null ? Map.of() : body);
    }

    /**
     * Full multimodal pipeline (FR3.20-FR3.30, UC-3.3).
     *
     * Accepts an optional profileId to inject approved captions (3.1) and
     * creative direction context (3.2) automatically (FR3.21). Falls back to
     * basic /evaluate path when no enriched context is available (FR3.30).
     * Persists ComplianceEvaluationResult + revision history when profileId provided (FR3.29).
     */
    @PostMapping(value = "/evaluate-full", consumes = {"multipart/form-data", "application/json"})
    public ComplianceResultDto evaluateFull(
            @RequestParam(required = false) UUID profileId,
            @RequestPart(value = "caption", required = false) String caption,
            @RequestPart(value = "market", required = false) String market,
            @RequestPart(value = "media", required = false) MultipartFile media) {

        String resolvedMarket = (market != null && !market.isBlank()) ? market : "korea";

        if (caption == null || caption.isBlank()) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.evaluate-full rejected — empty caption");
            throw new IllegalArgumentException("caption is required");
        }

        String mediaName = media == null ? null : media.getOriginalFilename();
        Long mediaSize   = media == null ? null : media.getSize();

        log.info("compliance.evaluate-full profile={} market={} caption_len={} media={}",
                profileId, resolvedMarket, caption.length(), mediaName);

        return analysisService.analyze(profileId, caption, resolvedMarket, mediaName, mediaSize);
    }

    /** JSON-only variant of /evaluate-full (no file upload — React compliance studio). */
    @PostMapping(value = "/evaluate-full-json", consumes = "application/json")
    public ComplianceResultDto evaluateFullJson(
            @RequestParam(required = false) UUID profileId,
            @RequestBody Map<String, Object> body) {

        body = body == null ? Map.of() : body;
        String caption = ((String) body.getOrDefault("caption", "")).strip();
        String market  = ((String) body.getOrDefault("market", "korea")).strip();
        String mediaName = (String) body.get("mediaName");
        Object rawSize = body.get("mediaSize");
        Long mediaSize = rawSize instanceof Number n ? n.longValue() : null;

        if (market.isBlank()) market = "korea";

        if (caption.isBlank()) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.evaluate-full-json rejected — empty caption");
            throw new IllegalArgumentException("caption is required");
        }

        log.info("compliance.evaluate-full-json profile={} market={} caption_len={}",
                profileId, market, caption.length());

        return analysisService.analyze(profileId, caption, market, mediaName, mediaSize);
    }

    /**
     * Submodule 3.3 — OMCS compliance audit via the LangGraph omcs_agent.
     *
     * Replaces the CAS/VAS/HCS audit for the React studio: the operator's chosen
     * caption + image are evaluated against the Submodule 3.2 visual-guide
     * recommendations. Returns the full omcs_agent evaluation state, including a
     * Pass/Fail status and a feedback diagnostic when the asset fails.
     */
    @PostMapping(value = "/omcs-analyze", consumes = "application/json")
    public OmcsAuditResultDto omcsAnalyze(@RequestBody OmcsAuditRequest body) {
        String caption  = body == null || body.caption() == null ? "" : body.caption().strip();
        String imageUrl = body == null || body.imageUrl() == null ? "" : body.imageUrl().strip();

        if (caption.isBlank()) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.omcs-analyze rejected — empty caption");
            throw new IllegalArgumentException("caption is required");
        }
        if (imageUrl.isBlank()) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.omcs-analyze rejected — empty image_url");
            throw new IllegalArgumentException("image_url is required");
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("caption", caption);
        payload.put("image_url", imageUrl);
        payload.put("business_profile", body.businessProfile() != null ? body.businessProfile() : Map.of());
        payload.put("recommendations", body.recommendations() != null ? body.recommendations() : Map.of());

        log.info("compliance.omcs-analyze caption_len={} image_url_len={} recommendations_keys={}",
                caption.length(), imageUrl.length(),
                body.recommendations() == null ? 0 : body.recommendations().size());

        Map<String, Object> raw;
        try {
            raw = ai.analyzeOmcsAgent(payload);
        } catch (WebClientResponseException e) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD33_OMCS_AGENT_FAILED);
            log.warn("compliance.omcs-analyze gateway failure status={}", e.getStatusCode().value(), e);
            throw e;
        } catch (RuntimeException e) {
            if (e.getCause() instanceof TimeoutException) {
                MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_GATEWAY_TIMEOUT);
                log.warn("compliance.omcs-analyze gateway timeout", e);
            } else {
                MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD33_OMCS_AGENT_FAILED);
                log.warn("compliance.omcs-analyze gateway error: {}", e.getMessage());
            }
            throw e;
        }

        OmcsAuditResultDto dto = mapOmcsAgentResponse(raw);
        log.info("compliance.omcs-analyze ok omcs={} status={}", dto.omcsScore(), dto.status());
        return dto;
    }

    @SuppressWarnings("unchecked")
    private OmcsAuditResultDto mapOmcsAgentResponse(Map<String, Object> raw) {
        Object rubric = raw.get("rubric_evaluation_data");
        return new OmcsAuditResultDto(
                toDouble(raw.get("profile_semantic_score")),
                rubric instanceof Map ? (Map<String, Object>) rubric : Map.of(),
                toDouble(raw.get("recommendations_picture_score")),
                raw.get("consistency_explanation") == null ? "" : raw.get("consistency_explanation").toString(),
                toDouble(raw.get("pubmat_consistency_score")),
                toDouble(raw.get("omcs_score")),
                raw.get("status") == null ? "" : raw.get("status").toString(),
                raw.get("feedback") == null ? "" : raw.get("feedback").toString()
        );
    }

    private static double toDouble(Object val) {
        return val instanceof Number n ? n.doubleValue() : 0.0;
    }

    private ComplianceResultDto invoke(Map<String, Object> payload) {
        String caption = (String) payload.getOrDefault("caption", "");
        String market = (String) payload.getOrDefault("market", "");
        log.info("compliance.evaluate received market={} caption_len={}",
                market, caption == null ? 0 : caption.length());

        if (caption == null || caption.isBlank()) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.evaluate rejected — empty caption");
            throw new IllegalArgumentException("caption is required");
        }

        Map<String, Object> raw;
        try {
            raw = ai.evaluateCompliance(payload);
        } catch (WebClientResponseException e) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_GATEWAY_5XX);
            log.warn("compliance.evaluate gateway failure status={}", e.getStatusCode().value(), e);
            throw e;
        } catch (RuntimeException e) {
            if (e.getCause() instanceof TimeoutException) {
                MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_GATEWAY_TIMEOUT);
                log.warn("compliance.evaluate gateway timeout", e);
            }
            throw e;
        }

        ComplianceResultDto dto = mapper.convertValue(raw, ComplianceResultDto.class);
        log.info("compliance.evaluate ok market={} score={} source={}",
                market, dto.score(), dto.source());
        return dto;
    }
}
