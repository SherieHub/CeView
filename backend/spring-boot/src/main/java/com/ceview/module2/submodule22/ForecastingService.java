package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.Module2ErrorCodes;
import com.ceview.module2.dto.MarketDtos.*;
import com.ceview.module2.submodule21.ExternalMarketDataClient;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Orchestrates the full Submodule 2.2 pipeline on operator request (FR2.9–FR2.17).
 * Falls back to the legacy stub path when enriched data is unavailable.
 */
@Service
public class ForecastingService {

    private static final Logger log = LoggerFactory.getLogger(ForecastingService.class);
    private static final double MAPE_THRESHOLD = 15.0;
    private static final double DEMAND_WINDOW_MULTIPLIER = 1.2;
    private static final List<String> MARKETS = List.of("korea", "japan", "usa");

    // Static display metadata: [name, city, nearestAirport (full), destinationAirport (full)]
    private static final Map<String, String[]> MARKET_META = Map.of(
            "korea", new String[]{"South Korea",   "Seoul",       "ICN — Incheon Int'l",      "CEB — Mactan-Cebu Int'l"},
            "japan", new String[]{"Japan",          "Osaka",       "KIX — Kansai Int'l",       "CEB — Mactan-Cebu Int'l"},
            "usa",   new String[]{"United States",  "Los Angeles", "LAX — Los Angeles Int'l",  "MNL — Ninoy Aquino Int'l"}
    );
    private static final Map<String, List<String>> PEAK_MONTHS = Map.of(
            "korea", List.of("Jul", "Aug", "Dec", "Jan"),
            "japan", List.of("Apr", "May", "Aug", "Mar"),
            "usa",   List.of("Jun", "Jul", "Aug", "Dec")
    );

    private final EnrichedSequenceBuilder sequenceBuilder;
    private final AIInferenceGatewayService ai;
    private final ForecastResultRepository forecastRepo;
    private final MarketScoreRepository scoreRepo;
    private final DemandAlertRepository alertRepo;
    private final BusinessProfileRepository profileRepo;
    private final ExternalMarketDataClient externalClient;
    private final MarketSignalRecordRepository signalRepo;
    private final ObjectMapper mapper;

    public ForecastingService(EnrichedSequenceBuilder sequenceBuilder,
                              AIInferenceGatewayService ai,
                              ForecastResultRepository forecastRepo,
                              MarketScoreRepository scoreRepo,
                              DemandAlertRepository alertRepo,
                              BusinessProfileRepository profileRepo,
                              ExternalMarketDataClient externalClient,
                              MarketSignalRecordRepository signalRepo,
                              ObjectMapper mapper) {
        this.sequenceBuilder = sequenceBuilder;
        this.ai              = ai;
        this.forecastRepo    = forecastRepo;
        this.scoreRepo       = scoreRepo;
        this.alertRepo       = alertRepo;
        this.profileRepo     = profileRepo;
        this.externalClient  = externalClient;
        this.signalRepo      = signalRepo;
        this.mapper          = mapper;
    }

    /**
     * Run the full 2.2 pipeline for a profile.
     * Falls back to the legacy stub when enriched data is absent.
     */
    public MarketsResponse forecastForProfile(UUID profileId, boolean refresh) {
        // No profileId → anonymous user, go straight to stub
        if (profileId == null) {
            return toMarketsResponse(ai.forecastMarkets(Map.of("profileId", "")));
        }

        // Validate profile categories are set (FR2.9 — UC-1.1 must be completed)
        BusinessProfile profile = profileRepo.findById(profileId).orElse(null);
        if (profile != null && (profile.categoriesList() == null || profile.categoriesList().isEmpty())) {
            MDC.put("code", Module2ErrorCodes.MOD22_PROFILE_NOT_READY);
            log.warn("Profile {} has no categories — cannot run forecast", profileId);
            MDC.remove("code");
            throw new IllegalArgumentException("Business profile categories are not set (UC-1.1 incomplete)");
        }

        try {
            return runPipeline(profileId);
        } catch (IllegalStateException e) {
            if ("enriched_dataset_empty".equals(e.getMessage())) {
                MDC.put("code", Module2ErrorCodes.MOD21_ENRICHED_DATASET_EMPTY);
                log.info("No enriched data for profile={} — using stub fallback", profileId);
                MDC.remove("code");
                return toMarketsResponse(ai.forecastMarkets(Map.of("profileId", profileId.toString())));
            }
            throw e;
        }
    }

    // ─── pipeline ────────────────────────────────────────────────────────────

    private MarketsResponse runPipeline(UUID profileId) {
        MDC.put("code", Module2ErrorCodes.MOD22_FORECAST_STARTED);
        log.info("Forecast pipeline started for profile={}", profileId);
        MDC.remove("code");

        List<MarketResultBundle> bundles = new ArrayList<>();

        for (String market : MARKETS) {
            Map<String, Object> sequence = sequenceBuilder.buildSequence(profileId, market);

            // BiLSTM+Transformer inference (FR2.11)
            Map<String, Object> inference = ai.runForecastInference(sequence);
            double demand4w     = num(inference, "predicted_demand_4w", 50.0);
            double demand12w    = num(inference, "predicted_demand_12w", 50.0);
            double mape         = num(inference, "mape", 10.0);
            double mae          = num(inference, "mae", 6.0);
            double rmse         = num(inference, "rmse", 9.0);
            double confidence   = num(inference, "confidence", 0.8);

            // FR2.12 — MAPE warning
            if (mape > MAPE_THRESHOLD) {
                MDC.put("code", Module2ErrorCodes.MOD22_FORECAST_MAPE_WARNING);
                log.warn("MAPE {:.1f}% exceeds threshold for market={}", mape, market);
                MDC.remove("code");
            }

            // Persist ForecastResult (4w)
            ForecastResult fr4w = persistForecastResult(
                    profileId, market, demand4w, confidence, mape, mae, rmse, 4);
            // Persist ForecastResult (12w) — stored for FR2.17, not used in current ranking
            persistForecastResult(profileId, market, demand12w, confidence, mape, mae, rmse, 12);

            // Latest signal record for feature enrichment
            List<MarketSignalRecord> history = signalRepo
                    .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);
            MarketSignalRecord latest = history.isEmpty() ? null : history.get(0);

            double seasonality = latest != null && latest.getSeasonalityScore() != null
                    ? latest.getSeasonalityScore() : 0.5;
            boolean spike = latest != null && Boolean.TRUE.equals(latest.getSpikeIndicator());
            double gdp    = latest != null && latest.getGdpGrowth() != null ? latest.getGdpGrowth() : 2.0;
            double forex  = latest != null && latest.getForexRate()  != null ? latest.getForexRate()  : 1.0;

            // XGBoost market scoring (FR2.13)
            Map<String, Object> scoreResult = ai.runMarketScoring(Map.of(
                    "market",              market,
                    "predicted_demand",    demand4w,
                    "seasonality_score",   seasonality,
                    "spike_indicator",     spike,
                    "gdp_growth",          gdp,
                    "forex_vs_php",        forex,
                    "historical_arrivals", 80_000
            ));
            double marketScore = num(scoreResult, "market_score", 0.5);

            // Persist MarketScore
            MarketScore ms = persistMarketScore(
                    fr4w.getForecastResultId(), marketScore, seasonality, spike, gdp, forex);

            // FR2.15 — demand window alert
            double rollingAvg = latest != null && latest.getRollingAverage() != null
                    ? latest.getRollingAverage() : demand4w;
            if (demand4w > rollingAvg * DEMAND_WINDOW_MULTIPLIER) {
                persistDemandAlert(ms.getMarketScoreId(), market, demand4w);
            }

            bundles.add(new MarketResultBundle(market, marketScore, ms, fr4w, history, spike, confidence));
        }

        // Rank markets by score descending (FR2.14)
        bundles.sort(Comparator.comparingDouble(MarketResultBundle::marketScore).reversed());

        List<MarketDto> marketDtos = new ArrayList<>();
        for (int i = 0; i < bundles.size(); i++) {
            MarketResultBundle b = bundles.get(i);
            int rank = i + 1;
            b.ms().setMarketRank(rank);
            scoreRepo.save(b.ms());
            marketDtos.add(buildMarketDto(b, rank));
        }

        return new MarketsResponse(marketDtos);
    }

    // ─── persistence helpers ─────────────────────────────────────────────────

    private ForecastResult persistForecastResult(UUID profileId, String market,
                                                  double demand, double confidence,
                                                  double mape, double mae, double rmse, int horizon) {
        ForecastResult fr = new ForecastResult();
        fr.setBusinessProfileId(profileId);
        fr.setTargetMarket(market);
        fr.setPredictedDemand(demand);
        fr.setForecastConfidence(confidence);
        fr.setMapeScore(mape);
        fr.setMae(mae);
        fr.setRmse(rmse);
        fr.setForecastHorizonWeeks(horizon);
        return forecastRepo.save(fr);
    }

    private MarketScore persistMarketScore(UUID forecastResultId, double score,
                                           double seasonality, boolean spike,
                                           double gdp, double forex) {
        MarketScore ms = new MarketScore();
        ms.setForecastResultId(forecastResultId);
        ms.setMarketScore(score);
        ms.setSeasonalityScore(seasonality);
        ms.setSpikeIndicator(spike);
        ms.setGdpPerCapitaGrowth(gdp);
        ms.setForexVsPhp(forex);
        ms.setHistoricalArrivals(80_000);
        return scoreRepo.save(ms);
    }

    private void persistDemandAlert(UUID marketScoreId, String market, double demand4w) {
        DemandAlert alert = new DemandAlert();
        alert.setMarketScoreId(marketScoreId);
        alert.setAlertLevel("WARNING");
        alert.setAlertMessage(String.format(
                "Demand window opening for %s — predicted demand %.1f%% above baseline. "
                + "Target within 4 weeks for maximum reach.", market, (DEMAND_WINDOW_MULTIPLIER - 1) * 100));
        alert.setWindowOpenDate(OffsetDateTime.now().plusWeeks(1));
        alertRepo.save(alert);
        MDC.put("code", Module2ErrorCodes.MOD22_ALERT_GENERATED);
        log.info("Demand alert generated for market={} demand4w={}", market, demand4w);
        MDC.remove("code");
    }

    // ─── DTO assembly ────────────────────────────────────────────────────────

    private MarketDto buildMarketDto(MarketResultBundle b, int rank) {
        String market = b.market();
        String[] meta = MARKET_META.getOrDefault(market, new String[]{market, market, "???", "CEB"});
        ExternalMarketDataClient.FlightReferenceDto flight = externalClient.getFlightReference(market);

        int matchScore = (int) Math.round(b.marketScore() * 100);

        // Airline tier: Full-Service / Budget / Premium — matches frontend constants
        String tier = matchScore >= 85 ? "Full-Service" : "Budget";

        List<AirlineDto> airlines = flight.airlines().stream()
                .map(a -> new AirlineDto(
                        a.getOrDefault("name", ""),
                        a.getOrDefault("code", ""),
                        // normalise "7x/week" → "7x / week" to match frontend mock format
                        a.getOrDefault("frequency", "").replace("x/", "x / "),
                        flight.directFlight(),
                        flight.flightHours(),
                        tier))
                .collect(Collectors.toList());

        List<ChartDataPointDto> chartData = buildChartData(b.history(), b.fr4w());

        String directive = buildDirective(market, matchScore, b.spike());

        // accessibilityScore on 1-10 scale (direct=9, connecting=6) — matches frontend mock
        int accessibilityScore = flight.directFlight() ? 9 : 6;

        // avgFlightPrice as a display-friendly range string — matches frontend mock format
        String avgFlightPrice = flight.directFlight() ? "₱8,000 – ₱15,000" : "₱25,000 – ₱40,000";

        return new MarketDto(
                market, rank, meta[0], meta[1], matchScore, directive,
                flight.directFlight(), flight.flightHours(), flight.distanceKm(),
                meta[2], meta[3],
                accessibilityScore,
                flight.flightFrequency(),
                avgFlightPrice,
                airlines,
                PEAK_MONTHS.getOrDefault(market, List.of()),
                buildEconomyInsight(b.ms()),
                buildSeasonalityInsight(b.ms()),
                chartData
        );
    }

    private List<ChartDataPointDto> buildChartData(List<MarketSignalRecord> history,
                                                    ForecastResult fr4w) {
        List<ChartDataPointDto> points = new ArrayList<>();

        // Last 4 historical records (newest first → reverse to oldest-first)
        List<MarketSignalRecord> recent = history.stream().limit(4).collect(Collectors.toList());
        Collections.reverse(recent);

        for (int i = 0; i < recent.size(); i++) {
            MarketSignalRecord r = recent.get(i);
            String label = i < recent.size() - 1
                    ? "Wk -" + (recent.size() - 1 - i)
                    : "Current";
            points.add(new ChartDataPointDto(
                    label,
                    r.getTrendIndex(),
                    null,
                    r.getSeasonalityScore() != null ? r.getSeasonalityScore() : 0.5,
                    r.getForexRate() != null ? r.getForexRate() : 1.0,
                    r.getGdpGrowth() != null ? r.getGdpGrowth() : 2.0,
                    Boolean.TRUE.equals(r.getSpikeIndicator()) ? 1.0 : 0.0
            ));
        }

        // 4-week forecast points
        if (fr4w != null) {
            for (int w = 1; w <= 4; w++) {
                points.add(new ChartDataPointDto(
                        "Wk +" + w,
                        null,
                        fr4w.getPredictedDemand(),
                        0.5, 1.0, 2.0, 0.0
                ));
            }
        }
        return points;
    }

    private String buildDirective(String market, int matchScore, boolean spike) {
        String marketName = MARKET_META.getOrDefault(market, new String[]{market})[0];
        if (spike) {
            return "Demand surge detected in " + marketName + ". Activate targeted promotions immediately — "
                    + "prioritise social content and rate adjustments within 48 hours.";
        }
        if (matchScore >= 85) {
            return marketName + " is your highest-opportunity market. Launch a localised campaign "
                    + "featuring your top-rated offerings for maximum conversion.";
        }
        return marketName + " shows steady demand aligned with your business profile. "
                + "Maintain consistent content cadence and monitor for emerging trend spikes.";
    }

    private String buildEconomyInsight(MarketScore ms) {
        double gdp = ms.getGdpPerCapitaGrowth() != null ? ms.getGdpPerCapitaGrowth() : 0.0;
        String trend = gdp > 2.5 ? "strong growth" : gdp > 1.0 ? "moderate growth" : "stable";
        return String.format("GDP per capita shows %s (%.1f%% YoY). "
                + "Forex rate signals %s purchasing power for Cebu travel.",
                trend, gdp,
                ms.getForexVsPhp() != null && ms.getForexVsPhp() > 0.02 ? "competitive" : "moderate");
    }

    private String buildSeasonalityInsight(MarketScore ms) {
        double score = ms.getSeasonalityScore() != null ? ms.getSeasonalityScore() : 0.5;
        if (score >= 0.7) return "Strong recurring seasonal patterns detected. Align your campaigns with peak travel windows for maximum impact.";
        if (score >= 0.4) return "Moderate seasonal variation. Consistent year-round demand with identifiable peak periods.";
        return "Low seasonality — demand is relatively stable throughout the year.";
    }

    // ─── fallback deserialization ─────────────────────────────────────────────

    private MarketsResponse toMarketsResponse(Map<String, Object> raw) {
        try {
            return mapper.convertValue(raw, MarketsResponse.class);
        } catch (Exception e) {
            log.warn("Failed to deserialize stub MarketsResponse: {}", e.getMessage());
            return new MarketsResponse(List.of());
        }
    }

    // ─── utilities ───────────────────────────────────────────────────────────

    private double num(Map<String, Object> map, String key, double def) {
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).doubleValue() : def;
    }

    private record MarketResultBundle(
            String market,
            double marketScore,
            MarketScore ms,
            ForecastResult fr4w,
            List<MarketSignalRecord> history,
            boolean spike,
            double confidence) {}
}
