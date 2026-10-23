package com.ceview.module4.attribution.link;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AttributionUrlStartupCheckTest {

    @Test
    void publicHttpsUrlsRaiseNoProblems() {
        assertThat(AttributionUrlStartupCheck.problems(
                "https://api.ceview.app", "https://ceview.app")).isEmpty();
    }

    @Test
    void localhostAttributionBaseUrlIsReportedBecauseItEndsUpInLiveAds() {
        assertThat(AttributionUrlStartupCheck.problems("http://localhost:8080", "https://ceview.app"))
                .singleElement()
                .asString()
                .contains("CEVIEW_ATTRIBUTION_BASE_URL");
    }

    @Test
    void loopbackEnquiryBaseUrlIsReportedBecauseTravellersCannotReachIt() {
        assertThat(AttributionUrlStartupCheck.problems("https://api.ceview.app", "http://127.0.0.1:5173"))
                .singleElement()
                .asString()
                .contains("FRONTEND_BASE_URL");
    }

    @Test
    void bothLocalAreReportedSeparately() {
        assertThat(AttributionUrlStartupCheck.problems("http://localhost:8080", "http://localhost:5173"))
                .hasSize(2);
    }

    @Test
    void blankOrNullUrlsAreReported() {
        assertThat(AttributionUrlStartupCheck.problems(null, " ")).hasSize(2);
    }
}
