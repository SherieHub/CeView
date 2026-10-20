package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.ceview.module3.social.client.TikTokContentClient.CreatorGrant;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TikTokContentClientTest {

    private MockWebServer server;
    private TikTokContentClient client;

    @BeforeEach
    void setUp() throws Exception {
        server = new MockWebServer();
        server.start();
        String base = server.url("").toString().replaceAll("/$", "");
        client = new TikTokContentClient("KEY123", "SECRET456", base, base + "/v2/auth/authorize/",
                "https://tunnel.example.com");
    }

    @AfterEach
    void tearDown() throws Exception {
        server.shutdown();
    }

    private static MockResponse json(int code, String body) {
        return new MockResponse().setResponseCode(code).setHeader("Content-Type", "application/json").setBody(body);
    }

    @Test
    void isConfiguredOnlyWithBothCredentials() {
        assertThat(client.isConfigured()).isTrue();
        assertThat(new TikTokContentClient("", "S", "http://x", "http://x/a", "https://t").isConfigured()).isFalse();
        assertThat(new TikTokContentClient("K", "", "http://x", "http://x/a", "https://t").isConfigured()).isFalse();
    }

    @Test
    void callbackUrlIsTheSocialConnectionsEndpoint() {
        assertThat(client.callbackUrl())
                .isEqualTo("https://tunnel.example.com/api/social-connections/tiktok/callback");
    }

    @Test
    void authorizeUrlCarriesKeyScopesRedirectAndState() {
        String url = URLDecoder.decode(client.buildAuthorizeUrl("STATE-1"), StandardCharsets.UTF_8);

        assertThat(url).contains("/v2/auth/authorize/?");
        assertThat(url).contains("client_key=KEY123");
        assertThat(url).contains("scope=user.info.basic,video.upload,video.list");
        assertThat(url).contains("response_type=code");
        assertThat(url).contains("redirect_uri=https://tunnel.example.com/api/social-connections/tiktok/callback");
        assertThat(url).contains("state=STATE-1");
        assertThat(url).doesNotContain("SECRET456");
    }

    @Test
    void exchangesTheCodeForATokenAndRecordsLifetimes() throws Exception {
        server.enqueue(json(200, """
            {"access_token":"ACCESS-1","expires_in":86400,"open_id":"OPEN-1",
             "refresh_token":"REFRESH-1","refresh_expires_in":31536000,
             "scope":"user.info.basic,video.upload","token_type":"Bearer"}"""));

        CreatorGrant grant = client.exchangeCode("CODE-1");

        assertThat(grant.accessToken()).isEqualTo("ACCESS-1");
        assertThat(grant.refreshToken()).isEqualTo("REFRESH-1");
        assertThat(grant.openId()).isEqualTo("OPEN-1");
        assertThat(grant.scopes()).isEqualTo("user.info.basic,video.upload");
        assertThat(grant.accessExpiresAt()).isNotNull();
        assertThat(grant.refreshExpiresAt()).isAfter(grant.accessExpiresAt());

        RecordedRequest request = server.takeRequest();
        assertThat(request.getMethod()).isEqualTo("POST");
        assertThat(request.getPath()).isEqualTo("/v2/oauth/token/");
        assertThat(request.getHeader("Content-Type")).startsWith("application/x-www-form-urlencoded");
        String body = URLDecoder.decode(request.getBody().readUtf8(), StandardCharsets.UTF_8);
        assertThat(body).contains("client_key=KEY123").contains("client_secret=SECRET456")
                .contains("code=CODE-1").contains("grant_type=authorization_code")
                .contains("redirect_uri=https://tunnel.example.com/api/social-connections/tiktok/callback");
    }

    @Test
    void anErrorBodyBecomesAnExceptionWithoutLeakingSecrets() {
        server.enqueue(json(400, "{\"error\":\"invalid_grant\",\"error_description\":\"Authorization code is expired.\"}"));

        assertThatThrownBy(() -> client.exchangeCode("CODE-1"))
                .isInstanceOf(SocialPlatformException.class)
                .hasMessageContaining("Authorization code is expired")
                .satisfies(e -> assertThat(e.getMessage()).doesNotContain("SECRET456").doesNotContain("CODE-1"));
    }

    @Test
    void aResponseWithoutAnAccessTokenIsAnError() {
        server.enqueue(json(200, "{\"open_id\":\"OPEN-1\"}"));

        assertThatThrownBy(() -> client.exchangeCode("CODE-1")).isInstanceOf(SocialPlatformException.class);
    }

    @Test
    void readsTheDisplayNameWithABearerToken() throws Exception {
        server.enqueue(json(200, "{\"data\":{\"user\":{\"open_id\":\"OPEN-1\",\"display_name\":\"Cebu Dive\"}},\"error\":{\"code\":\"ok\"}}"));

        assertThat(client.fetchDisplayName("ACCESS-1")).isEqualTo("Cebu Dive");

        RecordedRequest request = server.takeRequest();
        assertThat(request.getHeader("Authorization")).isEqualTo("Bearer ACCESS-1");
        assertThat(URLDecoder.decode(request.getPath(), StandardCharsets.UTF_8))
                .startsWith("/v2/user/info/?fields=open_id,display_name");
    }

    @Test
    void aFailedProfileLookupYieldsNullInsteadOfFailingTheConnection() {
        server.enqueue(json(401, "{\"error\":{\"code\":\"access_token_invalid\"}}"));

        assertThat(client.fetchDisplayName("ACCESS-1")).isNull();
    }
}
