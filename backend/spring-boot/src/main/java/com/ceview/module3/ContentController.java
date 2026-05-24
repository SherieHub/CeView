package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * SDD §3.1 — Content Studio. Returns the same shape ContentStudioView.tsx
 * currently constructs from MOCK: { market, framework, captions:{ instagram,
 * tiktok, facebook, naver }, compliance }.
 */
@RestController
@RequestMapping("/api/v1/content")
public class ContentController {

    private final AIInferenceGatewayService ai;

    public ContentController(AIInferenceGatewayService ai) { this.ai = ai; }

    public record GenerateRequest(
        String market,                 // "korea" | "japan" | "usa"
        String businessName,
        String description,
        java.util.List<String> categories,
        String trend
    ) {}

    @PostMapping("/generate")
    public Map<String, Object> generate(@RequestBody GenerateRequest req) {
        return ai.generateContent(Map.of(
            "market", req.market() == null ? "korea" : req.market(),
            "businessName", req.businessName() == null ? "" : req.businessName(),
            "description", req.description() == null ? "" : req.description(),
            "categories", req.categories() == null ? java.util.List.of() : req.categories(),
            "trend", req.trend() == null ? "" : req.trend()
        ));
    }
}
