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

    private ForecastingService.DemandAlertDecision decision(boolean spike, Double yoyRatio) {
        return ForecastingService.deriveDemandAlert(
                        130.0, 100.0, spike, yoyRatio, CROSSING_FORECAST, FIRST_FORECAST_WEEK)
                .orElseThrow();
    }
}
