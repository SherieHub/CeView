package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.common.TraceIdFilter;
import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.Map;
import java.util.concurrent.TimeoutException;

/**
 * SDD §3.1 — Content Studio. Forwards the request to FastAPI (which calls
 * Gemini or returns a labelled fallback) and deserialises into a typed record.
 * Errors are tagged with a MODULE 3 error code in the MDC before being rethrown
 * to {@link com.ceview.common.ApiExceptionHandler} so the same code lands in
 * both the Spring log line and the JSON error body the frontend reads.
 */
@RestController
@RequestMapping("/api/v1/content")
public class ContentController {

    private static final Logger log = LoggerFactory.getLogger(ContentController.class);

    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;

    public ContentController(AIInferenceGatewayService ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
    }

    public record GenerateRequest(
        String market,
        String businessName,
        String description,
        java.util.List<String> categories,
        String trend
    ) {}

    @PostMapping("/generate")
    public ContentResponseDto generate(@RequestBody GenerateRequest req) {
        log.info("content.generate received market={} business={}",
                req.market(), req.businessName());
        Map<String, Object> raw;
        try {
            raw = ai.generateContent(Map.of(
                "market", req.market() == null ? "korea" : req.market(),
                "businessName", req.businessName() == null ? "" : req.businessName(),
                "description", req.description() == null ? "" : req.description(),
                "categories", req.categories() == null ? java.util.List.of() : req.categories(),
                "trend", req.trend() == null ? "" : req.trend()
            ));
        } catch (WebClientResponseException e) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_CONTENT_GATEWAY_5XX);
            log.warn("content.generate gateway failure status={}", e.getStatusCode().value(), e);
            throw e;
        } catch (RuntimeException e) {
            if (e.getCause() instanceof TimeoutException) {
                MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_CONTENT_GATEWAY_TIMEOUT);
                log.warn("content.generate gateway timeout", e);
            }
            throw e;
        }

        ContentResponseDto dto;
        try {
            dto = mapper.convertValue(raw, ContentResponseDto.class);
        } catch (IllegalArgumentException e) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_CONTENT_DESERIALIZE_FAIL);
            log.warn("content.generate deserialize failed", e);
            throw e;
        }
        log.info("content.generate ok market={} source={}", req.market(), dto.source());
        return dto;
    }
}
