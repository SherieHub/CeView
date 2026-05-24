package com.ceview.module2;

import com.ceview.ai.AIInferenceGatewayService;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * SDD §2 — Market Radar + Forecasting. All shapes returned here mirror the
 * frontend's MOCK_MARKETS / Market / ChartDataPoint types so the React
 * MarketRadarView renders without changes.
 */
@RestController
@RequestMapping("/api/v1/forecasting")
public class ForecastingController {

    private final AIInferenceGatewayService ai;

    public ForecastingController(AIInferenceGatewayService ai) { this.ai = ai; }

    /** Ranked markets for MarketRadarView. */
    @GetMapping("/markets")
    public Map<String, Object> markets(@RequestParam(required = false) UUID profileId) {
        return ai.forecastMarkets(Map.of("profileId", profileId == null ? "" : profileId.toString()));
    }

    /** Re-analyze for a specific profile (the "Analyze Markets" CTA). */
    @PostMapping("/analyze/{profileId}")
    public Map<String, Object> analyze(@PathVariable UUID profileId) {
        return ai.forecastMarkets(Map.of("profileId", profileId.toString(), "refresh", true));
    }
}
