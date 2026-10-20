package com.ceview.module3.social.client;

import com.ceview.module3.social.SocialPlatformException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * Meta Graph API calls for publishing: which Facebook Pages the operator administers and
 * which Instagram business account (if any) each is linked to.
 *
 * <p>Builds its own {@link WebClient} with an explicit timeout, like the ad-platform clients.
 * The Graph base URL is injected so tests can point it at a MockWebServer.
 */
@Component
public class MetaGraphClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    /**
     * One administered Page. {@code accessToken} is the Page token CeView publishes with
     * (null if Meta withheld it, i.e. the permission was not granted).
     */
    public record PageInfo(String id, String name, String accessToken,
                           String instagramId, String instagramUsername) {
        /** Never prints the token. */
        @Override
        public String toString() {
            return "PageInfo[id=" + id + ", name=" + name + ", instagramId=" + instagramId + "]";
        }
    }

    private final String graphBaseUrl;
    private final WebClient http = WebClient.builder().build();
    private final ObjectMapper mapper = new ObjectMapper();

    public MetaGraphClient(
            @Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v25.0}") String graphBaseUrl) {
        this.graphBaseUrl = graphBaseUrl;
    }

    /** The Pages this user token administers, with each Page's linked Instagram account. */
    public List<PageInfo> listPages(String userAccessToken) {
        URI uri = UriComponentsBuilder.fromUriString(graphBaseUrl + "/me/accounts")
                .queryParam("fields", encode("id,name,access_token,instagram_business_account{id,username}"))
                .queryParam("limit", 100)
                .queryParam("access_token", encode(userAccessToken))
                .build(true)
                .toUri();

        JsonNode root = get(uri);
        List<PageInfo> pages = new ArrayList<>();
        JsonNode data = root.get("data");
        if (data != null && data.isArray()) {
            for (JsonNode page : data) {
                JsonNode ig = page.get("instagram_business_account");
                pages.add(new PageInfo(
                        text(page, "id"),
                        text(page, "name"),
                        text(page, "access_token"),
                        ig == null ? null : text(ig, "id"),
                        ig == null ? null : text(ig, "username")));
            }
        }
        return pages;
    }

    private JsonNode get(URI uri) {
        String body;
        try {
            body = http.get().uri(uri).retrieve().bodyToMono(String.class).block(TIMEOUT);
        } catch (WebClientResponseException e) {
            String errorBody = e.getResponseBodyAsString();
            throw new SocialPlatformException("Meta API " + e.getStatusCode() + ": "
                    + extractErrorMessage(errorBody), isInvalidTokenError(errorBody), e);
        } catch (Exception e) {
            // Deliberately does not interpolate the URI — it carries the access token.
            throw new SocialPlatformException("Meta API call failed: " + e.getClass().getSimpleName(), e);
        }
        try {
            return mapper.readTree(body == null ? "{}" : body);
        } catch (Exception e) {
            throw new SocialPlatformException("Meta returned a non-JSON response", e);
        }
    }

    /** Graph error code 190: the access token is invalid, expired or revoked. */
    private boolean isInvalidTokenError(String body) {
        try {
            JsonNode error = mapper.readTree(body).get("error");
            return error != null && error.path("code").asInt() == 190;
        } catch (Exception e) {
            return false;
        }
    }

    private String extractErrorMessage(String body) {
        try {
            JsonNode error = mapper.readTree(body).get("error");
            if (error != null && error.get("message") != null) {
                return error.get("message").asText();
            }
        } catch (Exception ignored) {
            // fall through
        }
        return body == null || body.isBlank() ? "(empty body)" : "(unreadable error body)";
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
