package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A failed or synthetic fetch must leave no signal record behind. Writing one
 * "so the dashboard has something" is how fabricated data entered the system in
 * the first place.
 */
class NoRecordOnFetchFailureTest {

    @Test
    void aStubSourcedResultIsRejected() {
        assertThat(TrendFetchSchedulerService.isTrustworthy(Map.of("source", "stub"))).isFalse();
    }

    @Test
    void aPytrendsSourcedResultIsAccepted() {
        assertThat(TrendFetchSchedulerService.isTrustworthy(Map.of("source", "pytrends"))).isTrue();
    }

    @Test
    void aResultWithNoSourceIsRejected() {
        assertThat(TrendFetchSchedulerService.isTrustworthy(Map.of())).isFalse();
    }
}
