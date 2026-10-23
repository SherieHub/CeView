package com.ceview.module4.adconnections.client;

import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MetaTargetingClientTest {
    MockWebServer server;
    MetaTargetingClient client;

    @BeforeEach void setup() throws Exception {
        server = new MockWebServer();
        server.start();
        client = new MetaTargetingClient(server.url("").toString());
    }
    @AfterEach void close() throws Exception { server.shutdown(); }

    void json(String body) {
        server.enqueue(new MockResponse().setHeader("Content-Type", "application/json").setBody(body));
    }

    @Test void awarenessUsesTheImpressionsMinimumAndSendsTheTokenAsABearerHeader() throws Exception {
        json("{\"data\":[{\"currency\":\"PHP\",\"min_daily_budget_imp\":\"2150\",\"min_daily_budget_high_freq\":6332}]}");

        var minimum = client.minimumDailyBudget("tok", "123", "OUTCOME_AWARENESS");

        assertThat(minimum).contains(new MetaTargetingClient.MinimumBudget("PHP", 2150));
        RecordedRequest request = server.takeRequest();
        assertThat(request.getPath()).isEqualTo("/act_123/minimum_budgets");
        assertThat(request.getHeader("Authorization")).isEqualTo("Bearer tok");
    }

    @Test void trafficAndEngagementUseTheHighFrequencyMinimum() {
        json("{\"data\":[{\"currency\":\"PHP\",\"min_daily_budget_imp\":2150,\"min_daily_budget_high_freq\":6332}]}");
        json("{\"data\":[{\"currency\":\"PHP\",\"min_daily_budget_imp\":2150,\"min_daily_budget_high_freq\":6332}]}");

        assertThat(client.minimumDailyBudget("tok", "123", "OUTCOME_TRAFFIC").orElseThrow().minDailyMinor()).isEqualTo(6332);
        assertThat(client.minimumDailyBudget("tok", "123", "OUTCOME_ENGAGEMENT").orElseThrow().minDailyMinor()).isEqualTo(6332);
    }

    @Test void noMinimumIsReportedWhenMetaReturnsNone() {
        json("{\"data\":[]}");
        assertThat(client.minimumDailyBudget("tok", "123", "OUTCOME_TRAFFIC")).isEqualTo(Optional.empty());
    }

    @Test void interestSearchReturnsIdNameAndPathAndEncodesTheQuery() throws Exception {
        json("{\"data\":[{\"id\":\"6003020834693\",\"name\":\"Scuba diving\",\"path\":[\"Interests\",\"Sports and outdoors\"]},"
                + "{\"id\":\"6003139266461\",\"name\":\"Snorkeling\"}]}");

        List<MetaTargetingClient.InterestOption> found = client.searchInterests("tok", "scuba & dive");

        assertThat(found).containsExactly(
                new MetaTargetingClient.InterestOption("6003020834693", "Scuba diving", "Interests › Sports and outdoors"),
                new MetaTargetingClient.InterestOption("6003139266461", "Snorkeling", ""));
        RecordedRequest request = server.takeRequest();
        assertThat(request.getPath()).startsWith("/search?type=adinterest&q=scuba%20%26%20dive&limit=10");
    }

    @Test void onlyIdsMetaMarksInvalidAreReported() throws Exception {
        json("{\"data\":[{\"id\":\"1\",\"valid\":true},{\"id\":\"2\",\"valid\":false},{\"id\":\"3\"}]}");

        Set<String> invalid = client.invalidInterestIds("tok", List.of("1", "2", "3"));

        assertThat(invalid).containsExactly("2");
        RecordedRequest request = server.takeRequest();
        assertThat(request.getPath()).startsWith("/search?type=adinterestvalid&interest_fbid_list=");
        assertThat(java.net.URLDecoder.decode(request.getPath(), java.nio.charset.StandardCharsets.UTF_8))
                .contains("interest_fbid_list=[\"1\",\"2\",\"3\"]");
    }

    @Test void localeKeyMatchesTheExactNameIgnoringCase() {
        json("{\"data\":[{\"key\":12,\"name\":\"Korean (Archaic)\"},{\"key\":26,\"name\":\"korean\"}]}");
        assertThat(client.localeKey("tok", "Korean")).contains("26");

        json("{\"data\":[{\"key\":1,\"name\":\"Koreanish\"}]}");
        assertThat(client.localeKey("tok", "Korean")).isEqualTo(Optional.empty());
    }

    @Test void failuresSurfaceAsAPlatformExceptionThatNeverCarriesTheToken() {
        server.enqueue(new MockResponse().setResponseCode(400).setBody("{\"error\":{\"message\":\"Invalid OAuth access token.\"}}"));

        assertThatThrownBy(() -> client.searchInterests("super-secret-token", "diving"))
                .isInstanceOf(AdPlatformException.class)
                .satisfies(e -> assertThat(e.getMessage()).contains("Invalid OAuth access token.").doesNotContain("super-secret-token"));
    }
}
