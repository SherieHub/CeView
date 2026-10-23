package com.ceview.module3.submodule31;

import com.ceview.module3.dto.ContentDtos.CaptionsDto;
import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.ceview.module3.dto.ContentDtos.ContentSource;
import com.ceview.module3.dto.ContentDtos.MarketHeaderDto;
import com.ceview.module3.dto.ContentDtos.PlatformContentDto;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Arrays;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** CVW-42 — a traveller can only quote a code they actually see in the caption. */
class AttributionCodeCaptionsTest {

    private static ContentResponseDto dto(List<String> options) {
        PlatformContentDto platform = new PlatformContentDto(options, null, List.of("A", "B"), null, List.of("guide"));
        return new ContentResponseDto(new MarketHeaderDto("South Korea", "Seoul", "kr"), "AIDA",
                new CaptionsDto(platform, platform, null), ContentSource.GROQ);
    }

    @Test
    void everyOptionOnEveryPlatformCarriesTheCodeInTheMarketsLanguage() {
        ContentResponseDto stamped = AttributionCodeCaptions.stamp(
                dto(List.of("Dive the reef ", "Sunset at Moalboal")), "korea", "KR-DIVE-1019");

        for (PlatformContentDto platform : List.of(stamped.captions().instagram(), stamped.captions().tiktok())) {
            assertEquals(2, platform.options().size());
            platform.options().forEach(option -> {
                assertTrue(option.contains("KR-DIVE-1019"), option);
                assertTrue(option.contains("예약"), "Korean CTA: " + option);
            });
            assertEquals(List.of("A", "B"), platform.optionNames());
            assertNull(platform.optionsEn());
        }
        assertEquals("Dive the reef\n\n" + AttributionCodeCaptions.ctaFor("korea", "KR-DIVE-1019"),
                stamped.captions().instagram().options().get(0));
        assertNull(stamped.captions().facebook());
    }

    @Test
    void aCaptionThatAlreadyQuotesTheCodeIsLeftAlone() {
        String caption = "Quote kr-dive-1019 at the counter!";
        ContentResponseDto stamped = AttributionCodeCaptions.stamp(dto(List.of(caption)), "korea", "KR-DIVE-1019");

        assertEquals(caption, stamped.captions().instagram().options().get(0));
    }

    @Test
    void englishReadingAidCarriesTheSameCodeWithoutLosingPlatformMetadata() {
        var metadata = List.of(Map.of("core_business_context", "Reef tours"));
        var platform = new PlatformContentDto(List.of("Dive the reef"), List.of("Explore the reef"),
                List.of("A"), metadata, List.of("guide"));
        var original = new ContentResponseDto(new MarketHeaderDto("Japan", "Tokyo", "jp"), "AIDA",
                new CaptionsDto(platform, platform, platform), ContentSource.GROQ);

        var stamped = AttributionCodeCaptions.stamp(original, "japan", "JP-DIVE-1019");

        for (var result : List.of(stamped.captions().instagram(), stamped.captions().tiktok(), stamped.captions().facebook())) {
            assertEquals(List.of("Explore the reef\n\nMention code JP-DIVE-1019 when you book."), result.optionsEn());
            assertEquals(List.of("Dive the reef\n\n" + AttributionCodeCaptions.ctaFor("japan", "JP-DIVE-1019")), result.options());
            assertEquals(platform.optionNames(), result.optionNames());
            assertEquals(metadata, result.optionMetadata());
            assertEquals(platform.guide(), result.guide());
        }
        assertEquals(stamped, AttributionCodeCaptions.stamp(stamped, "japan", "JP-DIVE-1019"));
    }

    @Test
    void absentTranslationEntriesRemainAbsentAndExistingCodesAreNotDuplicated() {
        var english = Arrays.asList(null, "", " ", "Quote kr-dive-1019 when booking");
        var platform = new PlatformContentDto(List.of("One", "Two", "Three", "Four"), english, null, null, null);
        var original = new ContentResponseDto(null, "AIDA", new CaptionsDto(platform, null, null), ContentSource.GROQ);

        var stamped = AttributionCodeCaptions.stamp(original, "korea", "KR-DIVE-1019");

        assertEquals(english, stamped.captions().instagram().optionsEn());
    }

    @Test
    void unknownMarketsFallBackToEnglishAndNoCodeMeansNoChange() {
        assertEquals("Mention code US-DIVE-1019 when you book.",
                AttributionCodeCaptions.ctaFor("usa", "US-DIVE-1019"));

        ContentResponseDto original = dto(List.of("caption"));
        assertSame(original, AttributionCodeCaptions.stamp(original, "korea", null));
        assertSame(original, AttributionCodeCaptions.stamp(original, "korea", " "));
    }
}
