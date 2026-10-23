package com.ceview.module4.adconnections.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Read-only Meta Marketing API lookups an ad needs before it is created: the account's minimum daily
 * budget, interest search and validation, and language (locale) keys.
 *
 * <p>The access token goes in an {@code Authorization} header, never the URL, and no exception message
 * carries it. Callers decide whether a failed lookup blocks the operator or is skipped.
 */
@Component
public class MetaTargetingClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(20);
    private static final int INTEREST_LIMIT = 10;

    private final WebClient http;
    private final ObjectMapper mapper = new ObjectMapper();

    public MetaTargetingClient(@Value("${ceview.adplatform.meta.graph-base-url:https://graph.facebook.com/v25.0}")
                               String graphBaseUrl) {
        this.http = WebClient.builder().baseUrl(graphBaseUrl.replaceAll("/$", "")).build();
    }

    /** Meta's own floor for one ad set's daily budget, in the account's currency. */
    public record MinimumBudget(String currency, long minDailyMinor) {}

    public record InterestOption(String id, String name, String path) {}

    /**
     * Awareness (optimised for impressions) has its own minimum; clicks and engagement share the
     * "high frequency" one. Meta documents the amounts as int32 in the account currency but not
     * whether that is minor units, so callers must confirm the scale against a known floor.
     */
    public Optional<MinimumBudget> minimumDailyBudget(String token, String accountId, String objective) {
        String field = "OUTCOME_AWARENESS".equals(objective) ? "min_daily_budget_imp" : "min_daily_budget_high_freq";
        JsonNode data = get(token, "/act_{id}/minimum_budgets", digitsOnly(accountId)).path("data");
        if (!data.isArray() || data.isEmpty()) return Optional.empty();
        JsonNode first = data.get(0);
        JsonNode amount = first.path(field);
        if (amount.isMissingNode() || amount.isNull() || amount.asText().isBlank()) return Optional.empty();
        try {
            return Optional.of(new MinimumBudget(first.path("currency").asText(""), Long.parseLong(amount.asText().trim())));
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public List<InterestOption> searchInterests(String token, String query) {
        JsonNode data = get(token, "/search?type=adinterest&q={q}&limit=" + INTEREST_LIMIT, query).path("data");
        List<InterestOption> found = new ArrayList<>();
        if (!data.isArray()) return found;
        for (JsonNode item : data) {
            String id = item.path("id").asText("");
            String name = item.path("name").asText("");
            if (id.matches("\\d+") && !name.isBlank()) {
                found.add(new InterestOption(id, name, pathOf(item.path("path"))));
            }
        }
        return found;
    }

    /**
     * The ids Meta explicitly marks invalid. An id missing from the answer is not reported: Meta will
     * itself refuse it when the ad set is created, with a message the operator is shown.
     */
    public Set<String> invalidInterestIds(String token, List<String> ids) {
        List<String> clean = ids.stream().filter(id -> id.matches("\\d+")).toList();
        if (clean.isEmpty()) return Set.of();
        String list = clean.stream().map(id -> "\"" + id + "\"").collect(Collectors.joining(",", "[", "]"));
        JsonNode data = get(token, "/search?type=adinterestvalid&interest_fbid_list={list}", list).path("data");
        Set<String> invalid = new LinkedHashSet<>();
        if (data.isArray()) {
            for (JsonNode item : data) {
                if (item.path("valid").isBoolean() && !item.path("valid").asBoolean()) {
                    invalid.add(item.path("id").asText());
                }
            }
        }
        return invalid;
    }

    /** Meta's numeric key for a language such as "Korean", matched on the exact name. */
    public Optional<String> localeKey(String token, String languageName) {
        JsonNode data = get(token, "/search?type=adlocale&q={q}", languageName).path("data");
        if (!data.isArray()) return Optional.empty();
        return StreamSupport.stream(data.spliterator(), false)
                .filter(item -> languageName.equalsIgnoreCase(item.path("name").asText("")))
                .map(item -> item.path("key").asText(""))
                .filter(key -> !key.isBlank())
                .findFirst();
    }

    private static String pathOf(JsonNode path) {
        if (!path.isArray()) return "";
        List<String> parts = new ArrayList<>();
        path.forEach(part -> parts.add(part.asText()));
        return String.join(" › ", parts);
    }

    private static String digitsOnly(String accountId) {
        String id = accountId == null ? "" : accountId.replaceFirst("^act_", "");
        if (!id.matches("\\d+")) throw new AdPlatformException("Select a valid Meta ad account.");
        return id;
    }

    private JsonNode get(String token, String template, Object... variables) {
        String body;
        try {
            body = http.get().uri(template, variables)
                    .headers(h -> h.setBearerAuth(token))
                    .retrieve().bodyToMono(String.class).block(TIMEOUT);
        } catch (WebClientResponseException e) {
            throw new AdPlatformException("Meta API " + e.getStatusCode().value() + ": "
                    + errorMessage(e.getResponseBodyAsString()), e);
        } catch (Exception e) {
            throw new AdPlatformException("Meta API call failed: " + e.getClass().getSimpleName(), e);
        }
        try {
            return mapper.readTree(body == null || body.isBlank() ? "{}" : body);
        } catch (Exception e) {
            throw new AdPlatformException("Meta returned a non-JSON response", e);
        }
    }

    private String errorMessage(String body) {
        try {
            JsonNode message = mapper.readTree(body).path("error").path("message");
            if (!message.isMissingNode()) return message.asText();
        } catch (Exception ignored) {
            // fall through
        }
        return "(no details)";
    }
}
