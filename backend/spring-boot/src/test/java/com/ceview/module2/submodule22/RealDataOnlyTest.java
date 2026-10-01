package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.MarketSignalRecord;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The forecast prompt must contain measurements, not placeholders.
 *
 * The 50.0 / 0.5 / 1.0 defaults this replaces were invented numbers passed to the
 * forecaster as if observed — synthetic data one layer below the stub series.
 */
class RealDataOnlyTest {

    private static MarketSignalRecord record(Double trendIndex, OffsetDateTime at) {
        MarketSignalRecord r = new MarketSignalRecord();
        r.setTrendIndex(trendIndex);
        r.setAggregatedAt(at);
        r.setSource("pytrends");
        return r;
    }

    @Test
    void aRecordWithNoTrendIndexIsExcludedRatherThanDefaultedTo50() {
        List<MarketSignalRecord> records = List.of(
                record(70.0, OffsetDateTime.parse("2026-08-01T00:00:00Z")),
                record(null, OffsetDateTime.parse("2026-08-08T00:00:00Z")),
                record(72.0, OffsetDateTime.parse("2026-08-15T00:00:00Z")));

        List<Double> series = EnrichedSequenceBuilder.trendSeriesOf(records);

        assertThat(series).containsExactly(70.0, 72.0);
        assertThat(series).doesNotContain(50.0);
    }

    @Test
    void staleIsMeasuredAgainstTheNewestRecord() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-30T00:00:00Z");

        assertThat(EnrichedSequenceBuilder.isStale(
                OffsetDateTime.parse("2026-08-29T00:00:00Z"), now)).isFalse();
        assertThat(EnrichedSequenceBuilder.isStale(
                OffsetDateTime.parse("2026-08-27T00:00:00Z"), now)).isTrue();
    }

    @Test
    void exactlyAtTheThresholdIsNotYetStale() {
        OffsetDateTime now = OffsetDateTime.parse("2026-08-30T00:00:00Z");

        assertThat(EnrichedSequenceBuilder.isStale(
                OffsetDateTime.parse("2026-08-28T00:00:00Z"), now)).isFalse();
    }
}
