package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Produces persisted, weekly keyword-trend alerts. It is intentionally not a
 * notification read service: {@code rankMarketsForCategory} can take about
 * 75 seconds, so only {@link KeywordTrendAlertScheduler} calls this producer.
 */
@Service
public class CategoryRankNotificationService {

    private static final Logger log = LoggerFactory.getLogger(CategoryRankNotificationService.class);

    private static final Map<String, String> MARKET_NAMES = Map.of(
            "korea", "South Korea",
            "japan", "Japan",
            "usa", "United States"
    );

    private final AIInferenceGatewayService ai;
    private final KeywordTrendAlertRepository keywordAlertRepo;

    public CategoryRankNotificationService(AIInferenceGatewayService ai,
                                           KeywordTrendAlertRepository keywordAlertRepo) {
        this.ai = ai;
        this.keywordAlertRepo = keywordAlertRepo;
    }

    /**
     * Refreshes only categories that have no row for the current UTC ISO week.
     * Failures are logged per category so a slow/unavailable rank call never
     * affects notification reads or prevents other categories from refreshing.
     */
    public void refreshMissingCurrentWeekAlerts(UUID profileId, List<String> categories) {
        if (profileId == null || categories == null || categories.isEmpty()) return;

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        short isoYear = (short) today.get(IsoFields.WEEK_BASED_YEAR);
        short isoWeek = (short) today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        for (String category : categories) {
            if (category == null || category.isBlank()
                    || keywordAlertRepo.findByBusinessProfileIdAndCategoryAndIsoYearAndIsoWeek(
                    profileId, category, isoYear, isoWeek).isPresent()) {
                continue;
            }
            try {
                upsertWeeklyAlert(profileId, category, ai.rankMarketsForCategory(category), isoYear, isoWeek);
            } catch (Exception exc) {
                log.warn("Keyword-trend refresh skipped profile={} category={}: {}",
                        profileId, category, exc.getMessage());
            }
        }
    }

    /**
     * Idempotently updates the facts for one profile/category ISO week while
     * preserving both its stable id and its operator-owned read state.
     */
    @Transactional
    KeywordTrendAlert upsertWeeklyAlert(UUID profileId, String category, Map<String, Object> raw,
                                        short isoYear, short isoWeek) {
        Optional<KeywordTrendAlert> existing = keywordAlertRepo
                .findByBusinessProfileIdAndCategoryAndIsoYearAndIsoWeek(profileId, category, isoYear, isoWeek);
        KeywordTrendAlert alert = existing.orElseGet(KeywordTrendAlert::new);
        RankFacts facts = rankFacts(category, raw);

        if (existing.isEmpty()) {
            alert.setBusinessProfileId(profileId);
            alert.setCategory(category);
            alert.setIsoYear(isoYear);
            alert.setIsoWeek(isoWeek);
            alert.setIsRead(false);
        }
        alert.setTargetMarket(facts.market());
        alert.setTopKeyword(facts.keyword());
        alert.setAlertLevel("INFO");
        alert.setAlertMessage(facts.message());
        return keywordAlertRepo.save(alert);
    }

    @SuppressWarnings("unchecked")
    private RankFacts rankFacts(String category, Map<String, Object> raw) {
        if (raw == null) throw new IllegalArgumentException("rank-markets returned no result");
        String market = stringValue(raw.get("top_market"));
        String keyword = stringValue(raw.get("top_keyword"));
        if (!MARKET_NAMES.containsKey(market) || keyword.isBlank()) {
            throw new IllegalArgumentException("rank-markets result is missing a supported top market or keyword");
        }

        List<Map<String, Object>> ranked = raw.get("ranked_markets") instanceof List<?> list
                ? (List<Map<String, Object>>) list : List.of();
        long topVolume = volumeFor(ranked, market);
        Map<String, Object> runnerUp = ranked.stream()
                .filter(entry -> !market.equals(stringValue(entry.get("market"))))
                .findFirst()
                .orElse(null);
        String comparison = runnerUp == null
                ? "the other tracked markets"
                : MARKET_NAMES.getOrDefault(stringValue(runnerUp.get("market")), "the next-ranked market")
                        + " (" + numberValue(runnerUp.get("total_volume")) + ")";
        String marketName = MARKET_NAMES.get(market);
        String message = String.format(
                "%s has the highest summed keyword volume for %s (%d), compared with %s. Top keyword: %s.",
                marketName, category, topVolume, comparison, keyword);
        return new RankFacts(market, keyword, message);
    }

    private static long volumeFor(List<Map<String, Object>> ranked, String market) {
        return ranked.stream()
                .filter(entry -> market.equals(stringValue(entry.get("market"))))
                .findFirst()
                .map(entry -> numberValue(entry.get("total_volume")))
                .orElse(0L);
    }

    private static String stringValue(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private static long numberValue(Object value) {
        return value instanceof Number number ? Math.round(number.doubleValue()) : 0L;
    }

    private record RankFacts(String market, String keyword, String message) {}
}
