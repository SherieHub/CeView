package com.ceview.module2.submodule21;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * Module 2 E2E, Step 3 (docs/module-2/MODULE_2_E2E_CONTRACT.md §1; C-05, T-07).
 *
 * The fawazahmed0 CDN quotes foreign units per 1 PHP; this codebase's canonical unit is
 * the inverse, PHP per 1 unit of foreign currency (korea ≈ 0.0416, japan ≈ 0.38,
 * usa ≈ 57-58). invertToCanonical() is the single point every raw forex read passes
 * through, and its output IS what ends up persisted (fetchForexRate/fetchForexTrend do
 * nothing to it afterward) — so testing it directly for all three tracked currencies is
 * a faithful guard against an inversion regression, without a network-mocking harness
 * this client isn't wired for (its WebClient calls an absolute CDN URI, bypassing the
 * configured base URL entirely).
 */
class ForexCanonicalUnitTest {

    @Test
    void krwLandsInTheExpectedCanonicalBand() {
        // Raw CDN quote: 1 PHP ≈ 24.0385 KRW (foreign units per PHP).
        Double canonical = ExternalMarketDataClient.invertToCanonical(24.0385);

        assertThat(canonical).isCloseTo(0.0416, within(0.0001));
        assertThat(canonical).isBetween(0.03, 0.05);
    }

    @Test
    void jpyLandsInTheExpectedCanonicalBand() {
        // Raw CDN quote: 1 PHP ≈ 2.6316 JPY (foreign units per PHP).
        Double canonical = ExternalMarketDataClient.invertToCanonical(2.6316);

        assertThat(canonical).isCloseTo(0.38, within(0.001));
        assertThat(canonical).isBetween(0.3, 0.5);
    }

    @Test
    void usdLandsInTheExpectedCanonicalBandAndIsNoLongerNearZero() {
        // Raw CDN quote: 1 PHP ≈ 0.017544 USD (foreign units per PHP) — this is the
        // value that, unconverted, used to make USD score near zero everywhere it fed
        // a magnitude-based comparison.
        Double canonical = ExternalMarketDataClient.invertToCanonical(0.017544);

        assertThat(canonical).isCloseTo(57.0, within(0.5));
        assertThat(canonical).isBetween(55.0, 60.0);
    }

    @Test
    void aZeroQuoteIsNeverInvertedIntoAFabricatedRate() {
        assertThat(ExternalMarketDataClient.invertToCanonical(0.0)).isNull();
    }

    @Test
    void aNegativeQuoteIsNeverInverted() {
        assertThat(ExternalMarketDataClient.invertToCanonical(-23.8)).isNull();
    }

    @Test
    void aNonFiniteQuoteIsNeverInverted() {
        assertThat(ExternalMarketDataClient.invertToCanonical(Double.NaN)).isNull();
        assertThat(ExternalMarketDataClient.invertToCanonical(Double.POSITIVE_INFINITY)).isNull();
    }

    // theStaticFallbacksAreAlreadyCanonical was removed in Step 6 (docs/module-2/
    // MODULE_2_E2E_CONTRACT.md; C-06, H-18): it asserted on FOREX_DEFAULTS, the
    // static exception-path constant this step deletes outright in favor of a
    // three-tier live / last-known-good / hard-failure policy — there is no
    // longer a static fallback map for an outage to fall back to. Coverage for
    // the replacement policy lives in MacroInputProvenanceTest.
}
