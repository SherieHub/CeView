package com.ceview.module2.submodule21;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Fills gaps in a chronological weekly trend-index series before it is sent to
 * FastAPI's seasonal-shift detector (contract §2 / Step 4).
 *
 * <p>Ingestion now writes at most one {@link MarketSignalRecord} per ISO week, but a
 * week can still be MISSING entirely — a failed ingestion run, a newly-tagged
 * category that skipped a week, etc. The resulting series would then have gaps
 * rather than a strictly weekly cadence, which the rolling-window math in
 * {@code seasonal_shift_detector.py} silently mis-measures: a 3-week gap collapsed
 * onto adjacent samples looks like three IDENTICAL weeks, which understates real
 * volatility and can hide or fabricate a spike.
 *
 * <h3>Gap policy</h3>
 * <ul>
 *   <li>An INTERIOR gap (missing weeks strictly between two real observations) is
 *       filled by LINEAR interpolation between those two real neighbours, one
 *       point per missing week, each flagged {@code imputed = true}.</li>
 *   <li>The series NEVER extrapolates at its edges — the first and last points of
 *       the output are always the first and last REAL observations passed in,
 *       never imputed. A gap before the first real point or after the last one
 *       is simply outside the series; it is not filled.</li>
 *   <li>Nothing this class produces is ever persisted as a {@link MarketSignalRecord}
 *       — this is a transient view built fresh for one seasonality call, never
 *       mistaken for a measurement.</li>
 * </ul>
 */
public final class WeeklySeriesGapFiller {

    private WeeklySeriesGapFiller() {}

    /** One real, measured weekly observation. */
    public record WeekPoint(LocalDate weekStartDate, double trendIndex) {}

    /** One point of the gap-filled output series. */
    public record FilledPoint(double value, boolean imputed) {}

    /**
     * @param points chronological (oldest first), one entry per REAL observed
     *               week, each with a distinct, strictly increasing weekStartDate
     * @return a gap-free chronological series spanning the first to the last real
     *         point inclusive, with any interior gap linearly interpolated;
     *         empty when {@code points} is empty
     */
    public static List<FilledPoint> fill(List<WeekPoint> points) {
        List<FilledPoint> result = new ArrayList<>();
        if (points.isEmpty()) return result;

        result.add(new FilledPoint(points.get(0).trendIndex(), false));
        for (int i = 1; i < points.size(); i++) {
            WeekPoint prev = points.get(i - 1);
            WeekPoint curr = points.get(i);
            long weeksApart = ChronoUnit.WEEKS.between(prev.weekStartDate(), curr.weekStartDate());
            if (weeksApart <= 0) {
                // Duplicate or out-of-order week — cannot happen from a correctly
                // deduplicated, chronologically-sorted caller (the ISO-week unique
                // constraint guarantees distinct weeks), but skip rather than
                // divide by zero or interpolate backwards if it ever does.
                continue;
            }
            double step = (curr.trendIndex() - prev.trendIndex()) / weeksApart;
            for (long w = 1; w < weeksApart; w++) {
                result.add(new FilledPoint(prev.trendIndex() + step * w, true));
            }
            result.add(new FilledPoint(curr.trendIndex(), false));
        }
        return result;
    }
}
