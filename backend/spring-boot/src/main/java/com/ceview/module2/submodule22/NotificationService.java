package com.ceview.module2.submodule22;

import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.dto.NotificationDtos.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

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
    private final BusinessProfileRepository profileRepo;
    private final CategoryRankNotificationService categoryRankService;

    public NotificationService(DemandAlertRepository alertRepo,
                                MarketScoreRepository scoreRepo,
                                ForecastResultRepository forecastRepo,
                                BusinessProfileRepository profileRepo,
                                CategoryRankNotificationService categoryRankService) {
        this.alertRepo           = alertRepo;
        this.scoreRepo           = scoreRepo;
        this.forecastRepo        = forecastRepo;
        this.profileRepo         = profileRepo;
        this.categoryRankService = categoryRankService;
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

        // Gather latest ForecastResult per market → join to MarketScore → DemandAlert
        List<ForecastResult> forecasts = new ArrayList<>();
        for (String market : List.of("korea", "japan", "usa")) {
            forecastRepo.findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                    profileId, market, 4).ifPresent(forecasts::add);
        }

        if (forecasts.isEmpty()) {
            return new NotificationsResponse(List.of());
        }

        List<UUID> forecastIds = forecasts.stream()
                .map(ForecastResult::getForecastResultId)
                .collect(Collectors.toList());

        List<MarketScore> scores = scoreRepo.findByForecastResultIdIn(forecastIds);
        if (scores.isEmpty()) {
            return new NotificationsResponse(List.of());
        }

        List<UUID> scoreIds = scores.stream()
                .map(MarketScore::getMarketScoreId)
                .collect(Collectors.toList());

        List<DemandAlert> alerts = alertRepo.findByMarketScoreIdInOrderByAlertDateDesc(scoreIds);

        // Index scores and forecasts for O(1) lookup
        Map<UUID, MarketScore> scoreById = scores.stream()
                .collect(Collectors.toMap(MarketScore::getMarketScoreId, s -> s));
        Map<UUID, ForecastResult> forecastById = forecasts.stream()
                .collect(Collectors.toMap(ForecastResult::getForecastResultId, f -> f));

        List<NotificationDto> demandNotifications = alerts.stream()
                .map(a -> toNotificationDto(a, scoreById, forecastById))
                .collect(Collectors.toList());

        return new NotificationsResponse(demandNotifications);
    }

    /**
     * Keyword-trend notifications only, split out of {@link #getNotificationsForProfile}
     * because each category round-trips to PyTrends via FastAPI rank-markets (up to 75s).
     * The frontend loads this endpoint independently so a slow AI hop cannot block the
     * fast demand-alert feed.
     */
    public NotificationsResponse getKeywordTrendNotifications(UUID profileId) {
        List<String> profileCategories = (profileId != null)
                ? profileRepo.findById(profileId)
                        .map(p -> p.categoriesList())
                        .orElse(List.of())
                : List.of();

        List<NotificationDto> keywordNotifications =
                categoryRankService.buildForCategories(profileCategories);

        return new NotificationsResponse(keywordNotifications);
    }

    /**
     * Marks one alert read, scoped to the owning profile so an operator cannot
     * mutate another tenant's notification. No-ops when the id doesn't belong to
     * this profile — read-marking is fire-and-forget from the client, and a
     * silent no-op avoids leaking cross-tenant existence via a 404.
     */
    @Transactional
    public void markRead(UUID profileId, UUID notificationId) {
        alertRepo.findOwnedBy(notificationId, profileId)
                 .ifPresent(a -> { a.setIsRead(true); alertRepo.save(a); });
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

        String title = "Demand Surge Detected — " + marketName;
        String trend = alert.getAlertLevel().equals("WARNING")
                ? "Rising demand window" : "Demand spike";

        DetailsDto details = buildDetails(ms, fr);

        String category = fr != null ? fr.getCategory() : null;

        return new NotificationDto(
                alert.getDemandAlertId().toString(),
                dateStr,
                title,
                marketName,
                marketId,
                trend,
                Boolean.TRUE.equals(alert.getIsRead()),
                details,
                category,
                alert.getAlertLevel(),
                alert.getAlertMessage()
        );
    }

    private DetailsDto buildDetails(MarketScore ms, ForecastResult fr) {
        int projectedArrivals = ms != null && ms.getHistoricalArrivals() != null
                ? (int) (ms.getHistoricalArrivals() * 1.05) : 80_000;

        double growthRate = ms != null && ms.getGdpPerCapitaGrowth() != null
                ? ms.getGdpPerCapitaGrowth() : 2.0;

        double score = ms != null && ms.getMarketScore() != null ? ms.getMarketScore() : 0.5;

        List<TopInterestDto> interests = List.of(
                new TopInterestDto("Beach & Resort", (int) (score * 100)),
                new TopInterestDto("Cultural Tours",  (int) (score * 85)),
                new TopInterestDto("Adventure",       (int) (score * 70))
        );

        StrategicInsightsDto insights = new StrategicInsightsDto(
                "Trend alignment: " + (score >= 0.7 ? "Strong" : "Moderate"),
                ms != null && Boolean.TRUE.equals(ms.getSpikeIndicator())
                        ? "Demand spike active — immediate action recommended"
                        : "Steady demand growth observed",
                String.format("Market score %.0f%%", score * 100)
        );

        return new DetailsDto(
                projectedArrivals,
                growthRate,
                interests,
                List.of("Leisure", "Adventure", "Cultural"),
                insights,
                List.of(),   // keywordData — populated by Module 3 content service
                null         // contentStrategy — nullable per DTO spec
        );
    }
}
