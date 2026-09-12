package com.ceview.module2.submodule22;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

/** Contract tests for the persisted demand-window alert values (Step 11). */
class DemandAlertRulesTest {

    private static final OffsetDateTime FIRST_FORECAST_WEEK = OffsetDateTime.parse("2026-01-05T00:00:00Z");
    private static final List<Double> CROSSING_FORECAST = List.of(110.0, 121.0, 130.0, 140.0);

    @Test
    void computesUpliftAndRejectsANonPositiveBaseline() {
        assertThat(ForecastingService.calculateUpliftPct(150.0, 100.0)).isEqualTo(50.0);
        assertThatIllegalArgumentException()
                .isThrownBy(() -> ForecastingService.calculateUpliftPct(150.0, 0.0))
                .withMessageContaining("rolling_7d_avg");
        assertThat(ForecastingService.deriveDemandAlert(
                150.0, 0.0, false, null, CROSSING_FORECAST, FIRST_FORECAST_WEEK)).isEmpty();
    }

    @Test
    void selectsWarningOrCriticalAcrossTheSpikeAndYoyMatrix() {
        assertThat(decision(false, 0.9).level()).isEqualTo("WARNING");
        assertThat(decision(false, 1.0).level()).isEqualTo("WARNING");
        assertThat(decision(true, 0.9).level()).isEqualTo("WARNING");
        assertThat(decision(true, 1.0).level()).isEqualTo("CRITICAL");
        assertThat(decision(true, null).level()).isEqualTo("WARNING");
    }

    @Test
    void derivesTheWindowFromTheFirstWeeklyForecastCrossing() {
        ForecastingService.DemandAlertDecision decision = decision(false, 0.9);

        assertThat(decision.windowOpenDate()).isEqualTo(FIRST_FORECAST_WEEK.plusWeeks(1));
        assertThat(decision.trend()).isEqualTo("Rising demand window");
        assertThat(decision.upliftPct()).isEqualTo(30.0);
    }

    @Test
    void emitsNoAlertWhenNoForecastWeekCrossesTheDemandWindowThreshold() {
        Optional<ForecastingService.DemandAlertDecision> decision = ForecastingService.deriveDemandAlert(
                121.0, 100.0, true, 1.2, List.of(119.0, 120.0, 120.0, 120.0), FIRST_FORECAST_WEEK);

        assertThat(decision).isEmpty();
    }

    /**
     * A rolling baseline of 0.1429 turned a real 36.9 demand forecast into a
     * ~25,690% "uplift" in production (2026-09-12, Japan/Culinary &
     * Gastronomy) — arithmetically correct but unreadable, since percentage
     * change is unbounded as the denominator approaches zero. Below
     * MIN_BASELINE_FOR_UPLIFT_PCT the decision must still fire (a real demand
     * window from a near-zero baseline is still real), but without a
     * percentage claim attached.
     */
    @Test
    void omitsUpliftPctWhenTheBaselineIsTooNearZeroToBeMeaningful() {
        // baseline 0.14, well under the 5.0 floor; still clears the demand-window
        // threshold (0.14 * 1.2 = 0.168 < 36.9) and a forecast week crosses it.
        ForecastingService.DemandAlertDecision decision = ForecastingService.deriveDemandAlert(
                        36.9, 0.14, false, null, List.of(36.9, 36.9, 36.9, 36.9), FIRST_FORECAST_WEEK)
                .orElseThrow();

        assertThat(decision.level()).isEqualTo("WARNING");   // the window is still real
        assertThat(decision.upliftPct()).isNull();           // but the percentage is withheld, not fabricated
    }

    @Test
    void reportsUpliftPctNormallyRightAtAndAboveTheFloor() {
        // baseline exactly at MIN_BASELINE_FOR_UPLIFT_PCT (5.0) — the floor is
        // exclusive (rolling7dAverage < floor), so 5.0 itself still reports a
        // percentage.
        ForecastingService.DemandAlertDecision atFloor = ForecastingService.deriveDemandAlert(
                        20.0, 5.0, false, null, List.of(20.0, 20.0, 20.0, 20.0), FIRST_FORECAST_WEEK)
                .orElseThrow();
        assertThat(atFloor.upliftPct()).isEqualTo(300.0);   // (20/5 - 1) * 100

        ForecastingService.DemandAlertDecision aboveFloor = ForecastingService.deriveDemandAlert(
                        130.0, 100.0, false, null, CROSSING_FORECAST, FIRST_FORECAST_WEEK)
                .orElseThrow();
        assertThat(aboveFloor.upliftPct()).isCloseTo(30.0, org.assertj.core.data.Offset.offset(1e-9));
    }

    @Test
    void upliftClauseSwitchesToAnAbsoluteFigureBelowTheFloorAndAPercentageAboveIt() {
        assertThat(ForecastingService.upliftClause(56.1, 78.2))
                .isEqualTo("the 4-week forecast is 56.1% above the rolling baseline.");
        assertThat(ForecastingService.upliftClause(null, 36.9))
                .isEqualTo("the 4-week forecast reaches 36.9 (out of 100), up sharply from a near-zero recent "
                        + "baseline — too low for a percentage comparison to be meaningful.");
    }

    @Test
    void buildDirectiveNeverMisreportsANearZeroBaselineWindowAsNoActiveWindow() {
        // The bug this guards against: before this fix, buildDirective's branch
        // was `upliftPct != null && windowOpenDate != null` — a real, active
        // window with a null upliftPct (near-zero baseline) would have rendered
        // as "No active demand window is currently persisted", which is false.
        String directive = ForecastingService.buildDirective(
                "japan", null, OffsetDateTime.parse("2026-09-14T00:00:00Z"), false, 0.5, 36.9);

        assertThat(directive).doesNotContain("No active demand window");
        assertThat(directive).contains("36.9 (out of 100)");
        assertThat(directive).contains("the demand window opens 2026-09-14");
    }

    private ForecastingService.DemandAlertDecision decision(boolean spike, Double yoyRatio) {
        return ForecastingService.deriveDemandAlert(
                        130.0, 100.0, spike, yoyRatio, CROSSING_FORECAST, FIRST_FORECAST_WEEK)
                .orElseThrow();
    }
}
