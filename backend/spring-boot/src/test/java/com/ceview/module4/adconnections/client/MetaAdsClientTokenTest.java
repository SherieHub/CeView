package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdProviderProperties;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientTokenTest {

    private MockWebServer server;
    private MetaAdsClient client;

    private static String fixture(String name) throws Exception {
        try (var in = MetaAdsClientTokenTest.class
                .getResourceAsStream("/adplatform/" + name)) {
            assertNotNull(in, "missing test fixture: " + name);
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private MockResponse json(String body) {
        return new MockResponse()
                .setResponseCode(200)
                .setHeader("Content-Type", "application/json")
                .setBody(body);
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
    void exchangesTheCodeThenUpgradesToALongLivedToken() throws Exception {
        server.enqueue(json(fixture("meta-token.json")));
        server.enqueue(json(fixture("meta-long-lived-token.json")));

        TokenGrant grant = client.exchangeCode("AUTH-CODE-1");

        assertEquals("EAAlong-lived-token", grant.accessToken());
        assertNull(grant.refreshToken(), "Meta issues no refresh token");
        assertNotNull(grant.expiresAt());
        assertTrue(grant.expiresAt().isAfter(OffsetDateTime.now().plusDays(50)),
                   "long-lived token should be ~60 days out");
        assertEquals("ads_read", grant.scopes());
    }

    @Test
    void sendsTheCodeAppCredentialsAndRedirectUri() throws Exception {
        server.enqueue(json(fixture("meta-token.json")));
        server.enqueue(json(fixture("meta-long-lived-token.json")));

        client.exchangeCode("AUTH-CODE-1");

        RecordedRequest first = server.takeRequest();
        String path = first.getPath();
        assertTrue(path.contains("/oauth/access_token"), path);
        assertTrue(path.contains("client_id=APP123"), path);
        assertTrue(path.contains("client_secret=SECRET456"), path);
        assertTrue(path.contains("code=AUTH-CODE-1"), path);
        // The redirect_uri must match the one used at authorize time exactly,
        // or Meta rejects the exchange.
        assertTrue(path.contains("redirect_uri="), path);
    }

    @Test
    void requestsTheLongLivedTokenWithTheFbExchangeGrant() throws Exception {
        server.enqueue(json(fixture("meta-token.json")));
        server.enqueue(json(fixture("meta-long-lived-token.json")));

        client.exchangeCode("AUTH-CODE-1");
        server.takeRequest();
        RecordedRequest second = server.takeRequest();

        String path = second.getPath();
        assertTrue(path.contains("grant_type=fb_exchange_token"), path);
        assertTrue(path.contains("fb_exchange_token=EAAshort-lived-token"), path);
    }

    @Test
    void throwsWithMetasMessageOnAnOauthError() throws Exception {
        server.enqueue(new MockResponse()
                .setResponseCode(400)
                .setHeader("Content-Type", "application/json")
                .setBody(fixture("meta-error.json")));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.exchangeCode("REUSED-CODE"));
        assertTrue(e.getMessage().contains("authorization code has been used"), e.getMessage());
    }

    @Test
    void neverPutsTheAppSecretInTheExceptionMessage() throws Exception {
        server.enqueue(new MockResponse().setResponseCode(500).setBody("boom"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.exchangeCode("CODE"));
        assertFalse(e.getMessage().contains("SECRET456"), e.getMessage());
    }

    @Test
    void urlEncodesAnAuthorizationCodeContainingReservedQueryCharacters() throws Exception {
        // Real OAuth codes are base64url-ish and can contain "+", "/", "=".
        // UriComponentsBuilder's build(true) treats query values as already
        // encoded, so an unencoded "=" here is rejected outright by its own
        // verification (IllegalArgumentException) before any request is even
        // sent, and "+"/"/" would otherwise reach Meta corrupted (e.g. "+"
        // read back as a literal space). The code must be percent-encoded
        // before it is added as a query param.
        server.enqueue(json(fixture("meta-token.json")));
        server.enqueue(json(fixture("meta-long-lived-token.json")));

        client.exchangeCode("AUTH+CODE/1=");

        RecordedRequest first = server.takeRequest();
        String path = first.getPath();
        assertTrue(path.contains("code=AUTH%2BCODE%2F1%3D"), path);
        assertFalse(path.contains("code=AUTH+CODE/1="), path);
    }

    @Test
    void throwsInsteadOfNpeWhenMetaOmitsTheAccessToken() throws Exception {
        // A 200 response with no access_token field must fail loudly, not NPE.
        server.enqueue(json("{\"token_type\":\"bearer\"}"));

        AdPlatformException e = assertThrows(AdPlatformException.class,
                () -> client.exchangeCode("AUTH-CODE-1"));
        assertTrue(e.getMessage().contains("access_token"), e.getMessage());
    }

    @Test
    void returnsAGrantWithNoExpiryWhenExpiresInIsAbsent() throws Exception {
        server.enqueue(json("{\"access_token\":\"EAAshort-lived-token\"}"));
        server.enqueue(json("{\"access_token\":\"EAAlong-lived-token\"}"));

        TokenGrant grant = client.exchangeCode("AUTH-CODE-1");

        assertEquals("EAAlong-lived-token", grant.accessToken());
        assertNull(grant.expiresAt(), "missing expires_in should leave expiresAt null, not error");
    }
}
