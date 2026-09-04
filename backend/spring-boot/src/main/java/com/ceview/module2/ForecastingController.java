package com.ceview.module2;

import com.ceview.ai.AiDependencyException;
import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule22.ForecastingService;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
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
 *
 * Ownership: every profileId here — query param or path variable — is derived from
 * or validated against {@link CurrentBusinessProfile}, which resolves the caller's
 * own profile from the JWT. This closes the spoofing hole where a client could pass
 * an arbitrary profileId to read/trigger forecasts for another operator's business.
 */
@RestController
@RequestMapping("/api/forecasting")
public class ForecastingController {

    private final ForecastingService forecastingService;
    private final CurrentBusinessProfile currentBusinessProfile;
    private final WebClient transformerClient;

    public ForecastingController(ForecastingService forecastingService,
                                  CurrentBusinessProfile currentBusinessProfile,
                                  @Qualifier("fastapiTransformerClient") WebClient transformerClient) {
        this.forecastingService = forecastingService;
        this.currentBusinessProfile = currentBusinessProfile;
        this.transformerClient = transformerClient;
    }

    /**
     * Drives the dashboard's "AI Forecast Service Unavailable" banner.
     *
     * <p>Deliberately NOT tenant-scoped: whether fastapi-transformer is reachable is
     * the same answer for every operator, and must stay answerable before a business
     * profile even exists. Reuses the {@code fastapiTransformerClient} bean (see
     * {@link com.ceview.config.WebClientConfig}) instead of building a second client.
     *
     * <p>Always returns 200 — a down AI service is an expected operating state, not
     * a server error. {@code available:false} lets the dashboard degrade gracefully
     * instead of rendering the generic failure panel (or, worse, having this call's
     * rejection sink the whole {@code Promise.all} it's loaded alongside).
     */
    @GetMapping("/status")
    public Map<String, Object> status() {
        try {
            transformerClient.get().uri("/healthz")
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(Duration.ofSeconds(3));
            return Map.of("available", true);
        } catch (Exception e) {
            return Map.of("available", false, "reason", e.getClass().getSimpleName());
        }
    }

    /**
     * Ranked markets for MarketRadarView — pure DB read, no AI calls.
     *
     * <p>{@code category}, when present, pins the per-market selection to that one
     * category (see {@link ForecastingService#loadMarketsFromDb(UUID, String)})
     * instead of each market's best-ranked category. The profile is still resolved
     * via {@link CurrentBusinessProfile#resolveOrValidate}, so the category param
     * can only ever filter within the caller's own profile — it cannot widen access
     * to another operator's data.
     */
    @GetMapping("/markets")
    public ResponseEntity<?> markets(@RequestParam(required = false) UUID profileId,
                                      @RequestParam(required = false) String category) {
        // Resolved/validated outside the try block so a 401/403/409 from ownership
        // checks reaches ApiExceptionHandler's standard shape rather than being
        // swallowed by the generic catch below and reported as a 503 markets failure.
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        try {
            MarketsResponse result = forecastingService.loadMarketsFromDb(resolvedProfileId, category);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of("code", "MOD22_MARKETS_FAILED", "message", e.getMessage()));
        }
    }

    /**
     * Home-view live forecast: runs the pipeline only when the profile's newest
     * forecast is missing or older than {@code maxAgeHours} (default 12h),
     * otherwise serves cached rows. Drives the demand-alert cards on Home.
     */
    @PostMapping("/ensure/{profileId}")
    public ResponseEntity<?> ensure(@PathVariable UUID profileId,
                                    @RequestParam(defaultValue = "12") long maxAgeHours) {
        // URL shape unchanged (frontend routing change is a later task) — but the
        // path-variable profileId is now validated against the JWT-resolved profile
        // instead of trusted outright.
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        try {
            MarketsResponse result = forecastingService.ensureFreshForecast(resolvedProfileId, maxAgeHours);
            return ResponseEntity.ok(result);
        } catch (ResponseStatusException rse) {
            return structuredError(rse, "MOD22_FORECAST_FAILED");
        } catch (IllegalArgumentException iae) {
            // Profile missing or categories not set — a client-state issue, not a
            // server fault. 409 keeps the Home view from showing the AI-down banner.
            return ResponseEntity.status(409)
                    .body(Map.of("code", "MOD22_PROFILE_NOT_READY", "message", iae.getMessage()));
        } catch (AiDependencyException ai) {
            // Structured dependency failure (e.g. MOD22_NO_MARKET_DATA) — pass the
            // full unavailability contract through instead of flattening it.
            return ResponseEntity.status(ai.getStatus()).body(ai.toBody());
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of("code", "MOD22_FORECAST_FAILED", "message", e.getMessage()));
        }
    }

    /** Re-analyze for a specific profile (the "Refresh Forecast" CTA). */
    @PostMapping("/analyze/{profileId}")
    public ResponseEntity<?> analyze(@PathVariable UUID profileId) {
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        try {
            MarketsResponse result = forecastingService.forecastForProfile(resolvedProfileId, true);
            return ResponseEntity.ok(result);
        } catch (ResponseStatusException rse) {
            return structuredError(rse, "MOD22_FORECAST_FAILED");
        } catch (AiDependencyException ai) {
            // Structured dependency failure (e.g. MOD22_NO_MARKET_DATA) — pass the
            // full unavailability contract through instead of flattening it.
            return ResponseEntity.status(ai.getStatus()).body(ai.toBody());
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of("code", "MOD22_FORECAST_FAILED", "message", e.getMessage()));
        }
    }

    /**
     * JWT-derived "Refresh Forecast" — the profile comes from the token, so the
     * frontend never needs to know its own profileId. Same service call and error
     * mapping as {@link #analyze(UUID)}.
     */
    @PostMapping("/analyze")
    public ResponseEntity<?> analyze() {
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(null);
        try {
            MarketsResponse result = forecastingService.forecastForProfile(resolvedProfileId, true);
            return ResponseEntity.ok(result);
        } catch (ResponseStatusException rse) {
            return structuredError(rse, "MOD22_FORECAST_FAILED");
        } catch (AiDependencyException ai) {
            // Structured dependency failure (e.g. MOD22_NO_MARKET_DATA) — pass the
            // full unavailability contract through instead of flattening it.
            return ResponseEntity.status(ai.getStatus()).body(ai.toBody());
        } catch (Exception e) {
            return ResponseEntity.status(503)
                    .body(Map.of("code", "MOD22_FORECAST_FAILED", "message", e.getMessage()));
        }
    }

    /** JWT-derived counterpart of {@link #ensure(UUID, long)}. */
    @PostMapping("/ensure")
    public ResponseEntity<?> ensure(@RequestParam(defaultValue = "12") long maxAgeHours) {
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(null);
        try {
            MarketsResponse result = forecastingService.ensureFreshForecast(resolvedProfileId, maxAgeHours);
            return ResponseEntity.ok(result);
        } catch (ResponseStatusException rse) {
            return structuredError(rse, "MOD22_FORECAST_FAILED");
        } catch (IllegalArgumentException iae) {
            return ResponseEntity.status(409)
                    .body(Map.of("code", "MOD22_PROFILE_NOT_READY", "message", iae.getMessage()));
        } catch (AiDependencyException ai) {
            // Structured dependency failure (e.g. MOD22_NO_MARKET_DATA) — pass the
            // full unavailability contract through instead of flattening it.
            return ResponseEntity.status(ai.getStatus()).body(ai.toBody());
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
