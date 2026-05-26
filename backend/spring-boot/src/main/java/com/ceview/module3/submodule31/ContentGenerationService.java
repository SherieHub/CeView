package com.ceview.module3.submodule31;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule22.ForecastResult;
import com.ceview.module2.submodule22.ForecastResultRepository;
import com.ceview.module2.submodule22.MarketScore;
import com.ceview.module2.submodule22.MarketScoreRepository;
import com.ceview.module3.Module3ErrorCodes;
import com.ceview.module3.dto.ContentDtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Submodule 3.1 — Market-Localised Promotional Content Generation.
 *
 * FR3.1 — retrieves business profile, classification, uniqueness score from DB.
 * FR3.4 — enriches the AI prompt with Module 2 forecasting outputs.
 * FR3.5 / FR3.6 — delegates to FastAPI (Gemini) for caption + supplementary generation.
 * FR3.10 — persists generated content rows per platform to tbl_localized_promotional_content.
 */
@Service
public class ContentGenerationService {

    private static final Logger log = LoggerFactory.getLogger(ContentGenerationService.class);

    private final AIInferenceGatewayService ai;
    private final BusinessProfileRepository profileRepo;
    private final ForecastResultRepository forecastRepo;
    private final MarketScoreRepository scoreRepo;
    private final LocalizedPromotionalContentRepository contentRepo;
    private final ContentGenerationLogRepository logRepo;
    private final ObjectMapper mapper;

    public ContentGenerationService(AIInferenceGatewayService ai,
                                    BusinessProfileRepository profileRepo,
                                    ForecastResultRepository forecastRepo,
                                    MarketScoreRepository scoreRepo,
                                    LocalizedPromotionalContentRepository contentRepo,
                                    ContentGenerationLogRepository logRepo,
                                    ObjectMapper mapper) {
        this.ai          = ai;
        this.profileRepo = profileRepo;
        this.forecastRepo = forecastRepo;
        this.scoreRepo   = scoreRepo;
        this.contentRepo = contentRepo;
        this.logRepo     = logRepo;
        this.mapper      = mapper;
    }

    /**
     * Generate and persist market-localised content for the given profile and market.
     *
     * @param profileId optional; when null, generates without DB enrichment (FR3.2 fallback)
     * @param market    "korea" | "japan" | "usa"
     * @param request   direct fields from the HTTP request body
     * @return FastAPI content response deserialised into ContentResponseDto
     */
    public ContentResponseDto generate(UUID profileId, String market,
                                       String businessName, String description,
                                       List<String> categories, String trend) {
        // FR3.1 — retrieve validated business attributes from DB when profileId is provided
        BusinessProfile profile = profileId != null
                ? profileRepo.findById(profileId).orElse(null)
                : null;

        if (profile != null) {
            // Prefer DB values over request body; request body is the fallback for unauthenticated use
            businessName = profile.getBusinessName() != null ? profile.getBusinessName() : businessName;
            description  = profile.getBusinessDescription() != null ? profile.getBusinessDescription() : description;
            categories   = profile.categoriesList() != null && !profile.categoriesList().isEmpty()
                    ? profile.categoriesList() : categories;
        }

        int uniquenessScore = (profile != null && profile.getUniquenessScore() != null)
                ? profile.getUniquenessScore().intValue() : 0;

        // FR3.4 — retrieve Module 2 forecasting outputs for the selected market
        Map<String, Object> forecastContext = buildForecastContext(profileId, market);

        // Build enriched payload for FastAPI
        Map<String, Object> payload = new HashMap<>();
        payload.put("market", market == null ? "korea" : market);
        payload.put("businessName", businessName == null ? "" : businessName);
        payload.put("description", description == null ? "" : description);
        payload.put("categories", categories == null ? List.of() : categories);
        payload.put("trend", trend == null ? "" : trend);
        payload.put("uniquenessScore", uniquenessScore);
        payload.put("forecastContext", forecastContext);

        Map<String, Object> raw = ai.generateContent(payload);

        ContentResponseDto dto;
        try {
            dto = mapper.convertValue(raw, ContentResponseDto.class);
        } catch (IllegalArgumentException e) {
            MDC.put("code", Module3ErrorCodes.MOD31_CONTENT_GENERATION_FAILED);
            log.warn("content.generate deserialize failed for market={}", market, e);
            MDC.remove("code");
            throw e;
        }

        // FR3.10 — persist generated content per platform
        if (profileId != null && dto.captions() != null) {
            persistContent(profileId, market, dto, uniquenessScore);
        }

        return dto;
    }

    // ─── persistence ─────────────────────────────────────────────────────────

    private void persistContent(UUID profileId, String market,
                                ContentResponseDto dto, int uniquenessScore) {
        String framework = dto.framework();
        String source    = dto.source();
        CaptionsDto caps = dto.captions();

        Map<String, PlatformContentDto> platformMap = new LinkedHashMap<>();
        if (caps != null) {
            if (caps.instagram() != null) platformMap.put("instagram", caps.instagram());
            if (caps.tiktok()    != null) platformMap.put("tiktok",    caps.tiktok());
            if (caps.facebook()  != null) platformMap.put("facebook",  caps.facebook());
            if (caps.naver()     != null) platformMap.put("naver",     caps.naver());
        }

        int saved = 0;
        for (Map.Entry<String, PlatformContentDto> entry : platformMap.entrySet()) {
            String platform = entry.getKey();
            PlatformContentDto pContent = entry.getValue();

            LocalizedPromotionalContent record = new LocalizedPromotionalContent();
            record.setBusinessProfileId(profileId);
            record.setSelectedMarket(market);
            record.setPlatform(platform);
            record.setGeneratedCaption(firstOption(pContent));
            record.setContentDirection(joinGuide(pContent));
            record.setFramework(framework);
            record.setSource(source);
            contentRepo.save(record);
            saved++;
        }

        // Audit log
        ContentGenerationLog audit = new ContentGenerationLog();
        audit.setBusinessProfileId(profileId);
        audit.setGenerationStatus("COMPLETED");
        audit.setDiagnostics(String.format("market=%s platforms=%d source=%s", market, saved, source));
        logRepo.save(audit);

        MDC.put("code", Module3ErrorCodes.MOD31_CONTENT_STORED);
        log.info("Content stored: profile={} market={} platforms={} source={}",
                profileId, market, saved, source);
        MDC.remove("code");
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
            ctx.put("predictedDemand",  result.getPredictedDemand());
            ctx.put("forecastConfidence", result.getForecastConfidence());
            ctx.put("mapeScore",         result.getMapeScore());
            if (ms != null) {
                ctx.put("marketScore",       ms.getMarketScore());
                ctx.put("spikeIndicator",    ms.getSpikeIndicator());
                ctx.put("seasonalityScore",  ms.getSeasonalityScore());
                ctx.put("gdpGrowth",         ms.getGdpPerCapitaGrowth());
            }
            return ctx;
        } catch (Exception e) {
            log.debug("Could not build forecast context for profile={} market={}: {}",
                    profileId, market, e.getMessage());
            return Map.of();
        }
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    private String firstOption(PlatformContentDto p) {
        if (p == null || p.options() == null || p.options().isEmpty()) return "";
        return p.options().get(0);
    }

    private String joinGuide(PlatformContentDto p) {
        if (p == null || p.guide() == null) return "";
        return String.join("\n", p.guide());
    }
}
