package com.ceview.module2.submodule22;

import com.ceview.ai.AiDependencyException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * "No measured data" is a distinct, actionable state — not a generic 500 and
 * certainly not an empty forecast rendered as if it meant something.
 */
class NoMarketDataTest {

    @Test
    void emptyDatasetBecomesAStructuredUnavailability() {
        assertThatThrownBy(() -> {
            throw ForecastingService.noMarketData("korea", "pytrends returned 429 on 2026-08-29");
        })
                .isInstanceOf(AiDependencyException.class)
                .satisfies(thrown -> {
                    AiDependencyException ex = (AiDependencyException) thrown;
                    assertThat(ex.getCode()).isEqualTo("MOD22_NO_MARKET_DATA");
                    assertThat(ex.getDependency()).isEqualTo("pytrends");
                    assertThat(ex.getCause2()).contains("429");
                    assertThat(ex.getStatus()).isEqualTo(503);
                });
    }
}
