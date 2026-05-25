package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * SDD §3.1 — Content Studio. Returns the same shape ContentStudioView.tsx
 * currently constructs from MOCK: { market, framework, captions:{ instagram,
 * tiktok, facebook, naver } }. FastAPI emits the raw map; we deserialise into
 * a typed record so a Python-side field rename surfaces here as 5xx instead of
 * silently as `undefined` in the React UI.
 */
@RestController
@RequestMapping("/api/v1/content")
public class ContentController {

    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;

    public ContentController(AIInferenceGatewayService ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
    }

    public record GenerateRequest(
        String market,                 // "korea" | "japan" | "usa"
        String businessName,
        String description,
        java.util.List<String> categories,
        String trend
    ) {}

    @PostMapping("/generate")
    public ContentResponseDto generate(@RequestBody GenerateRequest req) {
        Map<String, Object> raw = ai.generateContent(Map.of(
            "market", req.market() == null ? "korea" : req.market(),
            "businessName", req.businessName() == null ? "" : req.businessName(),
            "description", req.description() == null ? "" : req.description(),
            "categories", req.categories() == null ? java.util.List.of() : req.categories(),
            "trend", req.trend() == null ? "" : req.trend()
        ));
        return mapper.convertValue(raw, ContentResponseDto.class);
    }
}
