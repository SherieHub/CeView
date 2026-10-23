package com.ceview.module3.social.publish;

import com.ceview.common.crypto.TokenCipher;
import com.ceview.module2.MarketFlags;
import com.ceview.module3.social.publish.PublishingDtos.AdInterest;
import com.ceview.module3.social.publish.PublishingDtos.AdOptions;
import com.ceview.module4.adconnections.AdPlatformConnection;
import com.ceview.module4.adconnections.AdSpendLimit;
import com.ceview.module4.adconnections.AdSpendLimitRepository;
import com.ceview.module4.adconnections.client.AdPlatformException;
import com.ceview.module4.adconnections.client.MetaTargetingClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Currency;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Every rule a paid Meta ad must pass before anything is created, and the targeting the server
 * derives from them. The Publish window mirrors the cheap rules so mistakes show as the operator
 * types; this is the authority, so a bypassed form cannot overspend or aim the ad elsewhere.
 *
 * <p>Order: rules that need no network first, then the business's spend limits, then Meta's own
 * answers (its minimum budget, whether each interest still exists, the language key).
 */
@Component
public class AdPolicy {

    private static final Logger log = LoggerFactory.getLogger(AdPolicy.class);
    private static final Set<String> OBJECTIVES = Set.of("OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT");
    /** The language an audience is limited to per forecast market; the USA is left unlimited. */
    private static final Map<String, String> LANGUAGE = Map.of("korea", "Korean", "japan", "Japanese");
    private static final int MAX_INTERESTS = 10;

    /** What the server derives for the ad set; the client's input never supplies these. */
    public record AdPlan(String countries, String locales, String interestsJson, OffsetDateTime endTime) {}

    private final AdSpendLimitRepository limits;
    private final SocialPostRepository posts;
    private final MetaTargetingClient meta;
    private final TokenCipher cipher;
    private final ObjectMapper mapper;
    private final Map<String, String> localeKeys = new ConcurrentHashMap<>();

    public AdPolicy(AdSpendLimitRepository limits, SocialPostRepository posts, MetaTargetingClient meta,
                    TokenCipher cipher, ObjectMapper mapper) {
        this.limits = limits;
        this.posts = posts;
        this.meta = meta;
        this.cipher = cipher;
        this.mapper = mapper;
    }

    public AdPlan plan(UUID profile, AdPlatformConnection connection, AdOptions ad, String market) {
        if (ad.objective() == null || !OBJECTIVES.contains(ad.objective())) {
            throw bad("Choose Traffic, Awareness or Engagement as the ad objective.");
        }
        String marketId = market == null ? "" : market.trim().toLowerCase(Locale.ROOT);
        String country = MarketFlags.isoFor(marketId);
        if (country.isEmpty()) throw bad("Choose a forecast market for this ad.");
        if (ad.startTime() == null || !ad.startTime().isAfter(OffsetDateTime.now())) {
            throw bad("The ad must start in the future.");
        }
        if (ad.durationDays() < 1) throw bad("Enter the number of days the ad runs (at least 1).");
        if (ad.dailyBudgetMinor() < 1) throw bad("Enter a daily budget above zero.");
        List<AdInterest> interests = ad.interests() == null ? List.of() : ad.interests();
        validateInterests(interests);

        String currency = connection.getCurrency();
        AdSpendLimit limit = limits.findById(profile)
                .filter(l -> l.getCurrency() != null && l.getCurrency().equals(currency))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "Set ad spending limits in Settings before running a paid ad."));
        if (ad.dailyBudgetMinor() > limit.getMaxDailyMinor()) {
            throw bad("Daily budget is above your daily limit of " + money(limit.getMaxDailyMinor(), currency) + ".");
        }
        long committed = committedMinor(posts.findActiveAds(profile, OffsetDateTime.now()));
        long remaining = Math.max(0, limit.getMaxTotalMinor() - committed);
        long total;
        try {
            total = Math.multiplyExact(ad.dailyBudgetMinor(), (long) ad.durationDays());
        } catch (ArithmeticException e) {
            total = Long.MAX_VALUE;
        }
        if (total > remaining) {
            throw bad("This ad would spend " + (total == Long.MAX_VALUE ? "more than you can set" : money(total, currency))
                    + " in total, above your total limit; " + money(remaining, currency)
                    + " is left of " + money(limit.getMaxTotalMinor(), currency) + " across your active ads.");
        }

        String token = cipher.decrypt(connection.getAccessTokenEncrypted());
        checkMinimumBudget(token, connection, ad, currency);
        checkInterestsStillExist(token, interests);
        String locale = LANGUAGE.containsKey(marketId) ? localeKey(token, LANGUAGE.get(marketId)) : null;
        return new AdPlan(country, locale, interestsJson(interests), ad.startTime().plusDays(ad.durationDays()));
    }

    /** What the business's not-yet-ended, not-failed ads can still spend: daily budget x days of each. */
    public static long committedMinor(List<SocialPost> activeAds) {
        long sum = 0;
        for (SocialPost p : activeAds) {
            if (p.getAdDailyBudgetMinor() == null || p.getAdStartTime() == null || p.getAdEndTime() == null) continue;
            long minutes = Math.max(0, Duration.between(p.getAdStartTime(), p.getAdEndTime()).toMinutes());
            long days = Math.max(1, (minutes + 1439) / 1440);
            sum += p.getAdDailyBudgetMinor() * days;
        }
        return sum;
    }

    private static void validateInterests(List<AdInterest> interests) {
        if (interests.size() > MAX_INTERESTS) throw bad("Choose at most " + MAX_INTERESTS + " interests.");
        Set<String> seen = new HashSet<>();
        for (AdInterest interest : interests) {
            if (interest == null || interest.id() == null || !interest.id().matches("\\d{1,20}")
                    || interest.name() == null || interest.name().isBlank()) {
                throw bad("Invalid interest selection.");
            }
            if (!seen.add(interest.id())) throw bad("Each interest can be chosen only once.");
        }
    }

    private void checkMinimumBudget(String token, AdPlatformConnection connection, AdOptions ad, String currency) {
        Optional<MetaTargetingClient.MinimumBudget> minimum;
        try {
            minimum = meta.minimumDailyBudget(token, connection.getExternalAccountId(), ad.objective());
        } catch (AdPlatformException e) {
            // Not blocking: Meta applies its own floor when the ad set is created and the reason is shown.
            log.warn("Could not read Meta's minimum daily budget: {}", e.getMessage());
            return;
        }
        if (minimum.isPresent() && currency.equalsIgnoreCase(minimum.get().currency())
                && ad.dailyBudgetMinor() <= minimum.get().minDailyMinor()) {
            throw bad("Daily budget must be more than " + money(minimum.get().minDailyMinor(), currency)
                    + ", Meta's minimum for this ad.");
        }
    }

    private void checkInterestsStillExist(String token, List<AdInterest> interests) {
        if (interests.isEmpty()) return;
        Set<String> invalid;
        try {
            invalid = meta.invalidInterestIds(token, interests.stream().map(AdInterest::id).toList());
        } catch (AdPlatformException e) {
            log.warn("Could not validate Meta interests: {}", e.getMessage());
            return;
        }
        for (AdInterest interest : interests) {
            if (invalid.contains(interest.id())) {
                throw bad("'" + interest.name() + "' is no longer available on Meta. Remove it and pick another interest.");
            }
        }
    }

    /** A missing language would quietly widen the audience beyond what was promised, so it stops the ad. */
    private String localeKey(String token, String language) {
        String cached = localeKeys.get(language);
        if (cached != null) return cached;
        Optional<String> key;
        try {
            key = meta.localeKey(token, language);
        } catch (AdPlatformException e) {
            log.warn("Could not look up Meta's {} locale: {}", language, e.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Could not look up Meta's language targeting. Try again in a moment.");
        }
        String found = key.orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "Meta has no language targeting for " + language + ". Try again later."));
        localeKeys.put(language, found);
        return found;
    }

    private String interestsJson(List<AdInterest> interests) {
        if (interests.isEmpty()) return null;
        List<Map<String, String>> out = new ArrayList<>();
        for (AdInterest interest : interests) {
            Map<String, String> entry = new LinkedHashMap<>();
            entry.put("id", interest.id());
            entry.put("name", interest.name());
            out.add(entry);
        }
        try {
            return mapper.writeValueAsString(out);
        } catch (Exception e) {
            throw bad("Invalid interest selection.");
        }
    }

    /** "PHP 500.00": the currency's own decimal places, so a currency without cents shows none. */
    static String money(long minor, String currency) {
        int digits;
        try {
            digits = Currency.getInstance(currency).getDefaultFractionDigits();
        } catch (IllegalArgumentException | NullPointerException e) {
            digits = 2;
        }
        BigDecimal amount = BigDecimal.valueOf(minor, Math.max(digits, 0));
        return currency + " " + amount.toPlainString();
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
