package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * TikTok Business API client.
 *
 * <p>Three behaviours differ sharply from Meta and are handled explicitly:
 * <ul>
 *   <li>Errors arrive as <b>HTTP 200</b> with a non-zero {@code code} field, so
 *       {@link #unwrap} checks the body rather than the status.</li>
 *   <li>The access token travels in an {@code Access-Token} header, not as a
 *       bearer token or query parameter.</li>
 *   <li>Advertiser currency needs a second call to {@code /advertiser/info/}.</li>
 * </ul>
 */
@Component
public class TikTokAdsClient implements AdPlatformClient {

    private static final Logger log = LoggerFactory.getLogger(TikTokAdsClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    private final AdProviderProperties props;
    private final String apiBaseUrl;
    private final String portalAuthUrl;
    private final WebClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public TikTokAdsClient(AdProviderProperties props,
                           @Value("${ceview.adplatform.tiktok.api-base-url:https://business-api.tiktok.com/open_api/v1.3}")
                           String apiBaseUrl,
                           @Value("${ceview.adplatform.tiktok.portal-auth-url:https://business-api.tiktok.com/portal/auth}")
                           String portalAuthUrl) {
        this.props = props;
        this.apiBaseUrl = apiBaseUrl;
        this.portalAuthUrl = portalAuthUrl;
        this.http = WebClient.builder().baseUrl(apiBaseUrl).build();
    }

    @Override
    public AdProvider provider() {
        return AdProvider.TIKTOK;
    }

    @Override
    public String buildAuthorizeUrl(String state) {
        // As in MetaAdsClient.buildAuthorizeUrl: UriComponentsBuilder's query
        // encoding leaves "/" and ":" unescaped (they're legal in the query
        // grammar per RFC 3986), so redirect_uri's "://" would reach TikTok
        // unescaped if we let the builder do the encoding itself. Percent-encode
        // each value fully with URLEncoder first, then build(true) so the
        // builder doesn't try to re-encode (and re-mangle) what's already encoded.
        return UriComponentsBuilder.fromUriString(portalAuthUrl)
                .queryParam("app_id", encode(props.getTiktok().getAppId()))
                .queryParam("state", encode(state))
                .queryParam("redirect_uri", encode(props.callbackUrl(AdProvider.TIKTOK)))
                .build(true)
                .toUriString();
    }

    @Override
    public TokenGrant exchangeCode(String authCode) {
        Map<String, String> body = new HashMap<>();
        body.put("app_id", props.getTiktok().getAppId());
        body.put("secret", props.getTiktok().getAppSecret());
        body.put("auth_code", authCode);
        body.put("grant_type", "auth_code");

        JsonNode data = unwrap(post("/oauth2/access_token/", body));

        String accessToken = text(data, "access_token");
        if (accessToken == null) {
            throw new AdPlatformException("TikTok returned no access_token");
        }

        OffsetDateTime expiresAt = null;
        JsonNode expiresIn = data.get("expires_in");
        if (expiresIn != null && expiresIn.isNumber()) {
            expiresAt = OffsetDateTime.now().plusSeconds(expiresIn.asLong());
        }

        log.info("[Module4] TikTok token exchanged, expires_at={}", expiresAt);
        return new TokenGrant(accessToken, text(data, "refresh_token"), expiresAt,
                              String.valueOf(data.get("scope")));
    }

    @Override
    public List<AdAccountOption> listAccounts(String accessToken) {
        JsonNode data = unwrap(get("/oauth2/advertiser/get/", accessToken, uri -> uri
                .queryParam("app_id", encode(props.getTiktok().getAppId()))
                .queryParam("secret", encode(props.getTiktok().getAppSecret()))));

        List<String> ids = new ArrayList<>();
        Map<String, String> names = new HashMap<>();
        JsonNode list = data.get("list");
        if (list != null && list.isArray()) {
            for (JsonNode advertiser : list) {
                String id = text(advertiser, "advertiser_id");
                if (id == null) continue;
                ids.add(id);
                names.put(id, text(advertiser, "advertiser_name"));
            }
        }
        if (ids.isEmpty()) return List.of();

        Map<String, String> currencies = fetchCurrencies(accessToken, ids);

        List<AdAccountOption> accounts = new ArrayList<>();
        for (String id : ids) {
            accounts.add(new AdAccountOption(id, names.get(id), currencies.get(id)));
        }
        return accounts;
    }

    /**
     * Currency per advertiser. A failure here is logged and swallowed — the
     * operator can still choose an account, they just see no currency until the
     * first sync fills it in.
     */
    private Map<String, String> fetchCurrencies(String accessToken, List<String> ids) {
        Map<String, String> currencies = new HashMap<>();
        try {
            JsonNode data = unwrap(get("/advertiser/info/", accessToken, uri -> uri
                    .queryParam("advertiser_ids", encode(jsonArray(ids)))
                    .queryParam("fields", encode("[\"advertiser_id\",\"name\",\"currency\"]"))));

            JsonNode list = data.get("list");
            if (list != null && list.isArray()) {
                for (JsonNode advertiser : list) {
                    currencies.put(text(advertiser, "advertiser_id"),
                                   text(advertiser, "currency"));
                }
            }
        } catch (AdPlatformException e) {
            log.warn("[Module4] TikTok advertiser currency lookup failed: {}", e.getMessage());
        }
        return currencies;
    }

    /**
     * Advertiser-level totals for one reporting period.
     *
     * <p>{@code data_level=AUCTION_ADVERTISER} with the {@code advertiser_id}
     * dimension collapses every campaign into a single row — the analogue of
     * Meta's {@code level=account}.
     *
     * <p>Unlike Meta, TikTok returns a single {@code conversion} metric, so no
     * action-type filtering is needed. Note the metric name is singular.
     */
    @Override
    public AdInsightData fetchInsights(String accessToken, String advertiserId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        JsonNode envelope = get("/report/integrated/get/", accessToken, uri -> uri
                .queryParam("advertiser_id", encode(advertiserId))
                .queryParam("report_type", encode("BASIC"))
                .queryParam("data_level", encode("AUCTION_ADVERTISER"))
                .queryParam("dimensions", encode("[\"advertiser_id\"]"))
                .queryParam("metrics", encode("[\"impressions\",\"clicks\",\"spend\",\"conversion\"]"))
                .queryParam("start_date", encode(periodStart.toString()))
                .queryParam("end_date", encode(periodEnd.toString()))
                .queryParam("page_size", 100));

        String raw = envelope.toString();
        JsonNode data = unwrap(envelope);

        JsonNode list = data.get("list");
        if (list == null || !list.isArray() || list.isEmpty()) {
            log.info("[Module4] TikTok returned no report rows for {} {}..{}",
                     advertiserId, periodStart, periodEnd);
            return new AdInsightData(0, 0, BigDecimal.ZERO, 0, null, raw);
        }

        JsonNode metrics = list.get(0).path("metrics");
        return new AdInsightData(
                parseLong(text(metrics, "impressions")),
                parseLong(text(metrics, "clicks")),
                parseDecimal(text(metrics, "spend")),
                parseLong(text(metrics, "conversion")),
                null,                        // currency comes from the connection row
                raw);
    }

    // ── HTTP plumbing ────────────────────────────────────────────────────────

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private JsonNode post(String path, Map<String, String> body) {
        try {
            String raw = http.post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(mapper.writeValueAsString(body))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            return parse(raw);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("TikTok API " + e.getStatusCode(), e);
        } catch (AdPlatformException e) {
            throw e;
        } catch (Exception e) {
            throw new AdPlatformException("TikTok API call failed: "
                    + e.getClass().getSimpleName(), e);
        }
    }

    private JsonNode get(String path, String accessToken,
                         java.util.function.UnaryOperator<UriComponentsBuilder> query) {
        try {
            // As in MetaAdsClient.getJson: build the URI from an absolute base
            // (apiBaseUrl + path), not UriComponentsBuilder.fromPath(path) — a
            // bare path with no host, inside this uriBuilder lambda, resolves
            // against localhost rather than the WebClient's configured base URL.
            // Query values are pre-encoded by each call site above and build(true)
            // tells the builder not to re-encode them.
            String raw = http.get()
                    .uri(uriBuilder -> query.apply(UriComponentsBuilder.fromUriString(apiBaseUrl + path))
                            .build(true).toUri())
                    .header("Access-Token", accessToken)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            return parse(raw);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("TikTok API " + e.getStatusCode(), e);
        } catch (AdPlatformException e) {
            throw e;
        } catch (Exception e) {
            throw new AdPlatformException("TikTok API call failed: "
                    + e.getClass().getSimpleName(), e);
        }
    }

    /**
     * Returns {@code data}, or throws if the envelope's {@code code} is non-zero.
     *
     * <p>This is the single most important method in this class: without it,
     * every error is silently treated as an empty success.
     */
    private JsonNode unwrap(JsonNode envelope) {
        int code = envelope.path("code").asInt(-1);
        if (code != 0) {
            String message = envelope.path("message").asText("(no message)");
            throw new AdPlatformException("TikTok API error " + code + ": " + message);
        }
        JsonNode data = envelope.get("data");
        return data == null ? mapper.createObjectNode() : data;
    }

    private JsonNode parse(String raw) {
        try {
            return mapper.readTree(raw == null ? "{}" : raw);
        } catch (Exception e) {
            throw new AdPlatformException("TikTok returned a non-JSON response", e);
        }
    }

    /** TikTok expects list parameters as a JSON array literal in the query string. */
    private static String jsonArray(List<String> values) {
        return "[" + values.stream().map(v -> "\"" + v + "\"")
                .reduce((a, b) -> a + "," + b).orElse("") + "]";
    }

    static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    static long parseLong(String raw) {
        if (raw == null || raw.isBlank()) return 0L;
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    /**
     * Parses {@code spend} specifically. Absent/blank is a legitimate zero, but
     * present-and-garbage is not — silently reporting 0 spend here would be
     * indistinguishable from "no spend", and spend drives ROAS. Mirrors
     * {@code MetaAdsClient.asDecimal}: fail loudly rather than swallow it, unlike
     * {@link #parseLong}, which is used for the less financially critical
     * impressions/clicks/conversion fields and stays silent-zero.
     */
    static BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            throw new AdPlatformException("TikTok returned an unparseable spend value: " + raw, e);
        }
    }
}
