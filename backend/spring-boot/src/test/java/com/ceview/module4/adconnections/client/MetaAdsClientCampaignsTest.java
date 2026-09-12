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

class MetaAdsClientCampaignsTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientCampaignsTest.class.getResourceAsStream("/adplatform/" + name)) {
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
    void parsesIdNameAndStatus() throws Exception {
        server.enqueue(json(fixture("meta-campaigns.json")));

        List<AdCampaignOption> campaigns = client.listCampaigns("TOKEN", "act_111");

        assertEquals(2, campaigns.size());
        assertEquals("23851234567890123", campaigns.get(0).id());
        assertEquals("Dry-Season Promo", campaigns.get(0).name());
        assertEquals("ACTIVE", campaigns.get(0).status());
        assertEquals("PAUSED", campaigns.get(1).status());
    }

    @Test
    void requestsTheAccountsCampaignsWithTheTokenAndFields() throws Exception {
        server.enqueue(json(fixture("meta-campaigns.json")));

        client.listCampaigns("TOKEN", "act_111");

        RecordedRequest request = server.takeRequest();
        String path = java.net.URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8);
        assertTrue(path.contains("/act_111/campaigns"), path);
        assertTrue(path.contains("fields=id,name,status"), path);
        assertTrue(path.contains("access_token=TOKEN"), path);
    }

    @Test
    void surfacesAnApiErrorAsAPlatformException() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(400)
                .setHeader("Content-Type", "application/json")
                .setBody("{\"error\":{\"message\":\"Unsupported get request\",\"code\":100}}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.listCampaigns("TOKEN", "act_111"));
        assertTrue(e.getMessage().contains("Unsupported get request"), e.getMessage());
    }
}
