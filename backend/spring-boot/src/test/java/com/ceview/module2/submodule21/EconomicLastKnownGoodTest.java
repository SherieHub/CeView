package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A World Bank or currency-API outage must produce the last real reading or
 * nothing — never a straight line invented to fill the chart.
 */
class EconomicLastKnownGoodTest {

    @Test
    void noSyntheticFallbackMethodsSurvive() {
        assertThat(java.util.Arrays.stream(ExternalMarketDataClient.class.getDeclaredMethods())
                .map(java.lang.reflect.Method::getName))
                .doesNotContain("gdpTrendFallback", "forexTrendFallback");
    }
}
