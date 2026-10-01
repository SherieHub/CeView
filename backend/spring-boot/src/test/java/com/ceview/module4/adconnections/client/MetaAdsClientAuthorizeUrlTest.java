package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import org.junit.jupiter.api.Test;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class MetaAdsClientAuthorizeUrlTest {

    private MetaAdsClient client(String appId) {
        AdProviderProperties props = new AdProviderProperties();
        props.getMeta().setAppId(appId);
        props.getMeta().setAppSecret("secret");
        props.setRedirectBaseUrl("https://tunnel.example.com");
        return new MetaAdsClient(props, "https://graph.facebook.com/v21.0",
                                 "https://www.facebook.com/v21.0/dialog/oauth");
    }

    @Test
    void includesAppIdRedirectStateAndScope() {
        String url = client("APP123").buildAuthorizeUrl("state-token-abc");
        String decoded = URLDecoder.decode(url, StandardCharsets.UTF_8);

        assertTrue(decoded.startsWith("https://www.facebook.com/v21.0/dialog/oauth?"), decoded);
        assertTrue(decoded.contains("client_id=APP123"), decoded);
        assertTrue(decoded.contains("state=state-token-abc"), decoded);
        assertTrue(decoded.contains("scope=ads_read"), decoded);
        assertTrue(decoded.contains(
                "redirect_uri=https://tunnel.example.com/api/ad-connections/meta/callback"), decoded);
    }

    @Test
    void urlEncodesTheRedirectUri() {
        // The raw URL must not contain a bare "://" inside the redirect_uri value,
        // or Meta rejects the request with an unhelpful "URL blocked" error.
        String url = client("APP123").buildAuthorizeUrl("s");
        assertTrue(url.contains("redirect_uri=https%3A%2F%2Ftunnel.example.com"), url);
    }

    @Test
    void urlEncodesTheStateValueToo() {
        // State tokens are often base64-ish and can contain characters that need
        // percent-encoding in a query string — not just redirect_uri.
        String url = client("APP123").buildAuthorizeUrl("a+b&c=d/e");
        String decoded = URLDecoder.decode(url, StandardCharsets.UTF_8);

        assertTrue(url.contains("state=a%2Bb%26c%3Dd%2Fe"), url);
        assertTrue(decoded.contains("state=a+b&c=d/e") || decoded.contains("state=a b&c=d/e"), decoded);
    }

    @Test
    void reportsItsProvider() {
        assertEquals(AdProvider.META, client("APP123").provider());
    }
}
