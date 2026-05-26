package com.ceview.module3.dto;

import java.util.List;

/**
 * Wire shapes for Module 3 / Content Studio. Mirrors the frontend
 * ContentStudioView MOCK structure so React can render without remapping.
 *
 * Captions are split per-platform (Instagram / TikTok / Facebook / Naver).
 * Each platform exposes a list of caption options (free-text bodies the user
 * can copy) and a visual guide (numbered shot/composition tips).
 */
public class ContentDtos {

    public record MarketHeaderDto(
        String country,
        String city,
        String flag
    ) {}

    public record PlatformContentDto(
        List<String> options,
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
