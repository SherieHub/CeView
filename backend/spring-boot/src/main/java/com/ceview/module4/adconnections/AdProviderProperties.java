package com.ceview.module4.adconnections;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Credentials and URLs for the ad-platform OAuth flow, bound from
 * {@code ceview.adplatform.*} in application.yml.
 *
 * <p>Every value has an empty-string default so the application starts without
 * ad credentials configured — {@link #isConfigured} is what decides whether a
 * provider's endpoints do anything, mirroring how {@code FirebaseConfiguredCondition}
 * treats a blank credentials JSON.
 */
@Component
@ConfigurationProperties(prefix = "ceview.adplatform")
public class AdProviderProperties {

    /** Public HTTPS base that the platforms redirect back to — a tunnel URL in local dev. */
    private String redirectBaseUrl = "";

    /** Where the callback sends the browser once the grant is stored. */
    private String frontendBaseUrl = "";

    private final Credentials meta = new Credentials();
    private final Credentials tiktok = new Credentials();

    public static class Credentials {
        private String appId = "";
        private String appSecret = "";

        public String getAppId() { return appId; }
        public void setAppId(String appId) { this.appId = appId; }
        public String getAppSecret() { return appSecret; }
        public void setAppSecret(String appSecret) { this.appSecret = appSecret; }
    }

    public Credentials forProvider(AdProvider provider) {
        return provider == AdProvider.META ? meta : tiktok;
    }

    public boolean isConfigured(AdProvider provider) {
        Credentials c = forProvider(provider);
        return notBlank(c.getAppId()) && notBlank(c.getAppSecret());
    }

    /** The exact redirect URI that must also be registered with the platform. */
    public String callbackUrl(AdProvider provider) {
        String base = redirectBaseUrl.endsWith("/")
                ? redirectBaseUrl.substring(0, redirectBaseUrl.length() - 1)
                : redirectBaseUrl;
        return base + "/api/ad-connections/" + provider.key() + "/callback";
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    public String getRedirectBaseUrl() { return redirectBaseUrl; }
    public void setRedirectBaseUrl(String v) { this.redirectBaseUrl = v; }
    public String getFrontendBaseUrl() { return frontendBaseUrl; }
    public void setFrontendBaseUrl(String v) { this.frontendBaseUrl = v; }
    public Credentials getMeta() { return meta; }
    public Credentials getTiktok() { return tiktok; }
}
