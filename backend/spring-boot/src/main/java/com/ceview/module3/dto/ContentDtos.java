package com.ceview.module3.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

/**
 * Wire shapes for Module 3 / Content Studio. Mirrors the frontend
 * ContentStudioView MOCK structure so React can render without remapping.
 *
 * Captions are split per-platform (Instagram / TikTok / Facebook).
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
 * {@code optionNames} is always populated with these three labels so the UI can
 * render the demographic badges. When generation is unavailable the whole call
 * fails with an AiDependencyException rather than returning a partial payload.
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
     * @param optionsEn      Meaning-faithful English translation of each caption, parallel to
     *                       {@code options}. {@code ""} means no translation (e.g. USA); null on
     *                       responses from an older sbert.
     * @param optionNames    Demographic archetype labels parallel to {@code options}.
     *                       Always length-3 for Instagram / TikTok / Facebook.
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
        List<String> optionsEn,
        List<String> optionNames,
        List<Map<String, String>> optionMetadata,
        List<String> guide
    ) {}

    public record CaptionsDto(
        PlatformContentDto instagram,
        PlatformContentDto tiktok,
        PlatformContentDto facebook
    ) {}

    /**
     * Where the captions came from. There is exactly one legal value: the model
     * produced them. Unavailability is an AiDependencyException, not a source.
     *
     * <p>Adding a FALLBACK constant here is the change that reintroducing a
     * fallback would require — which is the point.
     */
    public enum ContentSource {
        @JsonProperty("groq") GROQ
    }

    /** POST /api/content/translate — native caption → English for the owner. */
    public record CaptionTranslationDto(String captionEn, String sourceLanguage, ContentSource source) {}

    /** POST /api/content/localize — owner-edited English → native caption (+ fresh English). */
    public record CaptionLocalizationDto(String caption, String captionEn, String targetLanguage,
                                         ContentSource source) {}

    public record ContentResponseDto(
        MarketHeaderDto market,
        String framework,
        CaptionsDto captions,
        ContentSource source
    ) {}
}
