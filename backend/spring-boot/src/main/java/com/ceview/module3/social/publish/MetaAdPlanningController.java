package com.ceview.module3.social.publish;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.common.crypto.TokenCipher;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdPlatformConnectionRepository;
import com.ceview.module4.adconnections.AdSpendLimit;
import com.ceview.module4.adconnections.AdSpendLimitRepository;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.MetaTargetingClient;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * What the Publish window needs before it offers a paid Meta ad: the business's spend limits, Meta's
 * minimum daily budget and interest search. Everything is scoped to the caller's own business and
 * their own connected ad account; the Meta token is decrypted here and never leaves the server.
 */
@RestController
@RequestMapping("/api/ad-connections/meta")
public class MetaAdPlanningController {

    private static final Logger log = LoggerFactory.getLogger(MetaAdPlanningController.class);
    private static final Set<String> OBJECTIVES = Set.of("OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT");
    private static final long MINIMUM_TTL_SECONDS = 3600;

    /** {@code configured} is false until limits exist in the ad account's current currency. */
    public record LimitsView(boolean configured, String currency, Long maxDailyMinor, Long maxTotalMinor, long committedMinor) {}
    public record LimitsRequest(@NotNull @Min(1) Long maxDailyMinor, @NotNull @Min(1) Long maxTotalMinor) {}
    public record MinimumBudgetView(String currency, Long minDailyMinor) {}
    public record InterestView(String id, String name, String path) {}

    private record CachedMinimum(MetaTargetingClient.MinimumBudget minimum, Instant expires) {}

    private final CurrentBusinessProfile currentBusinessProfile;
    private final AdPlatformConnectionRepository connections;
    private final AdSpendLimitRepository limits;
    private final SocialPostRepository posts;
    private final MetaTargetingClient meta;
    private final TokenCipher cipher;
    private final Map<String, CachedMinimum> minimums = new ConcurrentHashMap<>();

    public MetaAdPlanningController(CurrentBusinessProfile currentBusinessProfile,
                                    AdPlatformConnectionRepository connections, AdSpendLimitRepository limits,
                                    SocialPostRepository posts, MetaTargetingClient meta, TokenCipher cipher) {
        this.currentBusinessProfile = currentBusinessProfile;
        this.connections = connections;
        this.limits = limits;
        this.posts = posts;
        this.meta = meta;
        this.cipher = cipher;
    }

    @GetMapping("/limits")
    public LimitsView limits() {
        UUID profile = currentBusinessProfile.resolveProfileId();
        return view(profile, activeMeta(profile));
    }

    @PutMapping("/limits")
    public LimitsView saveLimits(@Valid @RequestBody LimitsRequest body) {
        UUID profile = currentBusinessProfile.resolveProfileId();
        AdPlatformConnection connection = activeMeta(profile);
        if (body.maxTotalMinor() < body.maxDailyMinor()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The total limit must be at least the daily limit.");
        }
        AdSpendLimit limit = limits.findById(profile).orElseGet(AdSpendLimit::new);
        limit.setBusinessProfileId(profile);
        limit.setCurrency(connection.getCurrency());
        limit.setMaxDailyMinor(body.maxDailyMinor());
        limit.setMaxTotalMinor(body.maxTotalMinor());
        limits.save(limit);
        return view(profile, connection);
    }

    /** Meta's floor for one ad set's daily budget, or null if Meta gave none or could not be reached. */
    @GetMapping("/minimum-budget")
    public MinimumBudgetView minimumBudget(@RequestParam String objective) {
        if (!OBJECTIVES.contains(objective)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown ad objective.");
        }
        UUID profile = currentBusinessProfile.resolveProfileId();
        AdPlatformConnection connection = activeMeta(profile);
        String key = connection.getExternalAccountId() + ":" + ("OUTCOME_AWARENESS".equals(objective) ? "imp" : "clicks");
        CachedMinimum cached = minimums.get(key);
        MetaTargetingClient.MinimumBudget minimum = cached == null ? null : cached.minimum();
        if (cached == null || cached.expires().isBefore(Instant.now())) {
            try {
                minimum = meta.minimumDailyBudget(token(connection), connection.getExternalAccountId(), objective).orElse(null);
                // Only an answer from Meta is remembered; a failure must not hide the minimum for an hour.
                minimums.put(key, new CachedMinimum(minimum, Instant.now().plusSeconds(MINIMUM_TTL_SECONDS)));
            } catch (AdPlatformException e) {
                log.warn("Could not read Meta's minimum daily budget: {}", e.getMessage());
                minimum = null;
            }
        }
        return minimum == null
                ? new MinimumBudgetView(connection.getCurrency(), null)
                : new MinimumBudgetView(minimum.currency(), minimum.minDailyMinor());
    }

    @GetMapping("/interests")
    public List<InterestView> interests(@RequestParam String q) {
        String query = q == null ? "" : q.trim();
        if (query.length() < 2 || query.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Search for 2 to 100 characters.");
        }
        UUID profile = currentBusinessProfile.resolveProfileId();
        AdPlatformConnection connection = activeMeta(profile);
        try {
            return meta.searchInterests(token(connection), query).stream()
                    .map(i -> new InterestView(i.id(), i.name(), i.path())).toList();
        } catch (AdPlatformException e) {
            log.warn("Meta interest search failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Could not search Meta interests. Try again in a moment.");
        }
    }

    private LimitsView view(UUID profile, AdPlatformConnection connection) {
        long committed = AdPolicy.committedMinor(posts.findActiveAds(profile, OffsetDateTime.now()));
        return limits.findById(profile)
                .filter(l -> connection.getCurrency().equals(l.getCurrency()))
                .map(l -> new LimitsView(true, l.getCurrency(), l.getMaxDailyMinor(), l.getMaxTotalMinor(), committed))
                .orElseGet(() -> new LimitsView(false, connection.getCurrency(), null, null, committed));
    }

    private AdPlatformConnection activeMeta(UUID profile) {
        return connections.findByBusinessProfileIdAndProvider(profile, "meta")
                .filter(c -> AdPlatformConnection.STATUS_ACTIVE.equals(c.getStatus()))
                .filter(c -> c.getExternalAccountId() != null && c.getCurrency() != null)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "Connect a Meta ad account first."));
    }

    private String token(AdPlatformConnection connection) {
        return cipher.decrypt(connection.getAccessTokenEncrypted());
    }
}
