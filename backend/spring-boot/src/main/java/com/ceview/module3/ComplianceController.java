package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.common.TraceIdFilter;
import com.ceview.module3.dto.ComplianceDtos.ComplianceResultDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeoutException;

/** SDD §3.3 — Multimodal Compliance. Returns { score, aligned[], gaps[], source }. */
@RestController
@RequestMapping("/api/v1/compliance")
public class ComplianceController {

    private static final Logger log = LoggerFactory.getLogger(ComplianceController.class);

    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;

    public ComplianceController(AIInferenceGatewayService ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
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
