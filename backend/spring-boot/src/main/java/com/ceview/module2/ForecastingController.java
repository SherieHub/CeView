package com.ceview.module2;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

/**
 * SDD §2 — Market Radar + Forecasting. FastAPI is the source of truth; this
 * controller deserialises its response into typed records so a Python-side
 * field rename surfaces here as a 5xx instead of silently appearing as
 * `undefined` in the React UI.
 */
@RestController
@RequestMapping("/api/v1/forecasting")
public class ForecastingController {

    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;

    public ForecastingController(AIInferenceGatewayService ai, ObjectMapper mapper) {
        this.ai = ai;
        this.mapper = mapper;
    }

    /** Ranked markets for MarketRadarView. */
    @GetMapping("/markets")
    public MarketsResponse markets(@RequestParam(required = false) UUID profileId) {
        Map<String, Object> raw = ai.forecastMarkets(
            Map.of("profileId", profileId == null ? "" : profileId.toString()));
        return mapper.convertValue(raw, MarketsResponse.class);
    }

    /** Re-analyze for a specific profile (the "Refresh forecast" CTA). */
    @PostMapping("/analyze/{profileId}")
    public MarketsResponse analyze(@PathVariable UUID profileId) {
        Map<String, Object> raw = ai.forecastMarkets(
            Map.of("profileId", profileId.toString(), "refresh", true));
        return mapper.convertValue(raw, MarketsResponse.class);
    }
}
