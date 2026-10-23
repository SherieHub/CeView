package com.ceview.module3.social.publish.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.util.LinkedMultiValueMap;
import java.time.Duration;
import java.util.Map;

final class DeliveryHttp {
    private static final Logger log = LoggerFactory.getLogger(DeliveryHttp.class);
    private final WebClient http = WebClient.builder().build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final Duration timeout;
    DeliveryHttp() { this(Duration.ofSeconds(30)); }
    DeliveryHttp(Duration timeout) { this.timeout = timeout; }
    JsonNode get(String url, String token) { return call(http.get().uri(url).headers(h -> h.setBearerAuth(token)), url); }
    JsonNode delete(String url, String token) { return call(http.delete().uri(url).headers(h -> h.setBearerAuth(token)), url); }
    JsonNode image(String url, String token, String mediaUrl) {
        byte[] bytes;
        try {
            // URL comes exclusively from the server-generated, tenant-owned MediaAsset.
            bytes = WebClient.builder().codecs(c -> c.defaultCodecs().maxInMemorySize(15 * 1024 * 1024)).build()
                    .get().uri(mediaUrl).retrieve().bodyToMono(byte[].class).block(Duration.ofSeconds(30));
        } catch (Exception e) { throw new DeliveryException("The uploaded ad image could not be read.", false, true); }
        var parts = new org.springframework.http.client.MultipartBodyBuilder();
        parts.part("filename", new org.springframework.core.io.ByteArrayResource(bytes) {
            @Override public String getFilename() { return "ad-image.jpg"; }
        });
        return call(http.post().uri(url).headers(h -> h.setBearerAuth(token)).body(BodyInserters.fromMultipartData(parts.build())), url);
    }
    JsonNode json(String url, String token, Object body) {
        return call(http.post().uri(url).headers(h -> h.setBearerAuth(token)).bodyValue(body), url);
    }
    JsonNode form(String url, String token, Map<String, ?> values) {
        var form = new LinkedMultiValueMap<String, String>();
        values.forEach((k, v) -> { if (v != null) form.add(k, v instanceof String ? (String)v : encode(v)); });
        return call(http.post().uri(url).headers(h -> { if (token != null) h.setBearerAuth(token); })
                .body(BodyInserters.fromFormData(form)), url);
    }
    private String encode(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { throw new DeliveryException("Invalid publishing request.", false, false); }
    }
    private JsonNode call(WebClient.RequestHeadersSpec<?> request, String url) {
        try {
            return request.exchangeToMono(r -> r.bodyToMono(String.class).defaultIfEmpty("{}")
                    .map(body -> parse(body, r.statusCode().value(), url))).block(timeout);
        } catch (DeliveryException e) { throw e; }
        catch (Exception e) { throw new DeliveryException("The platform did not confirm delivery. Please check the platform before retrying.", false, false); }
    }
    private JsonNode parse(String body, int status, String url) {
        JsonNode root;
        try { root = mapper.readTree(body); }
        catch (Exception e) { throw new DeliveryException("The platform returned an invalid response.", false, false); }
        if (root == null || !root.isObject()) throw new DeliveryException("The platform returned an invalid response.", false, false);
        JsonNode error = root.path("error");
        String code = error.isTextual() ? error.asText() : error.path("code").asText("");
        if (status >= 400 || (!error.isMissingNode() && !error.isNull() && !code.equals("ok") && !code.isBlank())) {
            logRejection(status, code, error, root, url);
            boolean auth = status == 401 || code.equals("190") || code.equals("102") || code.equals("access_token_invalid") || code.equals("invalid_grant") || code.equals("scope_not_authorized");
            boolean retry = status == 429 || code.equals("rate_limit_exceeded") || code.equals("4") || code.equals("17") || code.equals("32");
            throw new DeliveryException(auth ? "Reconnect this platform account to publish." : retry ? "The platform rate limit was reached. Delivery will retry." : "The platform rejected delivery. Check the media and account permissions.", auth, retry,
                    platformDetail(error));
        }
        return root;
    }
    /**
     * The user-facing message is deliberately generic, which leaves no way to tell why a platform
     * said no. This is the one place the platform's own code and wording are kept, in the server
     * log only: the query string (and so any field list) and the bearer token are never written.
     */
    private static void logRejection(int status, String code, JsonNode error, JsonNode root, String url) {
        String message = error.isObject() ? error.path("message").asText("") : root.path("message").asText("");
        // For ad objects Meta's generic "Invalid parameter" is explained by these two, naming what to fix.
        log.warn("Platform rejected a delivery call: status={} code={} subcode={} type={} message=\"{}\" user_title=\"{}\" user_msg=\"{}\" fbtrace={} path={}",
                status, code, error.path("error_subcode").asText(""), error.path("type").asText(""), clip(message),
                clip(error.path("error_user_title").asText("")), clip(error.path("error_user_msg").asText("")),
                error.path("fbtrace_id").asText(""), url.replaceFirst("\\?.*$", ""));
    }
    /**
     * The platform's own words for the operator ("Your ad set budget must be more than PHP63.32"),
     * from the fields it writes for people. Links and token-looking pairs are removed so nothing
     * sensitive can reach a stored, user-visible message.
     */
    private static String platformDetail(JsonNode error) {
        if (!error.isObject()) return null;
        String text = error.path("error_user_msg").asText("");
        if (text.isBlank()) text = error.path("error_user_title").asText("");
        if (text.isBlank()) return null;
        text = text.replaceAll("(?i)https?://\\S+", "").replaceAll("(?i)\\b\\w*token\\w*=\\S*", "").replaceAll("\\s+", " ").trim();
        return text.isEmpty() ? null : clip(text);
    }
    private static String clip(String text) { return text.length() > 300 ? text.substring(0, 300) + "…" : text; }
    static String id(JsonNode node, String name) {
        String id = node.path(name).asText("");
        if (id.isBlank()) throw new DeliveryException("The platform did not return a delivery identifier.", false, false);
        return id;
    }
}
