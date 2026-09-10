package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientInsightsTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static final LocalDate START = LocalDate.of(2026, 8, 31);
    private static final LocalDate END   = LocalDate.of(2026, 9, 6);

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientInsightsTest.class
                .getResourceAsStream("/adplatform/" + name)) {
            assertNotNull(in, "missing test fixture: " + name);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private MockResponse json(String body) {
        return new MockResponse().setResponseCode(200)
                .setHeader("Content-Type", "application/json").setBody(body);
    }

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();

        AdProviderProperties props = new AdProviderProperties();
        props.getMeta().setAppId("APP123");
        props.getMeta().setAppSecret("SECRET456");
        props.setRedirectBaseUrl("https://tunnel.example.com");

        String base = server.url("/v21.0").toString();
        client = new MetaAdsClient(props, base, base + "/dialog/oauth");
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void parsesStringEncodedNumbers() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertEquals(48210L, data.impressions());
        assertEquals(1327L, data.clicks());
        assertEquals(0, new BigDecimal("4820.55").compareTo(data.spend()));
    }

    @Test
    void countsOnlyConversionActionTypes() throws Exception {
        // 34 pixel leads + 11 pixel purchases = 45. post_engagement (2210) and
        // link_click (1327) are NOT conversions — counting them would inflate
        // the figure by two orders of magnitude.
        server.enqueue(json(fixture("meta-insights.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertEquals(45L, data.conversions());
    }

    @Test
    void keepsTheRawPayloadForDiagnosis() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertNotNull(data.rawResponse());
        assertTrue(data.rawResponse().contains("offsite_conversion"), data.rawResponse());
    }

    @Test
    void requestsAccountLevelDataForTheExactDateRange() throws Exception {
        server.enqueue(json(fixture("meta-insights.json")));

        client.fetchInsights("TOKEN", "act_111", START, END);

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/act_111/insights"), path);
        assertTrue(path.contains("level=account"), path);
        assertTrue(path.contains("\"since\":\"2026-08-31\""), path);
        assertTrue(path.contains("\"until\":\"2026-09-06\""), path);
        assertTrue(path.contains("access_token=TOKEN"), path);
    }

    @Test
    void returnsZeroesForAnAccountWithNoSpendInThePeriod() throws Exception {
        // A brand-new ad account behaves exactly like this. It is not an error,
        // and the UI must be able to say "connected, no data for this period".
        server.enqueue(json(fixture("meta-insights-empty.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "act_111", START, END);

        assertEquals(0L, data.impressions());
        assertEquals(0L, data.clicks());
        assertEquals(0, BigDecimal.ZERO.compareTo(data.spend()));
        assertEquals(0L, data.conversions());
    }

    @Test
    void surfacesAnUnparseableSpendAsAPlatformException() throws Exception {
        // "spend" present but garbage is a real anomaly, not a legitimate zero.
        // Silently reporting 0 here would be indistinguishable from "no spend",
        // and spend drives ROAS — this must fail loudly instead.
        String body = """
                {
                  "data": [
                    {
                      "impressions": "100",
                      "clicks": "10",
                      "spend": "N/A",
                      "actions": []
                    }
                  ],
                  "paging": { "cursors": { "before": "MAZDZD", "after": "MAZDZD" } }
                }
                """;
        server.enqueue(json(body));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.fetchInsights("TOKEN", "act_111", START, END));
        assertTrue(e.getMessage().contains("N/A"), e.getMessage());
    }

    @Test
    void surfacesAnExpiredTokenAsAPlatformException() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(401)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"error\":{\"message\":\"Session has expired\",\"code\":190}}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.fetchInsights("STALE", "act_111", START, END));
        assertTrue(e.getMessage().contains("Session has expired"), e.getMessage());
    }
}
