package com.ceview.module4.adconnections.client;

import com.ceview.module4.adconnections.AdConnectionDtos.AdAccountOption;
import com.ceview.module4.adconnections.AdProvider;
import com.ceview.module4.adconnections.AdProviderProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
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
import java.util.List;
import java.util.Set;

/**
 * Meta Graph API client — covers Facebook AND Instagram ad placements, since one
 * Meta ad account runs both.
 *
 * <p>Builds its own {@link WebClient} with an explicit timeout rather than using
 * the shared {@code fastapiClient} bean, following the precedent in
 * {@code module2/submodule21/ExternalMarketDataClient}.
 *
 * <p>The two base URLs are injected so tests can point them at a MockWebServer.
 */
@Component
public class MetaAdsClient implements AdPlatformClient {

    private static final Logger log = LoggerFactory.getLogger(MetaAdsClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    /** Hard stop on cursor-following, independent of row counts — see {@link #listAccounts}. */
    private static final int MAX_PAGES = 10;

    /** Read-only access to ad account performance data. Nothing more is needed. */
    private static final String SCOPE = "ads_read";

    /**
     * Which of Meta's {@code actions} entries count as a conversion.
     *
     * <p>Meta returns every action type in one array — page engagement, link
     * clicks, pixel events. Summing them all would count a single click several
     * times over. These are the types that correspond to what the ingestion form
     * calls "Conversions (leads)".
     *
     * <p>The prefix match is an approximation: it assumes Meta's
     * {@code offsite_conversion.*} and {@code onsite_conversion.*} namespaces
     * stay conversion-only going forward. If Meta ever adds a non-conversion
     * action type under either prefix, this would need to be tightened.
     */
    private static final Set<String> CONVERSION_ACTION_PREFIXES =
            Set.of("offsite_conversion.", "onsite_conversion.");
    private static final Set<String> CONVERSION_ACTION_TYPES =
            Set.of("lead", "purchase", "complete_registration");

    private final AdProviderProperties props;
    private final String graphBaseUrl;
    private final String dialogUrl;
    private final WebClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public MetaAdsClient(AdProviderProperties props,
                         @Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v21.0}")
                         String graphBaseUrl,
                         @Value("${ceview.adplatform.meta.dialog-url:https://www.facebook.com/v21.0/dialog/oauth}")
                         String dialogUrl) {
        this.props = props;
        this.graphBaseUrl = graphBaseUrl;
        this.dialogUrl = dialogUrl;
        this.http = WebClient.builder().baseUrl(graphBaseUrl).build();
    }

    @Override
    public AdProvider provider() {
        return AdProvider.META;
    }

    @Override
    public String buildAuthorizeUrl(String state) {
        // UriComponentsBuilder's query-component encoding treats "/" and ":" as
        // allowed characters (they are, per RFC 3986's query grammar), so it
        // would leave redirect_uri's "://" unescaped and Meta would reject the
        // request as an "URL blocked" error. Percent-encode each value fully
        // with URLEncoder first, then tell the builder not to re-encode.
        return UriComponentsBuilder.fromUriString(dialogUrl)
                .queryParam("client_id", encode(props.getMeta().getAppId()))
                .queryParam("redirect_uri", encode(props.callbackUrl(AdProvider.META)))
                .queryParam("state", encode(state))
                .queryParam("scope", encode(SCOPE))
                .queryParam("response_type", encode("code"))
                .build(true)
                .toUriString();
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    /**
     * Two calls, deliberately hidden behind one method: Meta's code exchange
     * yields a ~1-hour token, which is useless for a nightly sync, so it is
     * immediately traded for the ~60-day long-lived token. Callers only ever
     * see the long-lived one.
     */
    @Override
    public TokenGrant exchangeCode(String code) {
        // As in buildAuthorizeUrl, build(true) tells UriComponentsBuilder that
        // query values are already encoded, so anything that skips explicit
        // encoding goes onto the wire raw. redirect_uri contains "://" and a
        // real OAuth `code` is base64url-ish (can contain "+", "/", "="), and
        // an unencoded "=" inside a query value is flatly rejected by
        // UriComponentsBuilder's own verification (IllegalArgumentException) —
        // confirmed by probing with a code value containing "+/=" before this
        // fix landed. Every value is pre-encoded with URLEncoder for that reason.
        JsonNode shortLived = getJson("/oauth/access_token", uri -> uri
                .queryParam("client_id",     encode(props.getMeta().getAppId()))
                .queryParam("client_secret", encode(props.getMeta().getAppSecret()))
                .queryParam("redirect_uri",  encode(props.callbackUrl(AdProvider.META)))
                .queryParam("code",          encode(code)));

        String shortToken = text(shortLived, "access_token");
        if (shortToken == null) {
            throw new AdPlatformException("Meta returned no access_token for the authorization code");
        }

        JsonNode longLived = getJson("/oauth/access_token", uri -> uri
                .queryParam("grant_type",        encode("fb_exchange_token"))
                .queryParam("client_id",         encode(props.getMeta().getAppId()))
                .queryParam("client_secret",     encode(props.getMeta().getAppSecret()))
                .queryParam("fb_exchange_token", encode(shortToken)));

        String longToken = text(longLived, "access_token");
        if (longToken == null) {
            throw new AdPlatformException("Meta returned no long-lived access_token");
        }

        OffsetDateTime expiresAt = null;
        JsonNode expiresIn = longLived.get("expires_in");
        Long seconds = expiresIn == null ? null
                     : expiresIn.isNumber() ? expiresIn.asLong()
                     : expiresIn.isTextual() ? tryParseLong(expiresIn.asText())
                     : null;
        if (seconds != null) {
            expiresAt = OffsetDateTime.now().plusSeconds(seconds);
        }

        log.info("[Module4] Meta token exchanged, expires_at={}", expiresAt);
        return new TokenGrant(longToken, null, expiresAt, SCOPE);
    }

    /**
     * Every ad account this grant can read, following Meta's cursor paging.
     *
     * <p>An operator with an agency or several businesses genuinely has more
     * than one, and the ordering is not documented as stable — which is why the
     * operator picks rather than the code assuming the first is right.
     */
    @Override
    public List<AdAccountOption> listAccounts(String accessToken) {
        List<AdAccountOption> accounts = new ArrayList<>();

        JsonNode page = getJson("/me/adaccounts", uri -> uri
                .queryParam("fields", "id,name,currency")
                .queryParam("limit", 100)
                .queryParam("access_token", accessToken));

        int pageCount = 1;
        while (page != null) {
            JsonNode data = page.get("data");
            if (data != null && data.isArray()) {
                for (JsonNode account : data) {
                    accounts.add(new AdAccountOption(
                            text(account, "id"),
                            text(account, "name"),
                            text(account, "currency")));
                }
            }

            String next = page.path("paging").path("next").asText(null);
            if (next == null || next.isBlank()) break;
            if (accounts.size() > 500) {
                log.warn("[Module4] Meta ad-account paging exceeded 500 rows; stopping");
                break;
            }
            // Bounded independently of row count: a malformed or hostile page
            // (empty data[], but a next cursor that never goes blank) would
            // otherwise loop forever, each iteration blocking up to TIMEOUT.
            if (pageCount >= MAX_PAGES) {
                log.warn("[Module4] Meta ad-account paging exceeded {} pages; stopping", MAX_PAGES);
                break;
            }
            page = getAbsoluteJson(next);
            pageCount++;
        }

        return accounts;
    }

    /**
     * Follows a fully-qualified paging URL that Meta hands back verbatim.
     *
     * <p>{@code paging.next} is normally 100% Meta-controlled (it comes from an
     * authenticated Meta API response), but this is cheap defense-in-depth so a
     * compromised or malformed response can't redirect an outbound call with a
     * live access token to an arbitrary host.
     */
    private JsonNode getAbsoluteJson(String absoluteUrl) {
        requireMetaHost(absoluteUrl);
        try {
            String body = WebClient.create().get()
                    .uri(absoluteUrl)
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
            return parse(body);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("Meta paging request " + e.getStatusCode() + ": "
                    + extractErrorMessage(e.getResponseBodyAsString()), e);
        } catch (Exception e) {
            throw new AdPlatformException("Meta paging request failed: "
                    + e.getClass().getSimpleName(), e);
        }
    }

    /** Rejects a paging URL whose host doesn't match (or subdomain-match) the configured Graph API host. */
    private void requireMetaHost(String absoluteUrl) {
        String expectedHost;
        String actualHost;
        try {
            expectedHost = java.net.URI.create(graphBaseUrl).getHost();
            actualHost = java.net.URI.create(absoluteUrl).getHost();
        } catch (Exception e) {
            throw new AdPlatformException("Meta paging URL could not be parsed: " + absoluteUrl, e);
        }
        if (expectedHost == null || actualHost == null
                || !(actualHost.equals(expectedHost) || actualHost.endsWith("." + expectedHost))) {
            throw new AdPlatformException(
                    "Meta paging URL host '" + actualHost + "' does not match expected host '"
                            + expectedHost + "'; refusing to follow it");
        }
    }

    /**
     * Account-level totals for one closed reporting period.
     *
     * <p>{@code level=account} collapses every campaign, ad set, and ad into a
     * single row, which is what Module 4's weekly campaign record needs. Meta
     * returns all numbers as strings; {@link #asLong} and {@link #asDecimal}
     * handle that.
     */
    @Override
    public AdInsightData fetchInsights(String accessToken, String externalAccountId,
                                       LocalDate periodStart, LocalDate periodEnd) {
        String timeRange = "{\"since\":\"" + periodStart + "\",\"until\":\"" + periodEnd + "\"}";

        // Deliberately no `breakdowns` or `time_increment` param: either would
        // make Meta return multiple rows for this window, and this method only
        // reads data.get(0) — the rest would be silently dropped.
        JsonNode response = getJson("/" + externalAccountId + "/insights", uri -> uri
                .queryParam("level", "account")
                .queryParam("fields", "impressions,clicks,spend,actions")
                .queryParam("time_range", encode(timeRange))
                .queryParam("access_token", encode(accessToken)));

        JsonNode data = response.get("data");
        if (data == null || !data.isArray() || data.isEmpty()) {
            // No spend in the window. Correct and common for a new account.
            log.info("[Module4] Meta returned no insight rows for {} {}..{}",
                     externalAccountId, periodStart, periodEnd);
            return new AdInsightData(0, 0, BigDecimal.ZERO, 0, null, response.toString());
        }

        JsonNode row = data.get(0);
        return new AdInsightData(
                asLong(row, "impressions"),
                asLong(row, "clicks"),
                asDecimal(row, "spend"),
                countConversions(row.get("actions")),
                null,                       // currency comes from the connection row
                response.toString());
    }

    /** Sums only the action types that genuinely represent a conversion. */
    private long countConversions(JsonNode actions) {
        if (actions == null || !actions.isArray()) return 0L;

        long total = 0L;
        for (JsonNode action : actions) {
            String type = text(action, "action_type");
            if (type == null) continue;

            boolean isConversion = CONVERSION_ACTION_TYPES.contains(type)
                    || CONVERSION_ACTION_PREFIXES.stream().anyMatch(type::startsWith);
            if (isConversion) {
                total += parseLong(text(action, "value"));
            }
        }
        return total;
    }

    private long asLong(JsonNode node, String field) {
        return parseLong(text(node, field));
    }

    private BigDecimal asDecimal(JsonNode node, String field) {
        String raw = text(node, field);
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(raw);
        } catch (NumberFormatException e) {
            // Absent/blank is a legitimate zero (see above); present-but-garbage
            // is not — silently reporting 0 spend here would be indistinguishable
            // from "no spend", and spend drives ROAS. Fail loudly instead.
            throw new AdPlatformException("Meta returned an unparseable " + field + " value: " + raw, e);
        }
    }

    private static long parseLong(String raw) {
        if (raw == null || raw.isBlank()) return 0L;
        try {
            return Long.parseLong(raw);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    /** A GET returning parsed JSON, with Meta's error envelope turned into an exception. */
    private JsonNode getJson(String path,
                             java.util.function.UnaryOperator<UriComponentsBuilder> query) {
        String body;
        try {
            body = http.get()
                    .uri(uriBuilder -> query.apply(
                            UriComponentsBuilder.fromUriString(graphBaseUrl + path)).build(true).toUri())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block(TIMEOUT);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("Meta API " + e.getStatusCode() + ": "
                    + extractErrorMessage(e.getResponseBodyAsString()), e);
        } catch (Exception e) {
            // Deliberately does not interpolate the request URI — it carries the
            // app secret as a query parameter.
            throw new AdPlatformException("Meta API call failed: " + e.getClass().getSimpleName(), e);
        }
        return parse(body);
    }

    private JsonNode parse(String body) {
        try {
            return mapper.readTree(body == null ? "{}" : body);
        } catch (Exception e) {
            throw new AdPlatformException("Meta returned a non-JSON response", e);
        }
    }

    /** Pulls {@code error.message} out of Meta's error envelope, falling back to the raw body. */
    private String extractErrorMessage(String body) {
        try {
            JsonNode error = mapper.readTree(body).get("error");
            if (error != null && error.get("message") != null) {
                return error.get("message").asText();
            }
        } catch (Exception ignored) {
            // fall through
        }
        return body == null || body.isBlank() ? "(empty body)" : body;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    /** Meta has been known to stringify normally-numeric fields elsewhere; be lenient. */
    private static Long tryParseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
