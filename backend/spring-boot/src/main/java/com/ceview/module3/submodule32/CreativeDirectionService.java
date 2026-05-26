package com.ceview.module3.submodule32;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule22.ForecastResult;
import com.ceview.module2.submodule22.ForecastResultRepository;
import com.ceview.module2.submodule22.MarketScore;
import com.ceview.module2.submodule22.MarketScoreRepository;
import com.ceview.module3.Module3ErrorCodes;
import com.ceview.module3.dto.CreativeDirectionDtos.*;
import com.ceview.module3.submodule31.ContentApprovalService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.*;
import java.util.concurrent.TimeoutException;

/**
 * Submodule 3.2 — Creative Direction & Visual Recommendation Generation.
 *
 * FR3.11 — retrieves approved promotional captions from Submodule 3.1.
 * FR3.12 — checks business classification, uniqueness score, market preferences.
 * FR3.13-FR3.16 — delegates to FastAPI (Gemini) for visual direction generation.
 * FR3.19 — persists approved creative direction output to tbl_creative_direction_output.
 *
 * A3 alternative flow: returns 400 if no approved content from UC-3.1 exists.
 */
@Service
public class CreativeDirectionService {

    private static final Logger log = LoggerFactory.getLogger(CreativeDirectionService.class);

    private final AIInferenceGatewayService ai;
    private final ContentApprovalService contentApprovalService;
    private final BusinessProfileRepository profileRepo;
    private final ForecastResultRepository forecastRepo;
    private final MarketScoreRepository scoreRepo;
    private final CreativeDirectionOutputRepository creativeRepo;
    private final CreativeDirectionLogRepository creativeLogRepo;
    private final ObjectMapper mapper;

    public CreativeDirectionService(AIInferenceGatewayService ai,
                                    ContentApprovalService contentApprovalService,
                                    BusinessProfileRepository profileRepo,
                                    ForecastResultRepository forecastRepo,
                                    MarketScoreRepository scoreRepo,
                                    CreativeDirectionOutputRepository creativeRepo,
                                    CreativeDirectionLogRepository creativeLogRepo,
                                    ObjectMapper mapper) {
        this.ai                    = ai;
        this.contentApprovalService = contentApprovalService;
        this.profileRepo           = profileRepo;
        this.forecastRepo          = forecastRepo;
        this.scoreRepo             = scoreRepo;
        this.creativeRepo          = creativeRepo;
        this.creativeLogRepo       = creativeLogRepo;
        this.mapper                = mapper;
    }

    /**
     * Run the Submodule 3.2 pipeline for a profile+market.
     *
     * @throws IllegalStateException "missing_dependency" when UC-3.1 has not been completed (A3 flow)
     */
    public CreativeDirectionDto generate(UUID profileId, String market) {
        // FR3.11 — retrieve approved captions from UC-3.1 (A3 guard)
        if (profileId != null && !contentApprovalService.hasApprovedContent(profileId, market)) {
            MDC.put("code", Module3ErrorCodes.MOD32_CREATIVE_MISSING_DEPENDENCY);
            log.warn("creative.generate blocked — no approved content for profile={} market={}",
                    profileId, market);
            MDC.remove("code");
            throw new IllegalStateException("missing_dependency");
        }

        List<String> approvedCaptions = profileId != null
                ? contentApprovalService.getApprovedCaptions(profileId, market)
                : List.of();

        // FR3.12 — business classification + uniqueness score
        BusinessProfile profile = profileId != null
                ? profileRepo.findById(profileId).orElse(null)
                : null;

        String businessName  = profile != null ? profile.getBusinessName()        : "";
        List<String> categories = profile != null && profile.categoriesList() != null
                ? profile.categoriesList() : List.of();
        int uniquenessScore  = (profile != null && profile.getUniquenessScore() != null)
                ? profile.getUniquenessScore().intValue() : 0;

        Map<String, Object> forecastContext = buildForecastContext(profileId, market);

        // Build payload for FastAPI
        Map<String, Object> payload = new HashMap<>();
        payload.put("profileId",        profileId != null ? profileId.toString() : "");
        payload.put("market",           market == null ? "korea" : market);
        payload.put("businessName",     businessName);
        payload.put("categories",       categories);
        payload.put("approvedCaptions", approvedCaptions);
        payload.put("uniquenessScore",  uniquenessScore);
        payload.put("forecastContext",  forecastContext);

        Map<String, Object> raw;
        try {
            raw = ai.generateCreative(payload);
        } catch (WebClientResponseException e) {
            MDC.put("code", Module3ErrorCodes.MOD3_CREATIVE_GATEWAY_5XX);
            log.warn("creative.generate gateway failure status={}", e.getStatusCode().value(), e);
            MDC.remove("code");
            logCreativeAudit(profileId, "FAILED", e.getMessage());
            throw e;
        } catch (RuntimeException e) {
            if (e.getCause() instanceof TimeoutException) {
                MDC.put("code", Module3ErrorCodes.MOD3_CREATIVE_GATEWAY_TIMEOUT);
                log.warn("creative.generate gateway timeout", e);
                MDC.remove("code");
            }
            logCreativeAudit(profileId, "FAILED", e.getMessage());
            throw e;
        }

        CreativeDirectionDto dto;
        try {
            dto = mapper.convertValue(raw, CreativeDirectionDto.class);
        } catch (IllegalArgumentException e) {
            MDC.put("code", Module3ErrorCodes.MOD3_CREATIVE_DESERIALIZE_FAIL);
            log.warn("creative.generate deserialize failed for market={}", market, e);
            MDC.remove("code");
            logCreativeAudit(profileId, "FAILED", e.getMessage());
            throw e;
        }

        // FR3.19 — persist generated creative direction output
        if (profileId != null) {
            persistCreativeOutput(profileId, market, raw, dto);
        }

        return dto;
    }

    // ─── persistence ─────────────────────────────────────────────────────────

    private void persistCreativeOutput(UUID profileId, String market,
                                       Map<String, Object> raw, CreativeDirectionDto dto) {
        CreativeDirectionOutput output = new CreativeDirectionOutput();
        output.setBusinessProfileId(profileId);
        output.setSelectedMarket(market);
        output.setShotListRecommendations(toJson(raw.get("shots")));
        output.setVisualRecommendations(toJson(raw.get("visualGuide")));
        output.setLightingSuggestions(extractLighting(dto));
        output.setMoodboardReferences(toJson(raw.get("moodboard")));
        output.setPlatformRecommendations(toJson(raw.get("platformRecommendations")));
        output.setVisualTone(extractPalette(dto));
        creativeRepo.save(output);

        logCreativeAudit(profileId, "COMPLETED",
                String.format("market=%s source=%s", market, raw.get("source")));

        MDC.put("code", Module3ErrorCodes.MOD32_CREATIVE_STORED);
        log.info("Creative direction stored: profile={} market={}", profileId, market);
        MDC.remove("code");
    }

    private void logCreativeAudit(UUID profileId, String status, String diagnostics) {
        try {
            CreativeDirectionLog entry = new CreativeDirectionLog();
            entry.setBusinessProfileId(profileId);
            entry.setGenerationStatus(status);
            entry.setDiagnostics(diagnostics);
            creativeLogRepo.save(entry);
        } catch (Exception e) {
            log.debug("Failed to write creative audit log: {}", e.getMessage());
        }
    }

    // ─── Module 2 forecast enrichment ────────────────────────────────────────

    private Map<String, Object> buildForecastContext(UUID profileId, String market) {
        if (profileId == null || market == null) return Map.of();
        try {
            Optional<ForecastResult> fr = forecastRepo
                    .findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                            profileId, market, 4);
            if (fr.isEmpty()) return Map.of();

            ForecastResult result = fr.get();
            List<MarketScore> scores = scoreRepo.findByForecastResultIdIn(
                    List.of(result.getForecastResultId()));
            MarketScore ms = scores.isEmpty() ? null : scores.get(0);

            Map<String, Object> ctx = new HashMap<>();
            ctx.put("predictedDemand", result.getPredictedDemand());
            if (ms != null) {
                ctx.put("marketScore",      ms.getMarketScore());
                ctx.put("spikeIndicator",   ms.getSpikeIndicator());
                ctx.put("seasonalityScore", ms.getSeasonalityScore());
            }
            return ctx;
        } catch (Exception e) {
            log.debug("Could not build forecast context: {}", e.getMessage());
            return Map.of();
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception e) {
            return value.toString();
        }
    }

    private String extractLighting(CreativeDirectionDto dto) {
        if (dto.shots() == null || dto.shots().isEmpty()) return null;
        return dto.shots().stream()
                .map(s -> s.label() + ": " + s.lighting())
                .reduce((a, b) -> a + "\n" + b)
                .orElse(null);
    }

    private String extractPalette(CreativeDirectionDto dto) {
        return dto.moodboard() != null ? dto.moodboard().palette() : null;
    }
}
