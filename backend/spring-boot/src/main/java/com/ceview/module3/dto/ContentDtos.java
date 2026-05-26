package com.ceview.module3.dto;

import java.util.List;
import java.util.Map;

/**
 * Wire shapes for Module 3 / Content Studio. Mirrors the frontend
 * ContentStudioView MOCK structure so React can render without remapping.
 *
 * Captions are split per-platform (Instagram / TikTok / Facebook / Naver).
 * Each platform exposes a list of caption options (free-text bodies the user
 * can copy) and a visual guide (numbered shot/composition tips).
 *
 * <p>{@code optionNames} is a parallel list to {@code options}, carrying the
 * demographic-archetype label for each caption variation:
 * <ol>
 *   <li>"Witty, Trend-Conscious &amp; High-Energy"  (Gen Z / Younger Demographic)</li>
 *   <li>"Formal, Educational &amp; Value-Driven"    (Mature Planners / Family)</li>
 *   <li>"Storytelling, Immersive &amp; Emotional"   (Aspirational / Experiential)</li>
 * </ol>
 * When Gemini is offline and the fallback payload is used, {@code optionNames}
 * is still populated with these three labels so the UI can always render the
 * demographic badges — see {@link com.ceview.module3.service.ContentService}.
 */
public class ContentDtos {

    public record MarketHeaderDto(
        String country,
        String city,
        String flag
    ) {}

    /**
     * Per-platform caption content.
     *
     * @param options        Caption text bodies — one per demographic archetype.
     * @param optionNames    Demographic archetype labels parallel to {@code options}.
     *                       Always length-3 for Instagram / TikTok / Facebook;
     *                       may be shorter for Naver.
     * @param optionMetadata AI reasoning metadata parallel to {@code options}.
     *                       Each map carries five explainability keys:
     *                       {@code core_business_context}, {@code market_cultural_localization},
     *                       {@code psychological_elements}, {@code creative_tone_atmosphere},
     *                       {@code algorithmic_platform_architecture}.
     *                       Null-safe — absent when Gemini is offline.
     * @param guide          Visual / shot-composition tips for this platform.
     */
    public record PlatformContentDto(
        List<String> options,
        List<String> optionNames,
        List<Map<String, String>> optionMetadata,
        List<String> guide
    ) {}

    public record CaptionsDto(
        PlatformContentDto instagram,
        PlatformContentDto tiktok,
        PlatformContentDto facebook,
        PlatformContentDto naver
    ) {}

    public record ContentResponseDto(
        MarketHeaderDto market,
        String framework,
        CaptionsDto captions,
        /** "gemini" when LLM produced this payload; "fallback" when FastAPI's
         *  hardcoded demo content was used instead. Surfaced in the UI. */
        String source
    ) {}
}
