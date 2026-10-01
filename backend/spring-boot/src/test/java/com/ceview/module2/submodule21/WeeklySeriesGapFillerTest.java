package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static com.ceview.module2.submodule21.WeeklySeriesGapFiller.FilledPoint;
import static com.ceview.module2.submodule21.WeeklySeriesGapFiller.WeekPoint;
import static com.ceview.module2.submodule21.WeeklySeriesGapFiller.fill;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Module 2 E2E, Step 4 (docs/module-2/MODULE_2_E2E_CONTRACT.md §2; C-03).
 * The seasonality payload must be strictly weekly and gap-free: an interior
 * missing week is linearly interpolated and flagged imputed=true; the series
 * never extrapolates at its own edges.
 */
class WeeklySeriesGapFillerTest {

    private static LocalDate monday(int daysFromEpochMonday) {
        // 2026-01-05 is a Monday — an arbitrary, fixed anchor.
        return LocalDate.of(2026, 1, 5).plusDays(daysFromEpochMonday);
    }

    @Test
    void emptyInputProducesEmptyOutput() {
        assertThat(fill(List.of())).isEmpty();
    }

    @Test
    void aSingleRealPointIsNeverImputed() {
        List<FilledPoint> result = fill(List.of(new WeekPoint(monday(0), 42.0)));
        assertThat(result).containsExactly(new FilledPoint(42.0, false));
    }

    @Test
    void consecutiveWeeksWithNoGapAreAllReal() {
        List<FilledPoint> result = fill(List.of(
                new WeekPoint(monday(0), 40.0),
                new WeekPoint(monday(7), 50.0),
                new WeekPoint(monday(14), 60.0)));

        assertThat(result).containsExactly(
                new FilledPoint(40.0, false),
                new FilledPoint(50.0, false),
                new FilledPoint(60.0, false));
    }

    @Test
    void aOneWeekGapIsLinearlyInterpolatedAndFlagged() {
        // Week 0 = 40, week 2 (one week missing at week 1) = 60 -> week 1 should be 50, imputed.
        List<FilledPoint> result = fill(List.of(
                new WeekPoint(monday(0), 40.0),
                new WeekPoint(monday(14), 60.0)));

        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isEqualTo(new FilledPoint(40.0, false));
        assertThat(result.get(1).value()).isCloseTo(50.0, within(1e-9));
        assertThat(result.get(1).imputed()).isTrue();
        assertThat(result.get(2)).isEqualTo(new FilledPoint(60.0, false));
    }

    @Test
    void aTwoWeekGapProducesTwoStepwiseInterpolatedPoints() {
        // Week 0 = 30, week 3 (weeks 1 and 2 missing) = 60 -> step of 10 per week.
        List<FilledPoint> result = fill(List.of(
                new WeekPoint(monday(0), 30.0),
                new WeekPoint(monday(21), 60.0)));

        assertThat(result).hasSize(4);
        assertThat(result.get(1).value()).isCloseTo(40.0, within(1e-9));
        assertThat(result.get(1).imputed()).isTrue();
        assertThat(result.get(2).value()).isCloseTo(50.0, within(1e-9));
        assertThat(result.get(2).imputed()).isTrue();
    }

    @Test
    void neverExtrapolatesAtTheSeriesEdges() {
        List<FilledPoint> result = fill(List.of(
                new WeekPoint(monday(0), 40.0),
                new WeekPoint(monday(14), 60.0)));

        // First and last points are always the real observations passed in —
        // no imputed point is ever added before the first or after the last.
        assertThat(result.get(0).imputed()).isFalse();
        assertThat(result.get(result.size() - 1).imputed()).isFalse();
    }

    @Test
    void outOfOrderOrDuplicateWeeksAreSkippedRatherThanDividingByZero() {
        List<FilledPoint> result = fill(List.of(
                new WeekPoint(monday(0), 40.0),
                new WeekPoint(monday(0), 999.0),   // duplicate week — must not crash
                new WeekPoint(monday(7), 50.0)));

        assertThat(result).extracting(FilledPoint::value).doesNotContain(999.0);
    }
}
