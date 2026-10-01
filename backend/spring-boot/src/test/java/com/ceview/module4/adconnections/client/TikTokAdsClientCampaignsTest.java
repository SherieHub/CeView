package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdCampaignOption;
import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TikTokAdsClientCampaignsTest {

    private MockWebServer server;
    private TikTokAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = TikTokAdsClientCampaignsTest.class
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
    void parsesIdNameAndStatus() throws Exception {
        server.enqueue(json(fixture("tiktok-campaigns.json")));

        List<AdCampaignOption> campaigns = client.listCampaigns("TOKEN", "7000000000000000001");

        assertEquals(2, campaigns.size());
        assertEquals("1790000000000000001", campaigns.get(0).id());
        assertEquals("Dry-Season Promo", campaigns.get(0).name());
        assertEquals("ENABLE", campaigns.get(0).status());
    }

    @Test
    void sendsTheAdvertiserIdAndTokenHeader() throws Exception {
        server.enqueue(json(fixture("tiktok-campaigns.json")));

        client.listCampaigns("TOKEN", "7000000000000000001");

        RecordedRequest request = server.takeRequest();
        String path = java.net.URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/campaign/get/"), path);
        assertTrue(path.contains("advertiser_id=7000000000000000001"), path);
        assertEquals("TOKEN", request.getHeader("Access-Token"));
    }

    @Test
    void surfacesANonZeroCodeAsAPlatformException() throws Exception {
        server.enqueue(json("{\"code\":40001,\"message\":\"Invalid advertiser_id\"}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.listCampaigns("TOKEN", "bad"));
        assertTrue(e.getMessage().contains("40001"), e.getMessage());
    }
}
