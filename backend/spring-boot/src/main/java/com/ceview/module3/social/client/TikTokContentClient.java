package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * TikTok for Developers — Login Kit + Content Posting API credentials for publishing.
 *
 * <p>This is NOT the TikTok For Business ads app ({@code TikTokAdsClient}); it is a separate
 * developer app with its own client key/secret ({@code ceview.social.tiktok.*}).
 * Token <em>refresh</em> arrives with publishing (Phase 3): access tokens last about a day.
 */
@Component
public class TikTokContentClient {

    private static final Logger log = LoggerFactory.getLogger(TikTokContentClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    /** Login Kit identity + Content Posting API (inbox upload) + reading the creator's videos. */
    public static final String SCOPE = "user.info.basic,video.upload,video.list";

    /** A creator login's tokens. {@code toString} never prints them. */
    public record CreatorGrant(String accessToken, String refreshToken,
                               OffsetDateTime accessExpiresAt, OffsetDateTime refreshExpiresAt,
                               String openId, String scopes) {
        @Override
        public String toString() {
            return "CreatorGrant[openId=" + openId + ", scopes=" + scopes + "]";
        }
    }

    private final String clientKey;
    private final String clientSecret;
    private final String apiBaseUrl;
    private final String authorizeUrl;
    private final String redirectBaseUrl;
    private final WebClient http = WebClient.builder().build();
    private final ObjectMapper mapper = new ObjectMapper();

    public TikTokContentClient(
            @Value("${ceview.social.tiktok.client-key:}") String clientKey,
            @Value("${ceview.social.tiktok.client-secret:}") String clientSecret,
            @Value("${ceview.social.tiktok.api-base-url:https://open.tiktokapis.com}") String apiBaseUrl,
            @Value("${ceview.social.tiktok.authorize-url:https://www.tiktok.com/v2/auth/authorize/}") String authorizeUrl,
            @Value("${ceview.adplatform.redirect-base-url:}") String redirectBaseUrl) {
        this.clientKey = clientKey;
        this.clientSecret = clientSecret;
        this.apiBaseUrl = apiBaseUrl;
        this.authorizeUrl = authorizeUrl;
        this.redirectBaseUrl = redirectBaseUrl;
    }

    public boolean isConfigured() {
        return notBlank(clientKey) && notBlank(clientSecret);
    }

    /** The exact redirect URI that must also be registered in the TikTok developer portal. */
    public String callbackUrl() {
        String base = redirectBaseUrl.endsWith("/")
                ? redirectBaseUrl.substring(0, redirectBaseUrl.length() - 1) : redirectBaseUrl;
        return base + "/api/social-connections/tiktok/callback";
    }

    public String buildAuthorizeUrl(String state) {
        // Pre-encode each value, then tell the builder not to re-encode (see MetaAdsClient for why).
        return UriComponentsBuilder.fromUriString(authorizeUrl)
                .queryParam("client_key", encode(clientKey))
                .queryParam("scope", encode(SCOPE))
                .queryParam("response_type", "code")
                .queryParam("redirect_uri", encode(callbackUrl()))
                .queryParam("state", encode(state))
                .build(true)
                .toUriString();
    }

    public CreatorGrant exchangeCode(String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_key", clientKey);
        form.add("client_secret", clientSecret);
        form.add("code", code);
        form.add("grant_type", "authorization_code");
        form.add("redirect_uri", callbackUrl());

        String body;
        try {
            // exchangeToMono: TikTok reports OAuth failures as a JSON body on a 4xx — read it either way.
            body = http.post().uri(apiBaseUrl + "/v2/oauth/token/")
                    .body(BodyInserters.fromFormData(form))
                    .exchangeToMono(response -> response.bodyToMono(String.class))
                    .block(TIMEOUT);
        } catch (Exception e) {
            // Deliberately omits the request — it carries the client secret and the code.
            throw new SocialPlatformException("TikTok token call failed: " + e.getClass().getSimpleName(), e);
        }

        JsonNode json = parse(body);
        String error = text(json, "error");
        if (error != null && !error.isBlank()) {
            String description = text(json, "error_description");
            throw new SocialPlatformException("TikTok rejected the authorization: "
                    + (description != null ? description : error));
        }
        String accessToken = text(json, "access_token");
        if (accessToken == null) {
            throw new SocialPlatformException("TikTok returned no access token");
        }
        return new CreatorGrant(
                accessToken,
                text(json, "refresh_token"),
                expiry(json, "expires_in"),
                expiry(json, "refresh_expires_in"),
                text(json, "open_id"),
                text(json, "scope"));
    }

    /** The creator's display name, or null if the lookup fails (never fatal to the connection). */
    public String fetchDisplayName(String accessToken) {
        try {
            String body = http.get().uri(apiBaseUrl + "/v2/user/info/?fields=open_id,display_name")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve().bodyToMono(String.class).block(TIMEOUT);
            return text(parse(body).path("data").path("user"), "display_name");
        } catch (Exception e) {
            log.warn("[Module3] TikTok profile lookup failed: {}", e.getClass().getSimpleName());
            return null;
        }
    }

    private JsonNode parse(String body) {
        try {
            return mapper.readTree(body == null ? "{}" : body);
        } catch (Exception e) {
            throw new SocialPlatformException("TikTok returned a non-JSON response", e);
        }
    }

    private static OffsetDateTime expiry(JsonNode json, String field) {
        JsonNode seconds = json.get(field);
        return seconds != null && seconds.isNumber() ? OffsetDateTime.now().plusSeconds(seconds.asLong()) : null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
