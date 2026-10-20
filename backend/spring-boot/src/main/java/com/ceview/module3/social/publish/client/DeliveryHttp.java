package com.ceview.module3.social.publish.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.util.LinkedMultiValueMap;
import java.time.Duration;
import java.util.Map;

final class DeliveryHttp {
    private final WebClient http = WebClient.builder().build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final Duration timeout;
    DeliveryHttp() { this(Duration.ofSeconds(30)); }
    DeliveryHttp(Duration timeout) { this.timeout = timeout; }
    JsonNode get(String url, String token) { return call(http.get().uri(url).headers(h -> h.setBearerAuth(token))); }
    JsonNode delete(String url, String token) { return call(http.delete().uri(url).headers(h -> h.setBearerAuth(token))); }
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
        return call(http.post().uri(url).headers(h -> h.setBearerAuth(token)).body(BodyInserters.fromMultipartData(parts.build())));
    }
    JsonNode json(String url, String token, Object body) {
        return call(http.post().uri(url).headers(h -> h.setBearerAuth(token)).bodyValue(body));
    }
    JsonNode form(String url, String token, Map<String, ?> values) {
        var form = new LinkedMultiValueMap<String, String>();
        values.forEach((k, v) -> { if (v != null) form.add(k, v instanceof String ? (String)v : encode(v)); });
        return call(http.post().uri(url).headers(h -> { if (token != null) h.setBearerAuth(token); })
                .body(BodyInserters.fromFormData(form)));
    }
    private String encode(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { throw new DeliveryException("Invalid publishing request.", false, false); }
    }
    private JsonNode call(WebClient.RequestHeadersSpec<?> request) {
        try {
            return request.exchangeToMono(r -> r.bodyToMono(String.class).defaultIfEmpty("{}")
                    .map(body -> parse(body, r.statusCode().value()))).block(timeout);
        } catch (DeliveryException e) { throw e; }
        catch (Exception e) { throw new DeliveryException("The platform did not confirm delivery. Please check the platform before retrying.", false, false); }
    }
    private JsonNode parse(String body, int status) {
        JsonNode root;
        try { root = mapper.readTree(body); }
        catch (Exception e) { throw new DeliveryException("The platform returned an invalid response.", false, false); }
        if (root == null || !root.isObject()) throw new DeliveryException("The platform returned an invalid response.", false, false);
        JsonNode error = root.path("error");
        String code = error.isTextual() ? error.asText() : error.path("code").asText("");
        if (status >= 400 || (!error.isMissingNode() && !error.isNull() && !code.equals("ok") && !code.isBlank())) {
            boolean auth = status == 401 || code.equals("190") || code.equals("102") || code.equals("access_token_invalid") || code.equals("invalid_grant") || code.equals("scope_not_authorized");
            boolean retry = status == 429 || code.equals("rate_limit_exceeded") || code.equals("4") || code.equals("17") || code.equals("32");
            throw new DeliveryException(auth ? "Reconnect this platform account to publish." : retry ? "The platform rate limit was reached. Delivery will retry." : "The platform rejected delivery. Check the media and account permissions.", auth, retry);
        }
        return root;
    }
    static String id(JsonNode node, String name) {
        String id = node.path(name).asText("");
        if (id.isBlank()) throw new DeliveryException("The platform did not return a delivery identifier.", false, false);
        return id;
    }
}
