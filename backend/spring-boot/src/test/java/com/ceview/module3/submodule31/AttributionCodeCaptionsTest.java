package com.ceview.module3.submodule31;

import com.ceview.module3.dto.ContentDtos.CaptionsDto;
import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.ceview.module3.dto.ContentDtos.ContentSource;
import com.ceview.module3.dto.ContentDtos.MarketHeaderDto;
import com.ceview.module3.dto.ContentDtos.PlatformContentDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** CVW-42 — a traveller can only quote a code they actually see in the caption. */
class AttributionCodeCaptionsTest {

    private static ContentResponseDto dto(List<String> options) {
        PlatformContentDto platform = new PlatformContentDto(options, List.of("A", "B"), null, List.of("guide"));
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
    void unknownMarketsFallBackToEnglishAndNoCodeMeansNoChange() {
        assertEquals("Mention code US-DIVE-1019 when you book.",
                AttributionCodeCaptions.ctaFor("usa", "US-DIVE-1019"));

        ContentResponseDto original = dto(List.of("caption"));
        assertSame(original, AttributionCodeCaptions.stamp(original, "korea", null));
        assertSame(original, AttributionCodeCaptions.stamp(original, "korea", " "));
    }
}
