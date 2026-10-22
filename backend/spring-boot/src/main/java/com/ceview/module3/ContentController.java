package com.ceview.module3;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.common.TraceIdFilter;
import com.ceview.module3.dto.ContentDtos.CaptionLocalizationDto;
import com.ceview.module3.dto.ContentDtos.CaptionTranslationDto;
import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.ceview.module3.submodule31.CaptionTranslationService;
import com.ceview.module3.submodule31.ContentApprovalService;
import com.ceview.module3.submodule31.ContentGenerationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Submodule 3.1 — Content Studio API (FR3.1-FR3.10).
 *
 * POST /generate — generates market-localised captions and supplementary outputs,
 *                  retrieves business profile + Module 2 forecast context from DB (FR3.1, FR3.4),
 *                  persists all generated content rows (FR3.10).
 * POST /approve  — marks generated content as operator-approved (FR3.10 / UC-3.1 step 14).
 * POST /translate — native Korean/Japanese caption → meaning-faithful English (stateless).
 * POST /localize  — owner-edited English → natural native caption (stateless).
 *
 * Ownership: profileId — optional on both /generate and /approve — is derived
 * from or validated against {@link CurrentBusinessProfile}, which resolves the
 * caller's own profile from the JWT. See Task 8 (mirrors Task 7 for Module 2).
 */
@RestController
@RequestMapping("/api/content")
public class ContentController {

    private static final Logger log = LoggerFactory.getLogger(ContentController.class);

    private final ContentGenerationService generationService;
    private final ContentApprovalService approvalService;
    private final CurrentBusinessProfile currentBusinessProfile;
    private final CaptionTranslationService translationService;

    public ContentController(ContentGenerationService generationService,
                             ContentApprovalService approvalService,
                             CurrentBusinessProfile currentBusinessProfile,
                             CaptionTranslationService translationService) {
        this.translationService = translationService;
        this.generationService = generationService;
        this.approvalService   = approvalService;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    public record GenerateRequest(
        String market,
        String businessName,
        String description,
        List<String> categories,
        String trend,
        // Optional: the surge alert Content Studio was opened from. Pins which
        // window's attribution code the captions carry (CVW-42).
        UUID demandAlertId
    ) {}

    /**
     * FR3.2 — market selection, FR3.3-FR3.6 — generation pipeline.
     * Accepts an optional profileId query param for DB enrichment (FR3.1, FR3.4).
     */
    @PostMapping("/generate")
    public ContentResponseDto generate(
            @RequestBody GenerateRequest req,
            @RequestParam(required = false) UUID profileId) {
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        log.info("content.generate received market={} profileId={}", req.market(), resolvedProfileId);
        return generationService.generate(
                resolvedProfileId,
                req.market(),
                req.businessName(),
                req.description(),
                req.categories(),
                req.trend(),
                req.demandAlertId());
    }

    /**
     * FR3.10 / UC-3.1 step 14 — operator approves generated content for a market.
     * Body: { "market": "korea" }
     * Returns: { "approvedIds": [...] }
     */
    @PostMapping("/approve")
    public ResponseEntity<Map<String, Object>> approve(
            @RequestParam(required = false) UUID profileId,
            @RequestBody Map<String, String> body) {
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        String market = body.getOrDefault("market", "korea");
        log.info("content.approve received profileId={} market={}", resolvedProfileId, market);

        List<UUID> ids = approvalService.approveForMarket(resolvedProfileId, market);

        if (ids.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of(
                "approvedIds", ids,
                "market",      market,
                "count",       ids.size()
        ));
    }

    private static final int MAX_CAPTION_CHARS = 8000;
    private static final List<String> PLATFORMS = List.of("instagram", "tiktok", "facebook");

    public record TranslateRequest(String caption, String platform) {}

    public record LocalizeRequest(String captionEn, String targetLanguage, String platform,
                                  String originalCaption) {}

    /** Native caption → English, for the Content Studio "Show English" toggle. */
    @PostMapping("/translate")
    public CaptionTranslationDto translate(@RequestBody TranslateRequest req) {
        String caption = requireText(req == null ? null : req.caption(), "caption");
        String platform = platformOf(req.platform());
        return translationService.translate(caption, platform);
    }

    /** Owner-edited English → native caption (Korean/Japanese). */
    @PostMapping("/localize")
    public CaptionLocalizationDto localize(@RequestBody LocalizeRequest req) {
        String captionEn = requireText(req == null ? null : req.captionEn(), "captionEn");
        String platform = platformOf(req.platform());
        String lang = req.targetLanguage() == null ? "" : req.targetLanguage().strip().toLowerCase();
        if (!lang.equals("ko") && !lang.equals("ja")) {
            throw invalid("targetLanguage must be 'ko' or 'ja'");
        }
        String original = req.originalCaption() == null ? "" : req.originalCaption().strip();
        if (original.length() > MAX_CAPTION_CHARS) {
            throw invalid("originalCaption must be at most " + MAX_CAPTION_CHARS + " characters");
        }
        return translationService.localize(captionEn, lang, platform, original);
    }

    private static String requireText(String value, String field) {
        String v = value == null ? "" : value.strip();
        if (v.isBlank()) throw invalid(field + " is required");
        if (v.length() > MAX_CAPTION_CHARS) {
            throw invalid(field + " must be at most " + MAX_CAPTION_CHARS + " characters");
        }
        return v;
    }

    private static String platformOf(String platform) {
        String p = platform == null || platform.isBlank() ? "instagram" : platform.strip().toLowerCase();
        if (!PLATFORMS.contains(p)) throw invalid("platform must be one of " + PLATFORMS);
        return p;
    }

    private static IllegalArgumentException invalid(String message) {
        MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD31_TRANSLATION_VALIDATION);
        log.warn("content.translation rejected — {}", message);
        return new IllegalArgumentException(message);
    }
}
