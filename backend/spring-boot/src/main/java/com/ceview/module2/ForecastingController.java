package com.ceview.module2;

import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule22.ForecastingService;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/**
 * SDD §2 — Market Radar + Forecasting (Submodule 2.2).
 * Delegates to ForecastingService which runs the Gemini demand forecasting +
 * XGBoost economic scoring pipeline, or falls back to the FastAPI stub.
 */
@RestController
@RequestMapping("/api/v1/forecasting")
public class ForecastingController {

    private final ForecastingService forecastingService;

    public ForecastingController(ForecastingService forecastingService) {
        this.forecastingService = forecastingService;
    }

    /** Ranked markets for MarketRadarView. */
    @GetMapping("/markets")
    public MarketsResponse markets(@RequestParam(required = false) UUID profileId) {
        if (profileId == null) {
            return forecastingService.forecastForProfile(null, false);
        }
        return forecastingService.forecastForProfile(profileId, false);
    }

    /** Re-analyze for a specific profile (the "Refresh Forecast" CTA). */
    @PostMapping("/analyze/{profileId}")
    public MarketsResponse analyze(@PathVariable UUID profileId) {
        return forecastingService.forecastForProfile(profileId, true);
    }
}
