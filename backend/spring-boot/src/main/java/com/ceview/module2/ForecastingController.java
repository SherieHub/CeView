package com.ceview.module2;

import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule22.ForecastingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

/**
 * SDD §2 — Market Radar + Forecasting (Submodule 2.2).
 * Delegates to ForecastingService which runs the Gemini demand forecasting +
 * XGBoost economic scoring pipeline.
 *
 * Error handling: AI failures (Gemini quota, XGBoost missing model, network) are
 * propagated as structured JSON {"code": "...", "message": "..."} so the frontend
 * ApiError class can surface the specific reason in the UI.
 */
@RestController
@RequestMapping("/api/v1/forecasting")
public class ForecastingController {

    private final ForecastingService forecastingService;

    public ForecastingController(ForecastingService forecastingService) {
        this.forecastingService = forecastingService;
    }

    /** Ranked markets for MarketRadarView — pure DB read, no AI calls. */
    @GetMapping("/markets")
    public ResponseEntity<?> markets(@RequestParam(required = false) UUID profileId) {
        try {
            MarketsResponse result = forecastingService.loadMarketsFromDb(profileId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of("code", "MOD22_MARKETS_FAILED", "message", e.getMessage()));
        }
    }

    /** Re-analyze for a specific profile (the "Refresh Forecast" CTA). */
    @PostMapping("/analyze/{profileId}")
    public ResponseEntity<?> analyze(@PathVariable UUID profileId) {
        try {
            MarketsResponse result = forecastingService.forecastForProfile(profileId, true);
            return ResponseEntity.ok(result);
        } catch (ResponseStatusException rse) {
            return structuredError(rse, "MOD22_FORECAST_FAILED");
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of("code", "MOD22_FORECAST_FAILED", "message", e.getMessage()));
        }
    }

    /**
     * Converts a ResponseStatusException from AIInferenceGatewayService into a
     * structured JSON body. The gateway formats its reason as "CODE :: message",
     * which this method splits so the frontend receives separate code and message fields.
     */
    private ResponseEntity<Map<String, String>> structuredError(ResponseStatusException rse,
                                                                 String fallbackCode) {
        String reason = rse.getReason() != null ? rse.getReason() : rse.getMessage();
        String[] parts = reason != null ? reason.split(" :: ", 2) : new String[]{};
        String code    = parts.length == 2 ? parts[0].trim() : fallbackCode;
        String message = parts.length == 2 ? parts[1].trim() : (reason != null ? reason : "AI service unavailable.");
        return ResponseEntity.status(rse.getStatusCode()).body(Map.of("code", code, "message", message));
    }
}
