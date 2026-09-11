package com.ceview.module2;

import com.ceview.module2.dto.MarketDtos.MarketDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies MarketDto carries the radar-drawer fields added on top of the
 * pre-existing forecasting fields: currency, forexLabel, gdpValue, forexValue,
 * seasonalityScore, yoyRatio, spikeIndicator, the fare range + provenance
 * (H-16) and peakMonthsSource (H-19).
 */
class MarketDtoMappingTest {

    private MarketDto build(Double yoyRatio) {
        return new MarketDto(
                "korea", 1, "South Korea", "Seoul", 92, "Act now",
                true, "3h 45m", 2_640, "ICN — Incheon Int'l", "CEB — Mactan-Cebu Int'l",
                9, 14,
                8_000, 15_000, "static_reference_v1", "2026-09-11",
                List.of(), List.of("Jul", "Aug", "Dec", "Jan"), "reference",
                "Economy insight", "Seasonality insight",
                List.of(), List.of(), List.of(),
                "KRW", "PHP per 1 KRW",
                2.2, 23.8, 0.65,
                yoyRatio,
                true,
                "2026-08-24T03:00:00Z", false,
                null,
                "live", "last_known_good", "2026-08-24T02:00:00Z",
                "CRITICAL", 28.4, "2026-09-07T00:00:00Z", "linear",
                0.82, false, "stub-v1"
        );
    }

    @Test
    void radarDrawerFieldsRoundTrip() {
        MarketDto dto = build(1.12);

        assertThat(dto.currency()).isEqualTo("KRW");
        assertThat(dto.forexLabel()).isEqualTo("PHP per 1 KRW");
        assertThat(dto.gdpValue()).isEqualTo(2.2);
        assertThat(dto.forexValue()).isEqualTo(23.8);
        assertThat(dto.seasonalityScore()).isEqualTo(0.65);
        assertThat(dto.yoyRatio()).isEqualTo(1.12);
        assertThat(dto.spikeIndicator()).isTrue();
        assertThat(dto.accessibilityScore()).isEqualTo(9);
        assertThat(dto.fareMinPhp()).isEqualTo(8_000);
        assertThat(dto.fareMaxPhp()).isEqualTo(15_000);
        assertThat(dto.fareSource()).isEqualTo("static_reference_v1");
        assertThat(dto.fareAsOf()).isEqualTo("2026-09-11");
        assertThat(dto.peakMonthsSource()).isEqualTo("reference");
        assertThat(dto.gdpSource()).isEqualTo("live");
        assertThat(dto.forexSource()).isEqualTo("last_known_good");
        assertThat(dto.macroAsOf()).isEqualTo("2026-08-24T02:00:00Z");
        assertThat(dto.surgeLevel()).isEqualTo("CRITICAL");
        assertThat(dto.upliftPct()).isEqualTo(28.4);
        assertThat(dto.windowOpenDate()).isEqualTo("2026-09-07T00:00:00Z");
        assertThat(dto.scorer()).isEqualTo("linear");
    }

    @Test
    void yoyRatioIsNullableForPreV20Rows() {
        MarketDto dto = build(null);

        assertThat(dto.yoyRatio()).isNull();
    }
}
