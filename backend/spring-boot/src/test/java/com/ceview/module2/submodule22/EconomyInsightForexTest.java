package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.ExternalMarketDataClient.ForexTrendDto;
import com.ceview.module2.submodule21.ExternalMarketDataClient.ForexTrendPoint;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Module 2 E2E, Step 3 (docs/module-2/MODULE_2_E2E_CONTRACT.md §1; C-05, T-07).
 *
 * buildEconomyInsight's old forex thresholds ("&gt; 15.0 = exceptional" etc.) were
 * written against the pre-canonical unit and are meaningless now that every market's
 * forex is PHP per 1 foreign unit — korea ≈ 0.04, japan ≈ 0.38, usa ≈ 57 span three
 * orders of magnitude purely from currency denomination. These tests prove the
 * replacement signal (% deviation from the market's own 12-month mean) is genuinely
 * unit-independent: it must read the same way for a market whose canonical rate is
 * ~0.04 as for one whose canonical rate is ~57, given the same relative movement.
 */
class EconomyInsightForexTest {

    private static ForexTrendDto trend(String currency, double... values) {
        List<ForexTrendPoint> points = new java.util.ArrayList<>();
        for (int i = 0; i < values.length; i++) {
            points.add(new ForexTrendPoint(String.format("2026-%02d", i + 1), values[i]));
        }
        return new ForexTrendDto(currency, points, values[values.length - 1], OffsetDateTime.now());
    }

    @Test
    void aFivePercentRiseReadsTheSameForKrwAndUsd() {
        // KRW: mean 0.0400, latest 0.0420 -> +5%. USD: mean 57.00, latest 59.85 -> +5%.
        Double krwChange = ForecastingService.forexChangeVsTwelveMonthMeanPct(
                trend("KRW", 0.0390, 0.0400, 0.0410, 0.0420));
        Double usdChange = ForecastingService.forexChangeVsTwelveMonthMeanPct(
                trend("USD", 55.575, 57.0, 58.425, 59.85));

        assertThat(krwChange).isCloseTo(5.0, within(0.1));
        assertThat(usdChange).isCloseTo(5.0, within(0.1));
    }

    @Test
    void jpyAtItsOwnMeanReadsAsStable() {
        Double change = ForecastingService.forexChangeVsTwelveMonthMeanPct(
                trend("JPY", 0.38, 0.38, 0.38, 0.38));
        assertThat(change).isCloseTo(0.0, within(0.001));
    }

    @Test
    void noHistoryIsNullNotZero() {
        assertThat(ForecastingService.forexChangeVsTwelveMonthMeanPct(null)).isNull();
        assertThat(ForecastingService.forexChangeVsTwelveMonthMeanPct(trend("USD"))).isNull();
    }

    @Test
    void theInsightTextIsTrueForAllThreeCanonicalMagnitudes() {
        MarketScore ms = new MarketScore();
        ms.setGdpPerCapitaGrowth(2.2);

        String korea = ForecastingService.buildEconomyInsight(ms, trend("KRW", 0.0390, 0.0400, 0.0410, 0.0420));
        String japan = ForecastingService.buildEconomyInsight(ms, trend("JPY", 0.38, 0.38, 0.38, 0.38));
        String usa   = ForecastingService.buildEconomyInsight(ms, trend("USD", 55.575, 57.0, 58.425, 59.85));

        assertThat(korea).contains("improving").doesNotContain("null").doesNotContain("NaN");
        assertThat(japan).contains("stable").doesNotContain("null").doesNotContain("NaN");
        assertThat(usa).contains("improving").doesNotContain("null").doesNotContain("NaN");
        assertThat(korea).contains("linear fallback economic viability scorer")
                .doesNotContain("XGBoost economic viability score was used");
    }

    @Test
    void missingTrendHistoryIsStatedHonestlyRatherThanGuessed() {
        MarketScore ms = new MarketScore();
        ms.setGdpPerCapitaGrowth(2.2);

        String insight = ForecastingService.buildEconomyInsight(ms, trend("USD"));

        assertThat(insight).contains("undetermined").contains("not enough exchange-rate history");
    }

    @Test
    void theForexLabelComesFromOneTemplate() {
        assertThat(ForecastingService.forexLabel("KRW")).isEqualTo("PHP per 1 KRW");
        assertThat(ForecastingService.forexLabel("USD")).isEqualTo("PHP per 1 USD");
        assertThat(ForecastingService.forexLabel("")).isEmpty();
    }

    @Test
    void templatesRenderOnlyMeasuredFactsForKoreaJapanAndUsa() {
        // demand4w (the trailing argument) is only read when upliftPct is null —
        // irrelevant to these three assertions, which all have a non-null
        // upliftPct or no active window at all. See MIN_BASELINE_FOR_UPLIFT_PCT.
        assertThat(ForecastingService.buildDirective("korea", 28.4,
                OffsetDateTime.parse("2026-09-07T00:00:00Z"), true, 0.82, 50.0))
                .isEqualTo("South Korea has a 28.4% forecast uplift above its rolling baseline; the demand window opens 2026-09-07. A current interest spike is present. Forecast confidence is 82%.");
        assertThat(ForecastingService.buildDirective("japan", 22.1,
                OffsetDateTime.parse("2026-09-14T00:00:00Z"), false, 0.76, 50.0))
                .isEqualTo("Japan has a 22.1% forecast uplift above its rolling baseline; the demand window opens 2026-09-14. No current interest spike is present. Forecast confidence is 76%.");
        assertThat(ForecastingService.buildDirective("usa", null, null, false, 0.61, 50.0))
                .isEqualTo("No active demand window is currently persisted for United States. Forecast confidence is 61%.");
    }

    @Test
    void economyAnd_seasonality_templates_name_the_actual_scorer_and_ui_bands() {
        MarketScore ms = new MarketScore();
        ms.setGdpPerCapitaGrowth(2.2);
        ms.setScorer("xgboost");
        ms.setSeasonalityScore(0.85);
        assertThat(ForecastingService.buildEconomyInsight(ms, trend("KRW", 0.04, 0.04)))
                .contains("The XGBoost economic viability scorer");
        assertThat(ForecastingService.buildSeasonalityInsight(ms)).startsWith("Strong ");

        ms.setSeasonalityScore(0.70);
        assertThat(ForecastingService.buildSeasonalityInsight(ms)).startsWith("Moderate ");
        ms.setSeasonalityScore(0.40);
        assertThat(ForecastingService.buildSeasonalityInsight(ms)).startsWith("Weak — emerging ");
        ms.setSeasonalityScore(0.39);
        assertThat(ForecastingService.buildSeasonalityInsight(ms)).startsWith("No seasonal basis ");
    }
}
