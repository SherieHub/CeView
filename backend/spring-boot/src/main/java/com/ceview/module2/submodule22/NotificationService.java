package com.ceview.module2.submodule22;

import com.ceview.module2.dto.NotificationDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Reads persisted demand alerts from the DB and maps them to the
 * NotificationsResponse DTO shape (FR2.15, FR2.17).
 * Returns an empty list when no alerts exist — no stub fallback.
 */
@Service
public class NotificationService {

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("MMM d, yyyy");

    private static final Map<String, String> MARKET_NAMES = Map.of(
            "korea", "South Korea",
            "japan", "Japan",
            "usa",   "United States"
    );

    private final DemandAlertRepository alertRepo;
    private final MarketScoreRepository scoreRepo;
    private final ForecastResultRepository forecastRepo;
    private final KeywordTrendAlertRepository keywordAlertRepo;

    public NotificationService(DemandAlertRepository alertRepo,
                                MarketScoreRepository scoreRepo,
                                ForecastResultRepository forecastRepo,
                                KeywordTrendAlertRepository keywordAlertRepo) {
        this.alertRepo           = alertRepo;
        this.scoreRepo           = scoreRepo;
        this.forecastRepo        = forecastRepo;
        this.keywordAlertRepo    = keywordAlertRepo;
    }

    /**
     * Pure DB read — demand alerts only. Deliberately does NOT call
     * {@link CategoryRankNotificationService}: that hop round-trips to FastAPI's
     * PyTrends-backed rank-markets endpoint per category (up to 75s) and would
     * make this endpoint unusably slow. See {@link #getKeywordTrendNotifications}.
     */
    public NotificationsResponse getNotificationsForProfile(UUID profileId) {
        if (profileId == null) {
            return new NotificationsResponse(List.of());
        }

        // Read directly from tbl_demand_alert's profile key (V29). This is the
        // tenant boundary for the feed and retains every category/market alert;
        // the old "latest 4-week forecast per market" path silently dropped
        // alerts belonging to all but one category.
        List<DemandAlert> alerts = alertRepo.findByBusinessProfileIdOrderByAlertDateDesc(profileId);
        if (alerts.isEmpty()) {
            return new NotificationsResponse(List.of());
        }

        Set<UUID> scoreIds = new LinkedHashSet<>();
        for (DemandAlert alert : alerts) {
            if (alert.getMarketScoreId() != null) scoreIds.add(alert.getMarketScoreId());
        }
        Map<UUID, MarketScore> scoreById = new HashMap<>();
        for (MarketScore score : scoreRepo.findAllById(scoreIds)) {
            scoreById.put(score.getMarketScoreId(), score);
        }

        Set<UUID> forecastIds = new LinkedHashSet<>();
        for (MarketScore score : scoreById.values()) {
            if (score.getForecastResultId() != null) forecastIds.add(score.getForecastResultId());
        }
        Map<UUID, ForecastResult> forecastById = new HashMap<>();
        for (ForecastResult forecast : forecastRepo.findAllById(forecastIds)) {
            // Defense in depth: an inconsistent historic FK must not resolve
            // market metadata through another tenant's forecast row.
            if (profileId.equals(forecast.getBusinessProfileId())) {
                forecastById.put(forecast.getForecastResultId(), forecast);
            }
        }

        List<NotificationDto> demandNotifications = alerts.stream()
                .map(a -> toNotificationDto(a, scoreById, forecastById))
                .collect(Collectors.toList());

        return new NotificationsResponse(demandNotifications);
    }

    /**
     * Keyword-trend notifications are a pure DB read. If this week's scheduled
     * producer has not finished yet, this deliberately returns older persisted
     * rows (or an empty list); it never starts a 75-second PyTrends call.
     */
    public NotificationsResponse getKeywordTrendNotifications(UUID profileId) {
        if (profileId == null) return new NotificationsResponse(List.of());
        return new NotificationsResponse(keywordAlertRepo
                .findByBusinessProfileIdOrderByCreatedAtDesc(profileId)
                .stream()
                .map(this::toKeywordNotificationDto)
                .toList());
    }

    /**
     * Marks one alert read, scoped to the owning profile so an operator cannot
     * mutate another tenant's notification. No-ops when the id doesn't belong to
     * this profile — read-marking is fire-and-forget from the client, and a
     * silent no-op avoids leaking cross-tenant existence via a 404.
     */
    @Transactional
    public void markRead(UUID profileId, UUID notificationId) {
        if (alertRepo.findOwnedBy(notificationId, profileId)
                .map(a -> { a.setIsRead(true); alertRepo.save(a); return true; })
                .orElse(false)) {
            return;
        }
        keywordAlertRepo.findByKeywordTrendAlertIdAndBusinessProfileId(notificationId, profileId)
                .ifPresent(a -> { a.setIsRead(true); keywordAlertRepo.save(a); });
    }

    // ─── mapping helpers ─────────────────────────────────────────────────────

    private NotificationDto toNotificationDto(DemandAlert alert,
                                               Map<UUID, MarketScore> scoreById,
                                               Map<UUID, ForecastResult> forecastById) {
        MarketScore ms = scoreById.get(alert.getMarketScoreId());
        ForecastResult fr = ms != null ? forecastById.get(ms.getForecastResultId()) : null;

        String marketId   = fr != null ? fr.getTargetMarket() : "unknown";
        String marketName = MARKET_NAMES.getOrDefault(marketId, marketId);
        String dateStr    = alert.getAlertDate() != null
                ? alert.getAlertDate().format(DATE_FMT) : "";

        String category = alert.getCategory();
        String categoryLabel = category != null ? category : "Uncategorized";
        String title = "Demand window alert — " + marketName + " — " + categoryLabel;

        return new NotificationDto(
                alert.getDemandAlertId().toString(),
                dateStr,
                title,
                marketName,
                marketId,
                alert.getTrend(),
                Boolean.TRUE.equals(alert.getIsRead()),
                null,
                category,
                alert.getAlertLevel(),
                alert.getAlertMessage(),
                alert.getWindowOpenDate(),
                alert.getUpliftPct()
        );
    }

    private NotificationDto toKeywordNotificationDto(KeywordTrendAlert alert) {
        String marketId = alert.getTargetMarket();
        String marketName = MARKET_NAMES.getOrDefault(marketId, marketId);
        String date = alert.getCreatedAt() != null ? alert.getCreatedAt().format(DATE_FMT) : "";
        return new NotificationDto(
                alert.getKeywordTrendAlertId().toString(),
                date,
                "Keyword Trend Alert — " + alert.getCategory(),
                marketName,
                marketId,
                "Top keyword: " + alert.getTopKeyword(),
                Boolean.TRUE.equals(alert.getIsRead()),
                null,
                alert.getCategory(),
                "INFO",
                alert.getAlertMessage(),
                null,
                null
        );
    }
}
