package com.ceview.module2.submodule22;

<<<<<<< HEAD
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.dto.NotificationDtos.*;
=======
import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.dto.NotificationDtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
>>>>>>> paldo
import org.springframework.stereotype.Service;

import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Reads persisted demand alerts from the DB and maps them to the
 * NotificationsResponse DTO shape (FR2.15, FR2.17).
<<<<<<< HEAD
 * Returns an empty list when no alerts exist — no stub fallback.
=======
 * Falls back to the legacy FastAPI stub when no alerts exist.
>>>>>>> paldo
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
<<<<<<< HEAD
=======
    private final AIInferenceGatewayService ai;
    private final ObjectMapper mapper;
>>>>>>> paldo
    private final BusinessProfileRepository profileRepo;
    private final CategoryRankNotificationService categoryRankService;

    public NotificationService(DemandAlertRepository alertRepo,
                                MarketScoreRepository scoreRepo,
                                ForecastResultRepository forecastRepo,
<<<<<<< HEAD
=======
                                AIInferenceGatewayService ai,
                                ObjectMapper mapper,
>>>>>>> paldo
                                BusinessProfileRepository profileRepo,
                                CategoryRankNotificationService categoryRankService) {
        this.alertRepo           = alertRepo;
        this.scoreRepo           = scoreRepo;
        this.forecastRepo        = forecastRepo;
<<<<<<< HEAD
=======
        this.ai                  = ai;
        this.mapper              = mapper;
>>>>>>> paldo
        this.profileRepo         = profileRepo;
        this.categoryRankService = categoryRankService;
    }

    public NotificationsResponse getNotificationsForProfile(UUID profileId) {
        // Fetch keyword-trend notifications regardless of whether demand alerts exist
        List<String> profileCategories = (profileId != null)
                ? profileRepo.findById(profileId)
                        .map(p -> p.categoriesList())
                        .orElse(List.of())
                : List.of();

        List<NotificationDto> keywordNotifications =
                categoryRankService.buildForCategories(profileCategories);

        if (profileId == null) {
<<<<<<< HEAD
            return new NotificationsResponse(keywordNotifications);
=======
            NotificationsResponse stub = fromStub();
            List<NotificationDto> merged = new ArrayList<>(keywordNotifications);
            merged.addAll(stub.notifications());
            return new NotificationsResponse(merged);
>>>>>>> paldo
        }

        // Gather latest ForecastResult per market → join to MarketScore → DemandAlert
        List<ForecastResult> forecasts = new ArrayList<>();
        for (String market : List.of("korea", "japan", "usa")) {
            forecastRepo.findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                    profileId, market, 4).ifPresent(forecasts::add);
        }

        if (forecasts.isEmpty()) {
<<<<<<< HEAD
            return new NotificationsResponse(keywordNotifications);
=======
            NotificationsResponse stub = fromStub();
            List<NotificationDto> merged = new ArrayList<>(keywordNotifications);
            merged.addAll(stub.notifications());
            return new NotificationsResponse(merged);
>>>>>>> paldo
        }

        List<UUID> forecastIds = forecasts.stream()
                .map(ForecastResult::getForecastResultId)
                .collect(Collectors.toList());

        List<MarketScore> scores = scoreRepo.findByForecastResultIdIn(forecastIds);
        if (scores.isEmpty()) {
<<<<<<< HEAD
            return new NotificationsResponse(keywordNotifications);
=======
            NotificationsResponse stub = fromStub();
            List<NotificationDto> merged = new ArrayList<>(keywordNotifications);
            merged.addAll(stub.notifications());
            return new NotificationsResponse(merged);
>>>>>>> paldo
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

        // Keyword trend notifications appear first (most recent signal), then demand alerts
        List<NotificationDto> merged = new ArrayList<>(keywordNotifications);
        merged.addAll(demandNotifications);

<<<<<<< HEAD
=======
        // Fallback to stub if both pipelines returned nothing
        if (merged.isEmpty()) {
            return fromStub();
        }

>>>>>>> paldo
        return new NotificationsResponse(merged);
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

        return new NotificationDto(
                alert.getDemandAlertId().toString(),
                dateStr,
                title,
                marketName,
                marketId,
                trend,
                false,
                details
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
<<<<<<< HEAD
=======

    private NotificationsResponse fromStub() {
        return mapper.convertValue(ai.listNotifications(), NotificationsResponse.class);
    }
>>>>>>> paldo
}
