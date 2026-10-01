package com.ceview.module4.adconnections;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class AdProviderPropertiesTest {

    private AdProviderProperties props(String metaId, String metaSecret,
                                       String tiktokId, String tiktokSecret) {
        AdProviderProperties p = new AdProviderProperties();
        p.getMeta().setAppId(metaId);
        p.getMeta().setAppSecret(metaSecret);
        p.getTiktok().setAppId(tiktokId);
        p.getTiktok().setAppSecret(tiktokSecret);
        return p;
    }

    @Test
    void reportsConfiguredOnlyWhenBothIdAndSecretArePresent() {
        AdProviderProperties p = props("123", "shh", "456", "");
        assertTrue(p.isConfigured(AdProvider.META));
        assertFalse(p.isConfigured(AdProvider.TIKTOK));
    }

    @Test
    void treatsBlankAsUnconfigured() {
        // application.yml gives these an empty-string default so placeholder
        // resolution succeeds without credentials — blank must not read as set.
        AdProviderProperties p = props("  ", "shh", "", "");
        assertFalse(p.isConfigured(AdProvider.META));
    }

    @Test
    void parsesProviderKeysCaseInsensitivelyAndRejectsUnknown() {
        assertEquals(AdProvider.META, AdProvider.fromKey("meta"));
        assertEquals(AdProvider.TIKTOK, AdProvider.fromKey("TikTok"));
        assertThrows(IllegalArgumentException.class, () -> AdProvider.fromKey("naver"));
    }

    @Test
    void buildsTheCallbackUrlFromTheRedirectBase() {
        AdProviderProperties p = props("1", "2", "3", "4");
        p.setRedirectBaseUrl("https://abc123.ngrok-free.app");
        assertEquals("https://abc123.ngrok-free.app/api/ad-connections/meta/callback",
                     p.callbackUrl(AdProvider.META));
    }

    @Test
    void stripsATrailingSlashFromTheRedirectBase() {
        // A trailing slash produces a double-slash URL that will not match the
        // redirect URI registered with the platform — an error whose message
        // ("URL blocked") does not point at the cause.
        AdProviderProperties p = props("1", "2", "3", "4");
        p.setRedirectBaseUrl("https://abc123.ngrok-free.app/");
        assertEquals("https://abc123.ngrok-free.app/api/ad-connections/tiktok/callback",
                     p.callbackUrl(AdProvider.TIKTOK));
    }
}
