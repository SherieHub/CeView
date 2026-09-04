package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module2.dto.NotificationDtos.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Builds keyword-trend push notifications for a business profile's tagged
 * categories by calling the FastAPI {@code POST /api/trends/rank-markets}
 * endpoint and mapping the result to the existing {@link NotificationDto} shape.
 *
 * <p>For each category the profile is tagged to, this service:
 * <ol>
 *   <li>Calls FastAPI to aggregate the 10 fixed {@code CATEGORY_KEYWORDS} across
 *       KR / JP / US using pytrends.</li>
 *   <li>Identifies the top-ranked market (highest summed keyword volume).</li>
 *   <li>Builds a {@link NotificationDto} notifying the operator which market
 *       and keyword represent the strongest demand signal for their category.</li>
 * </ol>
 *
 * <p>On any FastAPI error or null response the category is silently skipped —
 * the notification list is simply shorter, never broken.
 */
@Service
public class CategoryRankNotificationService {

    private static final Logger log = LoggerFactory.getLogger(CategoryRankNotificationService.class);

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("MMM d, yyyy");

    private static final Map<String, String> MARKET_NAMES = Map.of(
            "korea", "South Korea",
            "japan", "Japan",
            "usa",   "United States"
    );

    private final AIInferenceGatewayService ai;

    public CategoryRankNotificationService(AIInferenceGatewayService ai) {
        this.ai = ai;
    }

    /**
     * For each category in {@code categories}, fetch the cross-market ranking
     * from FastAPI and return one {@link NotificationDto} per category.
     *
     * @param categories List of category labels assigned to the business profile
     * @return Keyword-trend notifications (one per category; empty list on failure)
     */
    public List<NotificationDto> buildForCategories(List<String> categories) {
        if (categories == null || categories.isEmpty()) {
            return List.of();
        }

        List<NotificationDto> result = new ArrayList<>();
        String today = LocalDate.now().format(DATE_FMT);
        int failureCount = 0;
        Exception lastFailure = null;

        for (String category : categories) {
            try {
                Map<String, Object> raw = ai.rankMarketsForCategory(category);
                if (raw == null || raw.isEmpty()) {
                    log.debug("rank-markets returned empty for category={}", category);
                    continue;
                }
                result.add(toNotificationDto(category, raw, today));

            } catch (Exception exc) {
                log.warn("CategoryRankNotificationService skipping category={} — {}",
                         category, exc.getMessage());
                failureCount++;
                lastFailure = exc;
            }
        }

        // A partial failure still returns the categories that succeeded (silent
        // skip, as documented above). But if every category errored, that's not
        // "no trends" — it's an upstream outage — so surface it to the caller
        // instead of returning a silent, indistinguishable-from-empty 200.
        if (failureCount == categories.size() && lastFailure != null) {
            // If the gateway already produced the unavailability contract, rethrow it
            // as-is — wrapping it in IllegalStateException would demote it to
            // getCause() and ApiExceptionHandler has no handler for that type, so the
            // dependency/cause/stage the gateway just preserved would be lost and this
            // would fall to Spring's default /error as a blank 500.
            if (lastFailure instanceof com.ceview.ai.AiDependencyException aiEx) {
                throw aiEx;
            }
            throw new IllegalStateException(
                    "Keyword-trend lookup failed for all " + failureCount + " categor"
                            + (failureCount == 1 ? "y" : "ies"), lastFailure);
        }

        return result;
    }

    // ─── mapping ──────────────────────────────────────────────────────────────

    @SuppressWarnings("unchecked")
    private NotificationDto toNotificationDto(String category,
                                              Map<String, Object> raw,
                                              String today) {
        String topMarketKey  = strVal(raw, "top_market");
        String topKeyword    = strVal(raw, "top_keyword");
        String topMarketName = MARKET_NAMES.getOrDefault(topMarketKey, topMarketKey);
        String source        = strVal(raw, "source");

        // ── ranked_markets → topInterests (market name + total_volume as score) ──
        List<Map<String, Object>> rankedRaw =
                (List<Map<String, Object>>) raw.getOrDefault("ranked_markets", List.of());

        List<TopInterestDto> topInterests = new ArrayList<>();
        for (Map<String, Object> entry : rankedRaw) {
            String mKey  = strVal(entry, "market");
            String mName = MARKET_NAMES.getOrDefault(mKey, mKey);
            int    score = (int) Math.round(numVal(entry, "total_volume"));
            topInterests.add(new TopInterestDto(mName, score));
        }

        // ── keyword_volumes from the top market → keywordData ─────────────────
        Map<String, Object> kwMap =
                (Map<String, Object>) raw.getOrDefault("top_market_keywords", Map.of());

        List<KeywordTrendDto> keywordData = new ArrayList<>();
        for (Map.Entry<String, Object> entry : kwMap.entrySet()) {
            int vol = (int) Math.round(numVal(entry.getValue()));
            keywordData.add(new KeywordTrendDto(entry.getKey(), vol, 0, topMarketName));
        }
        // Hottest keyword first
        keywordData.sort(Comparator.comparingInt(KeywordTrendDto::volume).reversed());

        // ── strategic insights ────────────────────────────────────────────────
        StrategicInsightsDto insights = new StrategicInsightsDto(
                "Top market: " + topMarketName,
                "Top keyword: " + topKeyword,
                "Source: " + source
        );

        DetailsDto details = new DetailsDto(
                0, 0.0,
                topInterests,
                List.of(),
                insights,
                keywordData,
                null
        );

        return new NotificationDto(
                UUID.randomUUID().toString(),
                today,
                "Keyword Trend Alert — " + category,
                topMarketName,
                topMarketKey,
                "Top keyword: " + topKeyword,
                false,
                details,
                category,
                "INFO",
                null
        );
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private String strVal(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString() : "";
    }

    private double numVal(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return (v instanceof Number) ? ((Number) v).doubleValue() : 0.0;
    }

    private double numVal(Object v) {
        return (v instanceof Number) ? ((Number) v).doubleValue() : 0.0;
    }
}
