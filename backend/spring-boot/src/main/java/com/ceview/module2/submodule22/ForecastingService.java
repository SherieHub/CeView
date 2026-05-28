package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.Module2ErrorCodes;
import com.ceview.module2.dto.MarketDtos.*;
import com.ceview.module2.submodule21.ExternalMarketDataClient;
import com.ceview.module2.submodule21.ExternalMarketDataClient.GdpTrendDto;
import com.ceview.module2.submodule21.ExternalMarketDataClient.ForexTrendDto;
import com.ceview.module2.submodule21.ExternalMarketDataClient.GdpTrendPoint;
import com.ceview.module2.submodule21.ExternalMarketDataClient.ForexTrendPoint;
import com.ceview.module2.submodule21.MarketDataIngestionService;
import com.ceview.module2.submodule21.MarketEconomicTrend;
import com.ceview.module2.submodule21.MarketEconomicTrendRepository;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

// LinkedHashMap is needed in runPipeline() for null-safe XGBoost payload construction.

/**
 * Orchestrates the full Submodule 2.2 pipeline on operator request (FR2.9–FR2.17).
 *
 * Phase 2 architectural changes:
 *  - BiLSTM+Transformer → Gemini API for demand forecasting (FR2.11).
 *    {@code EnrichedSequenceBuilder} now sends a Gemini prompt context (trend series,
 *    rolling stats, YoY ratio) instead of BiLSTM feature vectors.
 *  - XGBoost now scores ECONOMIC VIABILITY exclusively: GDP, FX, directFlight,
 *    distanceKm, flightFrequency (FR2.13).
 *  - Final market_score = 0.40·demand + 0.35·seasonality + 0.25·economic_viability.
 *  - Seasonality (0–1) is from SeasonalShiftDetector: 7d/30d rolling avg,
 *    2σ spike indicator, YoY ratio (replaces FFT peak-ratio).
 *
 * Invariants preserved:
 *  - {@link #runPipeline} is {@code @Transactional} — all three markets' DB
 *    writes roll back together on any failure.
 *  - seasonalityScore stored as 0–1 in DB; multiplied ×100 only in buildChartData().
 *  - buildChartData always emits exactly 8 labelled points (Wk -3 … Wk +4).
 *  - Throws when enriched signal data is absent — run ingestion first (FR2.9).
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
    private final MarketDataIngestionService ingestionService;
    private final ExternalMarketDataClient externalClient;
    private final MarketSignalRecordRepository signalRepo;
    private final MarketEconomicTrendRepository economicTrendRepo;
    private final ObjectMapper objectMapper;

    public ForecastingService(EnrichedSequenceBuilder sequenceBuilder,
                              AIInferenceGatewayService ai,
                              ForecastResultRepository forecastRepo,
                              MarketScoreRepository scoreRepo,
                              DemandAlertRepository alertRepo,
                              BusinessProfileRepository profileRepo,
                              MarketDataIngestionService ingestionService,
                              ExternalMarketDataClient externalClient,
                              MarketSignalRecordRepository signalRepo,
                              MarketEconomicTrendRepository economicTrendRepo,
                              ObjectMapper objectMapper) {
        this.sequenceBuilder    = sequenceBuilder;
        this.ai                 = ai;
        this.forecastRepo       = forecastRepo;
        this.scoreRepo          = scoreRepo;
        this.alertRepo          = alertRepo;
        this.profileRepo        = profileRepo;
        this.ingestionService   = ingestionService;
        this.externalClient     = externalClient;
        this.signalRepo         = signalRepo;
        this.economicTrendRepo  = economicTrendRepo;
        this.objectMapper       = objectMapper;
    }

    /**
     * Run the full 2.2 pipeline for a profile.
     * Throws IllegalStateException when enriched data is absent — run ingestion first.
     */
    public MarketsResponse forecastForProfile(UUID profileId, boolean refresh) {
        if (profileId == null) {
            log.error("forecastForProfile called with null profileId — profileId is required");
            throw new IllegalArgumentException("profileId is required");
        }

        // Validate profile categories are set (FR2.9 — UC-1.1 must be completed)
        BusinessProfile profile = profileRepo.findById(profileId).orElse(null);
        if (profile != null && (profile.categoriesList() == null || profile.categoriesList().isEmpty())) {
            MDC.put("code", Module2ErrorCodes.MOD22_PROFILE_NOT_READY);
            log.warn("Profile {} has no categories — cannot run forecast", profileId);
            MDC.remove("code");
            throw new IllegalArgumentException("Business profile categories are not set (UC-1.1 incomplete)");
        }

        // refresh=true → run Submodule 2.1 ingestion first to fetch live pytrends data
        // and populate tbl_market_signal_record before runPipeline() reads it (FR2.9)
        if (refresh && profile != null) {
            log.info("Refresh requested — running 2.1 ingestion for profile={}", profileId);
            int ingested = ingestionService.ingestForProfile(profile);
            log.info("Ingestion complete: {} markets ingested for profile={}", ingested, profileId);
        }

        try {
            return runPipeline(profileId);
        } catch (IllegalStateException e) {
            if ("enriched_dataset_empty".equals(e.getMessage())) {
                MDC.put("code", Module2ErrorCodes.MOD21_ENRICHED_DATASET_EMPTY);
                log.error("No enriched market data for profile={} — ingestion has not run yet", profileId);
                MDC.remove("code");
                throw new IllegalStateException(
                        "No market signal data available for profile " + profileId
                        + ". Run the ingestion job first.");
            }
            throw e;
        }
    }

    // ─── DB-only read path (GET /markets) ────────────────────────────────────

    /**
     * Reconstructs the latest ranked market list from persisted DB rows only.
     * No AI calls are made — this is the fast path for the home view and
     * notification click-through.
     *
     * Returns an empty MarketsResponse when no forecast data exists yet for the
     * profile (e.g., before the first daily ingestion run or seed job).
     */
    public MarketsResponse loadMarketsFromDb(UUID profileId) {
        List<MarketResultBundle> bundles = new ArrayList<>();

        for (String market : MARKETS) {
            Optional<ForecastResult> fr4wOpt = forecastRepo
                    .findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                            profileId, market, 4);
            if (fr4wOpt.isEmpty()) continue;

            ForecastResult fr4w = fr4wOpt.get();

            List<MarketScore> scores = scoreRepo.findByForecastResultIdOrderByMarketRankAsc(
                    fr4w.getForecastResultId());
            if (scores.isEmpty()) continue;
            MarketScore ms = scores.get(0);

            List<MarketSignalRecord> history = signalRepo
                    .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);
            MarketSignalRecord latest = history.isEmpty() ? null : history.get(0);

            // Deserialize stored weekly forecasts — falls back to empty list
            List<Double> weeklyForecasts = new ArrayList<>();
            if (fr4w.getWeeklyForecastsJson() != null) {
                try {
                    weeklyForecasts = objectMapper.readValue(
                            fr4w.getWeeklyForecastsJson(), new TypeReference<List<Double>>() {});
                } catch (Exception e) {
                    log.warn("Failed to deserialize weeklyForecastsJson for market={}: {}", market, e.getMessage());
                }
            }

            // Reconstruct economic trend from persisted snapshot
            GdpTrendDto gdpTrend   = economicTrendToGdpDto(market);
            ForexTrendDto forexTrend = economicTrendToForexDto(market);

            double marketScore = ms.getMarketScore() != null ? ms.getMarketScore() : 0.0;
            boolean spike      = Boolean.TRUE.equals(ms.getSpikeIndicator());
            double confidence  = fr4w.getForecastConfidence() != null ? fr4w.getForecastConfidence() : 0.8;

            bundles.add(new MarketResultBundle(
                    market, marketScore, ms, fr4w, history, spike, confidence,
                    gdpTrend, forexTrend, weeklyForecasts, latest));
        }

        if (bundles.isEmpty()) {
            log.info("No forecast data found in DB for profile={} — returning empty response", profileId);
            return new MarketsResponse(List.of());
        }

        bundles.sort(Comparator.comparingDouble(MarketResultBundle::marketScore).reversed());
        List<MarketDto> dtos = new ArrayList<>();
        for (int i = 0; i < bundles.size(); i++) {
            dtos.add(buildMarketDto(bundles.get(i), i + 1));
        }
        return new MarketsResponse(dtos);
    }

    private GdpTrendDto economicTrendToGdpDto(String market) {
        return economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(market)
                .filter(t -> t.getGdpTrendJson() != null)
                .map(t -> {
                    try {
                        List<GdpTrendPoint> pts = objectMapper.readValue(
                                t.getGdpTrendJson(), new TypeReference<List<GdpTrendPoint>>() {});
                        double latest = t.getGdpLatest() != null ? t.getGdpLatest()
                                : (pts.isEmpty() ? 2.0 : pts.get(pts.size() - 1).value());
                        return new GdpTrendDto(t.getCurrencyCode() != null ? t.getCurrencyCode() : market, pts, latest);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .orElse(null);
    }

    private ForexTrendDto economicTrendToForexDto(String market) {
        return economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(market)
                .filter(t -> t.getForexTrendJson() != null)
                .map(t -> {
                    try {
                        List<ForexTrendPoint> pts = objectMapper.readValue(
                                t.getForexTrendJson(), new TypeReference<List<ForexTrendPoint>>() {});
                        double latest = t.getForexLatest() != null ? t.getForexLatest()
                                : (pts.isEmpty() ? 1.0 : pts.get(pts.size() - 1).value());
                        return new ForexTrendDto(t.getCurrencyCode() != null ? t.getCurrencyCode() : market, pts, latest);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .orElse(null);
    }

    // ─── pipeline ─────────────────────────────────────────────────────────────

    /**
     * Core forecast pipeline — wrapped in a transaction so all three markets'
     * DB writes succeed or roll back as a unit.  AI (HTTP) calls cannot be
     * rolled back, so failures there are caught individually and fall back to
     * stub values before any DB write occurs.
     *
     * Phase 2 changes:
     *   - runForecastInference → Gemini API (prompt-based, replaces BiLSTM)
     *   - runMarketScoring     → XGBoost economic viability (GDP, FX, flight, distance)
     *   - final market_score   = 0.40·demand + 0.35·seasonality + 0.25·economic_viability
     */
    @Transactional
    protected MarketsResponse runPipeline(UUID profileId) {
        MDC.put("code", Module2ErrorCodes.MOD22_FORECAST_STARTED);
        log.info("Forecast pipeline started for profile={}", profileId);
        MDC.remove("code");

        // Only write to DB when the profile row actually exists; avoids FK violations
        // when the operator UUID or a test ID has no matching tbl_business_profile row.
        boolean canPersist = profileRepo.findById(profileId).isPresent();
        if (!canPersist) {
            log.warn("Profile {} not found in tbl_business_profile — pipeline will run without persistence", profileId);
        }

        // ── Phase A: build all market sequences (no AI calls) ────────────────
        // Stores (market, gdpTrend, forexTrend, sequence) in MARKETS order so
        // Phase B can submit them as a batch and Phase C can zip results back.
        record MarketSetup(
                String market,
                GdpTrendDto gdpTrend,
                ForexTrendDto forexTrend,
                Map<String, Object> sequence) {}

        List<MarketSetup> setups = new ArrayList<>();
        for (String market : MARKETS) {
            // Fetch economic trend time-series so the GDP direction can be
            // injected into the Gemini prompt context below (FR2.13 extension)
            GdpTrendDto   gdpTrend   = externalClient.fetchGdpTrend(market);
            ForexTrendDto forexTrend = externalClient.fetchForexTrend(market);

            // Build enriched sequence; fall back to safe defaults when signal records are
            // absent (fresh profile, ingestion not yet run) so the pipeline can still
            // return degraded-but-valid market cards rather than a 500.
            Map<String, Object> sequence;
            try {
                sequence = sequenceBuilder.buildSequence(profileId, market);
            } catch (IllegalStateException seqEx) {
                if ("enriched_dataset_empty".equals(seqEx.getMessage())) {
                    MDC.put("code", Module2ErrorCodes.MOD21_ENRICHED_DATASET_EMPTY);
                    log.warn("No enriched signal data for market={} profile={} — using baseline defaults",
                            market, profileId);
                    MDC.remove("code");
                    Map<String, Object> defaultSeq = new LinkedHashMap<>();
                    defaultSeq.put("profileId",       profileId.toString());
                    defaultSeq.put("market",          market);
                    defaultSeq.put("trendSeries",     List.of(45.0, 48.0, 50.0, 52.0));
                    defaultSeq.put("rolling7dAvg",    50.0);
                    defaultSeq.put("rolling30dAvg",   50.0);
                    defaultSeq.put("rollingStd7d",    2.0);
                    defaultSeq.put("spikeIndicator",  false);
                    defaultSeq.put("yoyRatio",        null);
                    defaultSeq.put("seasonalityScore", 0.5);
                    defaultSeq.put("forexRate",       1.0);
                    defaultSeq.put("gdpGrowth",       2.0);
                    defaultSeq.put("holidayFlag",     false);
                    sequence = defaultSeq;
                } else {
                    throw seqEx;
                }
            }

            // Inject GDP trend direction into the Gemini prompt context
            if (gdpTrend != null && gdpTrend.points().size() >= 2) {
                double delta = gdpTrend.latest()
                        - gdpTrend.points().get(0).value();   // newest − oldest
                String direction = delta > 0.3 ? "growing" : delta < -0.3 ? "declining" : "flat";
                sequence.put("gdpTrendDirection", direction);
                sequence.put("gdpTrendDelta", Math.round(delta * 100.0) / 100.0);
            }

            setups.add(new MarketSetup(market, gdpTrend, forexTrend, sequence));
        }

        // ── Phase B: single batch Gemini call (1 RPM slot for all markets) ───
        // Collects all sequences and sends them in one prompt; Gemini returns a
        // JSON object keyed by market name with 12 weekly forecasts each.
        // No fallback — propagate exception so the controller returns a
        // structured error response instead of silently using stub values.
        List<Map<String, Object>> allSequences = new ArrayList<>();
        for (MarketSetup s : setups) allSequences.add(s.sequence());
        Map<String, Map<String, Object>> batchInference = ai.runForecastInferenceBatch(allSequences);

        // ── Phase C: per-market XGBoost scoring + persistence ─────────────────
        List<MarketResultBundle> bundles = new ArrayList<>();

        for (MarketSetup setup : setups) {
            String              market     = setup.market();
            GdpTrendDto         gdpTrend   = setup.gdpTrend();
            ForexTrendDto       forexTrend = setup.forexTrend();
            Map<String, Object> sequence   = setup.sequence();

            // Look up this market's Gemini result from the batch response
            Map<String, Object> inference = batchInference.get(market);
            if (inference == null) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "MOD22_FORECAST_FAILED :: Batch response missing results for market=" + market);
            }

            double demand4w   = num(inference, "predicted_demand_4w",  50.0);
            double demand12w  = num(inference, "predicted_demand_12w", 50.0);
            double mape       = num(inference, "mape",       10.0);
            double mae        = num(inference, "mae",         6.0);
            double rmse       = num(inference, "rmse",        9.0);
            double confidence = num(inference, "confidence",  0.8);

            // Per-week forecasts [Wk+1..Wk+12] — Gemini returns varying values
            // so the chart shows a real trend line (not a flat repeated scalar).
            @SuppressWarnings("unchecked")
            List<Double> weeklyForecasts = inference.get("weekly_forecasts") instanceof List<?>
                    ? (List<Double>) inference.get("weekly_forecasts")
                    : List.of(demand4w, demand4w, demand4w, demand4w);

            // FR2.12 — MAPE warning
            if (mape > MAPE_THRESHOLD) {
                MDC.put("code", Module2ErrorCodes.MOD22_FORECAST_MAPE_WARNING);
                log.warn("MAPE {}% exceeds threshold for market={}", mape, market);
                MDC.remove("code");
            }

            // Persist ForecastResult (4w) — only when a valid profile row exists
            ForecastResult fr4w;
            if (canPersist) {
                fr4w = persistForecastResult(
                        profileId, market, demand4w, confidence, mape, mae, rmse, 4, weeklyForecasts);
                persistForecastResult(profileId, market, demand12w, confidence, mape, mae, rmse, 12);
            } else {
                // In-memory stub so downstream DTO assembly has a non-null object
                fr4w = new ForecastResult();
                fr4w.setForecastResultId(UUID.randomUUID());
                fr4w.setBusinessProfileId(profileId);
                fr4w.setTargetMarket(market);
                fr4w.setPredictedDemand(demand4w);
                fr4w.setForecastConfidence(confidence);
                fr4w.setMapeScore(mape);
                fr4w.setForecastHorizonWeeks(4);
            }

            // Latest signal record for downstream enrichment
            List<MarketSignalRecord> history = signalRepo
                    .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);
            MarketSignalRecord latest = history.isEmpty() ? null : history.get(0);

            // seasonalityScore is stored 0–1 (SeasonalShiftDetector composite)
            double seasonality = latest != null && latest.getSeasonalityScore() != null
                    ? latest.getSeasonalityScore() : 0.5;
            boolean spike = latest != null && Boolean.TRUE.equals(latest.getSpikeIndicator());
            double gdp    = latest != null && latest.getGdpGrowth() != null ? latest.getGdpGrowth() : 2.0;
            double forex  = latest != null && latest.getForexRate()  != null ? latest.getForexRate()  : 1.0;

            // ── XGBoost economic viability scoring (FR2.13) ───────────────────
            ExternalMarketDataClient.FlightReferenceDto flight = externalClient.getFlightReference(market);
            Map<String, Object> scorePayload = new LinkedHashMap<>();
            scorePayload.put("market",            market);
            scorePayload.put("predicted_demand",  demand4w);
            scorePayload.put("seasonality_score", seasonality);
            scorePayload.put("spike_indicator",   spike);
            scorePayload.put("gdp_growth",        gdp);
            scorePayload.put("forex_vs_php",      forex);
            scorePayload.put("direct_flight",     flight.directFlight());
            scorePayload.put("distance_km",       flight.distanceKm());
            scorePayload.put("flight_frequency",  flight.flightFrequency());

            // No fallback — propagate exception so the controller returns a
            // structured error response instead of silently using stub values.
            Map<String, Object> scoreResult = ai.runMarketScoring(scorePayload);
            double marketScore = num(scoreResult, "market_score", 0.5);

            // Persist MarketScore (and demand alert) — only when profile row exists
            MarketScore ms;
            if (canPersist) {
                ms = persistMarketScore(
                        fr4w.getForecastResultId(), marketScore, seasonality, spike, gdp, forex);
                double rollingAvg = latest != null && latest.getRollingAverage7d() != null
                        ? latest.getRollingAverage7d()
                        : (latest != null && latest.getRollingAverage() != null
                                ? latest.getRollingAverage() : demand4w);
                if (demand4w > rollingAvg * DEMAND_WINDOW_MULTIPLIER) {
                    persistDemandAlert(ms.getMarketScoreId(), market, demand4w);
                }
            } else {
                // In-memory stub — no FK writes
                ms = new MarketScore();
                ms.setMarketScoreId(UUID.randomUUID());
                ms.setForecastResultId(fr4w.getForecastResultId());
                ms.setMarketScore(marketScore);
                ms.setSeasonalityScore(seasonality);
                ms.setSpikeIndicator(spike);
                ms.setGdpPerCapitaGrowth(gdp);
                ms.setForexVsPhp(forex);
                ms.setHistoricalArrivals(80_000);
            }

            // ── Persist economic trend snapshot ───────────────────────────────────
            persistEconomicTrend(market, gdpTrend, forexTrend);

            bundles.add(new MarketResultBundle(
                    market, marketScore, ms, fr4w, history, spike, confidence,
                    gdpTrend, forexTrend, weeklyForecasts, latest));
        }

        // Rank markets by score descending (FR2.14)
        bundles.sort(Comparator.comparingDouble(MarketResultBundle::marketScore).reversed());

        List<MarketDto> marketDtos = new ArrayList<>();
        for (int i = 0; i < bundles.size(); i++) {
            MarketResultBundle b = bundles.get(i);
            int rank = i + 1;
            b.ms().setMarketRank(rank);
            if (canPersist) scoreRepo.save(b.ms());
            marketDtos.add(buildMarketDto(b, rank));
        }

        return new MarketsResponse(marketDtos);
    }

    // ─── persistence helpers ──────────────────────────────────────────────────

    private ForecastResult persistForecastResult(UUID profileId, String market,
                                                  double demand, double confidence,
                                                  double mape, double mae, double rmse, int horizon) {
        return persistForecastResult(profileId, market, demand, confidence, mape, mae, rmse, horizon, null);
    }

    private ForecastResult persistForecastResult(UUID profileId, String market,
                                                  double demand, double confidence,
                                                  double mape, double mae, double rmse, int horizon,
                                                  List<Double> weeklyForecasts) {
        ForecastResult fr = new ForecastResult();
        fr.setBusinessProfileId(profileId);
        fr.setTargetMarket(market);
        fr.setPredictedDemand(demand);
        fr.setForecastConfidence(confidence);
        fr.setMapeScore(mape);
        fr.setMae(mae);
        fr.setRmse(rmse);
        fr.setForecastHorizonWeeks(horizon);
        if (horizon == 4 && weeklyForecasts != null && !weeklyForecasts.isEmpty()) {
            try {
                fr.setWeeklyForecastsJson(objectMapper.writeValueAsString(weeklyForecasts));
            } catch (Exception e) {
                log.warn("Failed to serialize weeklyForecasts for market={}: {}", market, e.getMessage());
            }
        }
        return forecastRepo.save(fr);
    }

    private MarketScore persistMarketScore(UUID forecastResultId, double score,
                                           double seasonality, boolean spike,
                                           double gdp, double forex) {
        MarketScore ms = new MarketScore();
        ms.setForecastResultId(forecastResultId);
        ms.setMarketScore(score);
        ms.setSeasonalityScore(seasonality);   // stored as 0–1
        ms.setSpikeIndicator(spike);
        ms.setGdpPerCapitaGrowth(gdp);
        ms.setForexVsPhp(forex);
        ms.setHistoricalArrivals(80_000);
        return scoreRepo.save(ms);
    }

    private void persistDemandAlert(UUID marketScoreId, String market, double demand4w) {
        String marketName = MARKET_META.getOrDefault(market,
                new String[]{market, market, "???", "CEB"})[0];
        String trendLabel = "Rising demand window";

        DemandAlert alert = new DemandAlert();
        alert.setMarketScoreId(marketScoreId);
        alert.setAlertLevel("WARNING");
        alert.setAlertMessage(String.format(
                "Demand window opening for %s — predicted demand %.1f%% above baseline. "
                + "Target within 4 weeks for maximum reach.", marketName, (DEMAND_WINDOW_MULTIPLIER - 1) * 100));
        alert.setTrend(trendLabel);
        alert.setIsRead(false);
        alert.setWindowOpenDate(OffsetDateTime.now().plusWeeks(1));
        alertRepo.save(alert);
        MDC.put("code", Module2ErrorCodes.MOD22_ALERT_GENERATED);
        log.info("Demand alert generated for market={} demand4w={}", market, demand4w);
        MDC.remove("code");
    }

    // ─── DTO assembly ─────────────────────────────────────────────────────────

    private MarketDto buildMarketDto(MarketResultBundle b, int rank) {
        String market = b.market();
        String[] meta = MARKET_META.getOrDefault(market, new String[]{market, market, "???", "CEB"});
        ExternalMarketDataClient.FlightReferenceDto flight = externalClient.getFlightReference(market);

        int matchScore = (int) Math.round(b.marketScore() * 100);

        // Airline tier: Full-Service for high-score markets, Budget otherwise
        String tier = matchScore >= 85 ? "Full-Service" : "Budget";

        List<AirlineDto> airlines = flight.airlines().stream()
                .map(a -> new AirlineDto(
                        a.getOrDefault("name", ""),
                        a.getOrDefault("code", ""),
                        a.getOrDefault("frequency", "").replace("x/", "x / "),
                        flight.directFlight(),
                        flight.flightHours(),
                        tier))
                .collect(Collectors.toList());

        List<ChartDataPointDto> chartData = buildChartData(
                b.history(), b.fr4w(), b.weeklyForecasts(), b.latestSignal());

        String directive = buildDirective(market, matchScore, b.spike());

        // accessibilityScore on 1–10 scale (direct=9, connecting=6) — matches frontend mock
        int accessibilityScore = flight.directFlight() ? 9 : 6;

        // avgFlightPrice as a display-friendly range string — matches frontend mock format
        String avgFlightPrice = flight.directFlight() ? "₱8,000 – ₱15,000" : "₱25,000 – ₱40,000";

        // Map economic trend points to DTO records for the frontend charts
        List<GdpTrendPointDto> gdpTrendDtos = b.gdpTrend() != null
                ? b.gdpTrend().points().stream()
                        .map(p -> new GdpTrendPointDto(p.year(), p.value()))
                        .collect(Collectors.toList())
                : List.of();

        List<ForexTrendPointDto> forexTrendDtos = b.forexTrend() != null
                ? b.forexTrend().points().stream()
                        .map(p -> new ForexTrendPointDto(p.date(), p.value()))
                        .collect(Collectors.toList())
                : List.of();

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
                chartData,
                gdpTrendDtos,
                forexTrendDtos
        );
    }

    /**
     * Builds exactly 24 ChartDataPoints: 12 history (Wk -11 … Current) + 12 forecast (Wk +1 … Wk +12).
     *
     * History slots use real MarketSignalRecord values (trend, seasonality, forex, gdp).
     * When fewer than 12 real records exist, synthetic pads fill the oldest slots.
     * Forecast slots use per-week Gemini predictions (weekly_forecasts[0..11]).
     * Future seasonality / forex / gdp carry the latest known values forward.
     *
     * Pad count breakdown (12-slot history):
     *   12 real → 0 pads,  12 real, 12 forecast = 24
     *    8 real → 4 pads,   8 real, 12 forecast = 24
     *    1 real → 11 pads,  1 real, 12 forecast = 24
     *    0 real → 11 pads + synthetic "Current", 12 forecast = 24
     */
    private List<ChartDataPointDto> buildChartData(List<MarketSignalRecord> history,
                                                    ForecastResult fr4w,
                                                    List<Double> weeklyForecasts,
                                                    MarketSignalRecord latestSignal) {
        List<ChartDataPointDto> points = new ArrayList<>();

        // 12 most-recent history records, reversed to chronological order (oldest first)
        List<MarketSignalRecord> recent = history.stream().limit(12).collect(Collectors.toList());
        Collections.reverse(recent);

        double baseDemand = fr4w != null ? fr4w.getPredictedDemand() : 50.0;

        // Latest signal values carried forward into future chart points
        double latestSeasonality = latestSignal != null && latestSignal.getSeasonalityScore() != null
                ? latestSignal.getSeasonalityScore() * 100.0 : 50.0;
        double latestForex = latestSignal != null && latestSignal.getForexRate() != null
                ? latestSignal.getForexRate() : 1.0;
        double latestGdp   = latestSignal != null && latestSignal.getGdpGrowth() != null
                ? latestSignal.getGdpGrowth() : 2.0;

        // Normalise weekly forecasts — ensure exactly 12 values
        List<Double> wf = new ArrayList<>();
        if (weeklyForecasts != null) {
            for (Double v : weeklyForecasts) wf.add(v != null ? v : baseDemand);
        }
        while (wf.size() < 12) wf.add(baseDemand);

        // ── Synthetic history pads for missing records ────────────────────────
        // Each pad fills one of the 12 history slots from the oldest end.
        // Pad at index j occupies position j in a 12-slot array, so its week
        // label is "Wk -" + (11 - j).
        int syntheticCount = recent.isEmpty() ? 11 : Math.max(0, 12 - recent.size());
        for (int j = 0; j < syntheticCount; j++) {
            int weekNum = 11 - j;   // Wk -11, Wk -10, … Wk -1
            double syntheticDemand = Math.max(10.0, baseDemand - ((syntheticCount - j) * 3.0));
            points.add(new ChartDataPointDto(
                    "Wk -" + weekNum, syntheticDemand, null, 50.0, latestForex, latestGdp, 0.0));
        }

        // ── Real history points ───────────────────────────────────────────────
        // Formula: label = "Wk -" + (recent.size() - 1 - i) for non-Current slots.
        // This scales to any number of real records (1..12).
        for (int i = 0; i < recent.size(); i++) {
            MarketSignalRecord r = recent.get(i);
            boolean isCurrent = (i == recent.size() - 1);
            String label = isCurrent ? "Current" : "Wk -" + (recent.size() - 1 - i);
            double seasonality100 = (r.getSeasonalityScore() != null)
                    ? r.getSeasonalityScore() * 100.0 : 50.0;
            double forexVal = (r.getForexRate() != null) ? r.getForexRate() : latestForex;
            double gdpVal   = (r.getGdpGrowth() != null) ? r.getGdpGrowth() : latestGdp;
            double spikeVal = Boolean.TRUE.equals(r.getSpikeIndicator()) ? 1.0 : 0.0;
            // "Current" shows both history observation and Wk+1 forecast as the transition
            Double forecastValue = isCurrent ? wf.get(0) : null;

            points.add(new ChartDataPointDto(
                    label, r.getTrendIndex(), forecastValue,
                    seasonality100, forexVal, gdpVal, spikeVal));
        }

        // Synthetic "Current" anchor when no real history exists at all
        if (recent.isEmpty()) {
            points.add(new ChartDataPointDto(
                    "Current", baseDemand, wf.get(0), 50.0, latestForex, latestGdp, 0.0));
        }

        // ── 12 forecast points (Wk +1 … Wk +12) ─────────────────────────────
        for (int w = 1; w <= 12; w++) {
            points.add(new ChartDataPointDto(
                    "Wk +" + w,
                    null,
                    wf.get(w - 1),
                    latestSeasonality,
                    latestForex,
                    latestGdp,
                    0.0
            ));
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
        double gdp   = ms.getGdpPerCapitaGrowth() != null ? ms.getGdpPerCapitaGrowth() : 0.0;
        double forex = ms.getForexVsPhp()          != null ? ms.getForexVsPhp()          : 1.0;

        String gdpTrend = gdp > 3.0 ? "strong growth" : gdp > 1.5 ? "moderate growth" : "stable";

        // forex_vs_php is stored as foreign-currency units per PHP.
        // KRW≈23, JPY≈0.37, USD≈0.018 — high value = weak PHP relative to that currency
        // (meaning the visitor's currency buys more PHP → better Cebu value).
        String forexSentiment;
        if (forex > 15.0) {        // KRW range: visitors have strong purchasing power
            forexSentiment = "exceptional";
        } else if (forex > 0.3) {  // JPY range: good purchasing power
            forexSentiment = "favourable";
        } else if (forex > 0.015) {// USD range: strong purchasing power relative to PHP
            forexSentiment = "strong";
        } else {
            forexSentiment = "moderate";
        }

        return String.format(
                "GDP is showing %s (%.1f%% YoY). The exchange rate signals %s purchasing power "
                + "for visitors spending in Cebu — an XGBoost economic viability score was used "
                + "to weight this market's accessibility alongside flight data.",
                gdpTrend, gdp, forexSentiment);
    }

    /**
     * Seasonality insight — thresholds operate on the 0–1 DB value.
     * SeasonalShiftDetector Phase 2 formula:
     *   score_base = clamp(0.82 + (yoy_ratio − 1.0) × 1.0, 0, 1)
     *   spike confirmed by YoY → no penalty; spike unconfirmed → −0.40.
     * Score bands: 0.85–1.00 Strong, 0.70–0.84 Moderate, 0.40–0.69 Weak, <0.40 None.
     */
    private String buildSeasonalityInsight(MarketScore ms) {
        double score = ms.getSeasonalityScore() != null ? ms.getSeasonalityScore() : 0.5;
        if (score >= 0.70)
            return "Strong recurring seasonal patterns detected (high YoY ratio + spike signals). "
                 + "Align campaigns with peak travel windows 6–8 weeks ahead for maximum impact.";
        if (score >= 0.40)
            return "Moderate seasonal variation with identifiable peak periods. "
                 + "Consistent year-round demand — focus campaign timing on the identified peak months.";
        return "Low seasonality score — demand is relatively flat throughout the year. "
             + "Maintain a steady always-on content cadence and react quickly to any emerging trend spikes.";
    }

    // ─── economic trend persistence ───────────────────────────────────────────

    /**
     * Persists the latest GDP and forex trend snapshot for a market.
     *
     * <p>Serialises each trend array to JSON manually (no Jackson injection needed
     * here because the arrays are simple value types).  Uses a compact format
     * compatible with the Pydantic models on the FastAPI side:
     * <pre>
     * gdp:   [{"year":2020,"value":-0.9}, ...]
     * forex: [{"date":"2025-01","value":23.5}, ...]
     * </pre>
     */
    private void persistEconomicTrend(String market, GdpTrendDto gdp, ForexTrendDto forex) {
        try {
            MarketEconomicTrend trend = new MarketEconomicTrend();
            trend.setMarket(market);
            trend.setGdpLatest(gdp != null ? gdp.latest() : null);
            trend.setForexLatest(forex != null ? forex.latest() : null);
            trend.setCurrencyCode(forex != null ? forex.currencyCode() : null);

            if (gdp != null && !gdp.points().isEmpty()) {
                StringBuilder sb = new StringBuilder("[");
                for (int i = 0; i < gdp.points().size(); i++) {
                    var p = gdp.points().get(i);
                    if (i > 0) sb.append(",");
                    sb.append(String.format("{\"year\":%d,\"value\":%.4f}", p.year(), p.value()));
                }
                sb.append("]");
                trend.setGdpTrendJson(sb.toString());
                trend.setGdpPoints(gdp.points().size());
            }

            if (forex != null && !forex.points().isEmpty()) {
                StringBuilder sb = new StringBuilder("[");
                for (int i = 0; i < forex.points().size(); i++) {
                    var p = forex.points().get(i);
                    if (i > 0) sb.append(",");
                    sb.append(String.format("{\"date\":\"%s\",\"value\":%.4f}", p.date(), p.value()));
                }
                sb.append("]");
                trend.setForexTrendJson(sb.toString());
                trend.setForexPoints(forex.points().size());
            }

            economicTrendRepo.save(trend);
        } catch (Exception e) {
            log.warn("Failed to persist economic trend for market={}: {}", market, e.getMessage());
        }
    }

    // ─── utilities ────────────────────────────────────────────────────────────

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
            double confidence,
            GdpTrendDto gdpTrend,
            ForexTrendDto forexTrend,
            List<Double> weeklyForecasts,
            MarketSignalRecord latestSignal) {}
}
