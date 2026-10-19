package com.ceview.module3.submodule31;

import com.ceview.module3.dto.ContentDtos.CaptionsDto;
import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.ceview.module3.dto.ContentDtos.PlatformContentDto;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Puts the surge window's attribution code into every generated caption as a
 * call to action (CVW-42; marketing-attribution spec, phase 2).
 *
 * <p>Stamped deterministically after generation rather than asked of the model:
 * a code the model paraphrased, translated or dropped would silently produce
 * untracked content, and a traveller can only quote a code they actually see.
 * The CTA is in the market's language so it reads as part of the caption.
 *
 * <p>The stamped caption is what gets persisted and what the operator later
 * sends to the compliance audit, so the code is audited like any other text
 * in the caption — it is a plain tracking phrase with no discount claim.
 */
final class AttributionCodeCaptions {

    private static final Map<String, String> CTA_BY_MARKET = Map.of(
            "korea", "예약 시 코드 %s 를 말씀해 주세요.",
            "japan", "ご予約の際はコード「%s」をお伝えください。");

    private static final String DEFAULT_CTA = "Mention code %s when you book.";

    private AttributionCodeCaptions() {}

    static ContentResponseDto stamp(ContentResponseDto dto, String market, String code) {
        if (dto == null || dto.captions() == null || code == null || code.isBlank()) return dto;
        CaptionsDto caps = dto.captions();
        CaptionsDto stamped = new CaptionsDto(
                stamp(caps.instagram(), market, code),
                stamp(caps.tiktok(), market, code),
                stamp(caps.facebook(), market, code));
        return new ContentResponseDto(dto.market(), dto.framework(), stamped, dto.source());
    }

    static String ctaFor(String market, String code) {
        String template = market == null ? DEFAULT_CTA
                : CTA_BY_MARKET.getOrDefault(market.toLowerCase(Locale.ROOT), DEFAULT_CTA);
        return String.format(template, code);
    }

    private static PlatformContentDto stamp(PlatformContentDto platform, String market, String code) {
        if (platform == null || platform.options() == null) return platform;
        String cta = ctaFor(market, code);
        List<String> options = platform.options().stream()
                .map(option -> withCta(option, code, cta))
                .toList();
        return new PlatformContentDto(options, platform.optionNames(), platform.optionMetadata(), platform.guide());
    }

    /** Idempotent: a caption that already quotes the code is left as it is. */
    private static String withCta(String caption, String code, String cta) {
        if (caption == null || caption.isBlank()) return caption;
        if (caption.toUpperCase(Locale.ROOT).contains(code.toUpperCase(Locale.ROOT))) return caption;
        return caption.stripTrailing() + "\n\n" + cta;
    }
}
