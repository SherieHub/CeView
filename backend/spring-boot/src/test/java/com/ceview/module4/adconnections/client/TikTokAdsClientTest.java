package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TikTokAdsClientTest {

    private MockWebServer server;
    private TikTokAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = TikTokAdsClientTest.class.getResourceAsStream("/adplatform/" + name)) {
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
    void reportsItsProvider() {
        assertEquals(AdProvider.TIKTOK, client.provider());
    }

    @Test
    void buildsAnAuthorizeUrlWithAppIdStateAndRedirect() {
        String url = URLDecoder.decode(client.buildAuthorizeUrl("state-abc"), StandardCharsets.UTF_8);

        assertTrue(url.contains("app_id=TTAPP"), url);
        assertTrue(url.contains("state=state-abc"), url);
        assertTrue(url.contains(
                "redirect_uri=https://tunnel.example.com/api/ad-connections/tiktok/callback"), url);
    }

    @Test
    void exchangesTheAuthCodeForAnAccessAndRefreshToken() throws Exception {
        server.enqueue(json(fixture("tiktok-token.json")));

        TokenGrant grant = client.exchangeCode("AUTH-CODE");

        assertEquals("tiktok-access-token-value", grant.accessToken());
        assertEquals("tiktok-refresh-token-value", grant.refreshToken());
        assertNotNull(grant.expiresAt());
    }

    @Test
    void postsTheAppCredentialsAndAuthCodeAsJson() throws Exception {
        server.enqueue(json(fixture("tiktok-token.json")));

        client.exchangeCode("AUTH-CODE");

        RecordedRequest request = server.takeRequest();
        assertEquals("POST", request.getMethod());
        assertTrue(request.getPath().contains("/oauth2/access_token/"), request.getPath());

        String body = request.getBody().readUtf8();
        assertTrue(body.contains("\"app_id\":\"TTAPP\""), body);
        assertTrue(body.contains("\"secret\":\"TTSECRET\""), body);
        assertTrue(body.contains("\"auth_code\":\"AUTH-CODE\""), body);
        assertTrue(body.contains("\"grant_type\":\"auth_code\""), body);
    }

    @Test
    void treatsANonZeroCodeAsAnErrorEvenOnHttp200() throws Exception {
        // This is the trap: TikTok answers 200 with an error envelope. Checking
        // only the HTTP status would accept a failure as success.
        server.enqueue(json(fixture("tiktok-error.json")));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.exchangeCode("STALE-CODE"));
        assertTrue(e.getMessage().contains("auth_code is invalid"), e.getMessage());
        assertTrue(e.getMessage().contains("40001"), e.getMessage());
    }

    @Test
    void listsAdvertisersWithTheirCurrency() throws Exception {
        server.enqueue(json(fixture("tiktok-advertisers.json")));
        server.enqueue(json(fixture("tiktok-advertiser-info.json")));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(2, accounts.size());
        assertEquals("7000000000000000001", accounts.get(0).id());
        assertEquals("Cebu Dive Co.", accounts.get(0).name());
        assertEquals("PHP", accounts.get(0).currency());
        assertEquals("USD", accounts.get(1).currency());
    }

    @Test
    void sendsTheTokenInTheAccessTokenHeaderNotAsABearer() throws Exception {
        server.enqueue(json(fixture("tiktok-advertisers.json")));
        server.enqueue(json(fixture("tiktok-advertiser-info.json")));

        client.listAccounts("TOKEN");

        RecordedRequest request = server.takeRequest();
        assertEquals("TOKEN", request.getHeader("Access-Token"));
        assertNull(request.getHeader("Authorization"));
    }

    @Test
    void stillListsAdvertisersWhenTheCurrencyLookupFails() throws Exception {
        // Losing the currency is a degraded result, not a reason to block the
        // operator from choosing an account.
        server.enqueue(json(fixture("tiktok-advertisers.json")));
        server.enqueue(json("{\"code\":40100,\"message\":\"No permission\",\"data\":{}}"));

        List<AdAccountOption> accounts = client.listAccounts("TOKEN");

        assertEquals(2, accounts.size());
        assertNull(accounts.get(0).currency());
    }

    @Test
    void returnsAnEmptyListWhenTheGrantHasNoAdvertisers() throws Exception {
        server.enqueue(json("{\"code\":0,\"message\":\"OK\",\"data\":{\"list\":[]}}"));

        assertTrue(client.listAccounts("TOKEN").isEmpty());
    }
}
