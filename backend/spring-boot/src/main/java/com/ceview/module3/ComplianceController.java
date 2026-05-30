package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.common.TraceIdFilter;
import com.ceview.module3.dto.ComplianceDtos.OmcsAuditRequest;
import com.ceview.module3.dto.ComplianceDtos.OmcsAuditResultDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;

/**
 * SDD §3.3 — Multimodal Compliance Audit (OMCS).
 *
 * Thin stateless passthrough to the FastAPI LangGraph omcs_agent. The operator's
 * chosen caption + image are evaluated against the visual-guide recommendations
 * (the approved caption's generative metadata). Returns the full omcs_agent
 * evaluation state, including a Pass/Fail status and a feedback diagnostic when
 * the asset fails. No results are persisted.
 */
@RestController
@RequestMapping("/api/v1/compliance")
public class ComplianceController {

    private static final Logger log = LoggerFactory.getLogger(ComplianceController.class);

    private final AIInferenceGatewayService ai;

    public ComplianceController(AIInferenceGatewayService ai) {
        this.ai = ai;
    }

    /**
     * Submodule 3.3 — OMCS compliance audit via the LangGraph omcs_agent.
     *
     * OMCS = (0.35 × profile_semantic_score) + (0.45 × recommendations_picture_score)
     *      + (0.20 × pubmat_consistency_score). Status is Pass/Fail at threshold 70.
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
}
