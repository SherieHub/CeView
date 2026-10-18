package com.ceview.module3.submodule31;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.Module3ErrorCodes;
import com.ceview.module3.dto.ContentDtos.CaptionLocalizationDto;
import com.ceview.module3.dto.ContentDtos.CaptionTranslationDto;
import com.ceview.module3.dto.ContentDtos.ContentSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

/**
 * Submodule 3.1 — caption translation for the Content Studio English toggle.
 *
 * <p>Stateless: nothing is persisted. The caller's own business name is looked up
 * (via {@link CurrentBusinessProfile}, so 401/409 apply as elsewhere) only so the
 * model keeps it verbatim.
 */
@Service
public class CaptionTranslationService {

    private static final Logger log = LoggerFactory.getLogger(CaptionTranslationService.class);

    private final AIInferenceGatewayService ai;
    private final CurrentBusinessProfile currentBusinessProfile;
    private final BusinessProfileRepository profileRepo;

    public CaptionTranslationService(AIInferenceGatewayService ai,
                                     CurrentBusinessProfile currentBusinessProfile,
                                     BusinessProfileRepository profileRepo) {
        this.ai = ai;
        this.currentBusinessProfile = currentBusinessProfile;
        this.profileRepo = profileRepo;
    }

    public CaptionTranslationDto translate(String caption, String platform) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("caption", caption);
        payload.put("platform", platform);
        payload.put("business_name", businessName());

        Map<String, Object> raw = ai.translateCaption(payload);
        String en = str(raw, "caption_en");
        if (en.isBlank()) throw failed("translate returned no caption_en");
        log.info("content.translate ok platform={} caption_len={}", platform, caption.length());
        return new CaptionTranslationDto(en, str(raw, "source_language"), ContentSource.GROQ);
    }

    public CaptionLocalizationDto localize(String captionEn, String targetLanguage, String platform,
                                           String originalCaption) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("caption_en", captionEn);
        payload.put("target_language", targetLanguage);
        payload.put("platform", platform);
        payload.put("original_caption", originalCaption == null ? "" : originalCaption);
        payload.put("business_name", businessName());

        Map<String, Object> raw = ai.localizeCaption(payload);
        String caption = str(raw, "caption");
        if (caption.isBlank()) throw failed("localize returned no caption");
        log.info("content.localize ok platform={} target={}", platform, targetLanguage);
        return new CaptionLocalizationDto(caption, str(raw, "caption_en"), targetLanguage, ContentSource.GROQ);
    }

    private String businessName() {
        return profileRepo.findById(currentBusinessProfile.resolveProfileId())
                .map(p -> p.getBusinessName() == null ? "" : p.getBusinessName())
                .orElse("");
    }

    private static String str(Map<String, Object> raw, String key) {
        Object v = raw == null ? null : raw.get(key);
        return v == null ? "" : v.toString();
    }

    private static ResponseStatusException failed(String detail) {
        MDC.put("code", Module3ErrorCodes.MOD31_TRANSLATION_FAILED);
        log.warn("content.translation failed: {}", detail);
        MDC.remove("code");
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                Module3ErrorCodes.MOD31_TRANSLATION_FAILED + " :: " + detail);
    }
}
