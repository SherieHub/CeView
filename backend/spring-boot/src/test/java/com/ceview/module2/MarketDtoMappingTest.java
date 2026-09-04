package com.ceview.module2;

import com.ceview.module2.dto.MarketDtos.MarketDto;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies MarketDto carries the radar-drawer fields added on top of the
 * pre-existing forecasting fields: flag, currency, forexLabel, gdpValue,
 * forexValue, seasonalityScore, yoyRatio, spikeIndicator.
 */
class MarketDtoMappingTest {

    private MarketDto build(Double yoyRatio) {
        return new MarketDto(
                "korea", 1, "South Korea", "Seoul", 92, "Act now",
                true, "3h 45m", 2_640, "ICN — Incheon Int'l", "CEB — Mactan-Cebu Int'l",
                9, 14, "₱8,000 – ₱15,000",
                List.of(), List.of("Jul", "Aug", "Dec", "Jan"),
                "Economy insight", "Seasonality insight",
                List.of(), List.of(), List.of(),
                "KR", "KRW", "PHP per 1 KRW",
                2.2, 23.8, 0.65,
                yoyRatio,
                true,
                "2026-08-24T03:00:00Z", false
        );
    }

    @Test
    void radarDrawerFieldsRoundTrip() {
        MarketDto dto = build(1.12);

        assertThat(dto.flag()).isEqualTo("KR");
        assertThat(dto.currency()).isEqualTo("KRW");
        assertThat(dto.forexLabel()).isEqualTo("PHP per 1 KRW");
        assertThat(dto.gdpValue()).isEqualTo(2.2);
        assertThat(dto.forexValue()).isEqualTo(23.8);
        assertThat(dto.seasonalityScore()).isEqualTo(0.65);
        assertThat(dto.yoyRatio()).isEqualTo(1.12);
        assertThat(dto.spikeIndicator()).isTrue();
    }

    @Test
    void yoyRatioIsNullableForPreV20Rows() {
        MarketDto dto = build(null);

        assertThat(dto.yoyRatio()).isNull();
    }
}
