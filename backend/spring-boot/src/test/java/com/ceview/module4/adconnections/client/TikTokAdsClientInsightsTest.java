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

class TikTokAdsClientInsightsTest {

    private MockWebServer server;
    private TikTokAdsClient client;

    private static final LocalDate START = LocalDate.of(2026, 8, 31);
    private static final LocalDate END   = LocalDate.of(2026, 9, 6);

    private static String fixture(String name) throws Exception {
        try (var in = TikTokAdsClientInsightsTest.class
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
        props.getTiktok().setAppId("TTAPP");
        props.getTiktok().setAppSecret("TTSECRET");
        props.setRedirectBaseUrl("https://tunnel.example.com");

        String base = server.url("/open_api/v1.3").toString();
        client = new TikTokAdsClient(props, base, server.url("/portal/auth").toString());
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    @Test
    void parsesTheMetricsBlock() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "7000000000000000001", START, END);

        assertEquals(31204L, data.impressions());
        assertEquals(894L, data.clicks());
        assertEquals(0, new BigDecimal("1250.75").compareTo(data.spend()));
        assertEquals(22L, data.conversions());
    }

    @Test
    void requestsAdvertiserLevelBasicReportForTheDateRange() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        client.fetchInsights("TOKEN", "7000000000000000001", START, END);

        RecordedRequest request = server.takeRequest();
        String path = URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/report/integrated/get/"), path);
        assertTrue(path.contains("report_type=BASIC"), path);
        assertTrue(path.contains("data_level=AUCTION_ADVERTISER"), path);
        assertTrue(path.contains("advertiser_id=7000000000000000001"), path);
        assertTrue(path.contains("start_date=2026-08-31"), path);
        assertTrue(path.contains("end_date=2026-09-06"), path);
        assertEquals("TOKEN", request.getHeader("Access-Token"));
    }

    @Test
    void returnsZeroesForAPeriodWithNoSpend() throws Exception {
        server.enqueue(json(fixture("tiktok-report-empty.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "700", START, END);

        assertEquals(0L, data.impressions());
        assertEquals(0, BigDecimal.ZERO.compareTo(data.spend()));
    }

    @Test
    void treatsANonZeroCodeAsAnError() throws Exception {
        server.enqueue(json("{\"code\":40002,\"message\":\"Advertiser not authorized\",\"data\":{}}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.fetchInsights("TOKEN", "700", START, END));
        assertTrue(e.getMessage().contains("Advertiser not authorized"), e.getMessage());
    }

    @Test
    void surfacesAnUnparseableSpendAsAPlatformException() throws Exception {
        // "spend" present but garbage is a real anomaly, not a legitimate zero.
        // Silently reporting 0 here would be indistinguishable from "no spend",
        // and spend drives ROAS — this must fail loudly instead.
        String body = """
                {
                  "code": 0,
                  "message": "OK",
                  "data": {
                    "list": [
                      {
                        "dimensions": { "advertiser_id": "700" },
                        "metrics": {
                          "impressions": "100",
                          "clicks": "10",
                          "spend": "N/A",
                          "conversion": "1"
                        }
                      }
                    ]
                  }
                }
                """;
        server.enqueue(json(body));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.fetchInsights("TOKEN", "700", START, END));
        assertTrue(e.getMessage().contains("spend"), e.getMessage());
    }

    @Test
    void keepsTheRawPayload() throws Exception {
        server.enqueue(json(fixture("tiktok-report.json")));

        AdInsightData data = client.fetchInsights("TOKEN", "700", START, END);

        assertTrue(data.rawResponse().contains("impressions"), data.rawResponse());
    }
}
