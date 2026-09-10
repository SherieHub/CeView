package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.ai.AiDependencyException;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.MarketFlags;
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
import com.ceview.module2.submodule21.TrendFetchJob;
import com.ceview.module2.submodule21.TrendFetchJobRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
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
 *  - buildChartData always emits exactly 24 labelled points (12 history + 12 forecast; see method Javadoc).
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
    private final TrendFetchJobRepository jobRepo;
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
                              TrendFetchJobRepository jobRepo,
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
        this.jobRepo            = jobRepo;
        this.objectMapper       = objectMapper;
    }

    /**
     * No genuinely-measured signal exists for this market.
     *
     * <p>Deliberately not an empty forecast: a zeroed market score renders as a
     * real "demand is low" reading. The operator needs to know the difference
     * between "we measured low demand" and "we could not measure".
     */
    public static AiDependencyException noMarketData(String market, String lastIngestionError) {
        return AiDependencyException.fromBody(424, java.util.Map.of(
                "code", Module2ErrorCodes.MOD22_NO_MARKET_DATA,
                "message", "No measured demand data exists for " + market + " yet.",
                "dependency", "pytrends",
                "cause", lastIngestionError == null
                        ? "no successful trend fetch has completed for this market"
                        : lastIngestionError,
                "stage", "spring/forecasting"), "forecasting/markets");
    }

    /**
     * Run the full 2.2 pipeline for a profile.
     * Throws IllegalStateException when enriched data is absent — run ingestion first.
     */
    @Transactional
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
            // Step 7: EnrichedSequenceBuilder now suffixes this with the reason
            // (":count=N" / ":field=X") — startsWith, not equals, so that detail
            // doesn't defeat this match.
            if (e.getMessage() != null && e.getMessage().startsWith("enriched_dataset_empty")) {
                MDC.put("code", Module2ErrorCodes.MOD22_NO_MARKET_DATA);
                log.error("No enriched market data for profile={} — ingestion has not run yet", profileId);
                MDC.remove("code");
                throw new IllegalStateException(
                        "No market signal data available for profile " + profileId
                        + ". Run the ingestion job first.");
            }
            throw e;
        }
    }

    /**
     * Staleness-aware live forecast for the Home view.
     *
     * Runs the full live pipeline (2.1 ingestion + 2.2 Gemini/XGBoost) when the
     * profile has no forecast yet, or its newest 4-week forecast is older than
     * {@code maxAgeHours}. Otherwise serves the cached DB rows unchanged.
     *
     * This is what makes the Home cards reflect a live forecast on load while
     * avoiding an expensive Gemini batch call on every single page visit.
     *
     * @throws IllegalArgumentException when the profile is missing or its
     *         categories are not set (UC-1.1 incomplete) — surfaced by the
     *         controller as a non-server 409 so the Home view degrades quietly.
     */
    public MarketsResponse ensureFreshForecast(UUID profileId, long maxAgeHours) {
        if (profileId == null) {
            throw new IllegalArgumentException("profileId is required");
        }

        // Fast-fail on an unknown profile id rather than spinning up the ~6s live
        // pipeline (which forecastForProfile would run unpersisted for a missing
        // row). The Home view passes whatever id it holds, so a stale/garbage id
        // must 409 quickly instead of silently triggering a forecast.
        if (profileRepo.findById(profileId).isEmpty()) {
            throw new IllegalArgumentException("Business profile not found: " + profileId);
        }

        OffsetDateTime newest = null;
        for (String market : MARKETS) {
            Optional<ForecastResult> fr = forecastRepo
                    .findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                            profileId, market, 4);
            if (fr.isPresent() && fr.get().getGeneratedAt() != null) {
                OffsetDateTime g = fr.get().getGeneratedAt();
                if (newest == null || g.isAfter(newest)) newest = g;
            }
        }

        boolean stale = newest == null
                || newest.isBefore(OffsetDateTime.now().minusHours(maxAgeHours));

        if (stale) {
            log.info("Forecast stale/missing for profile={} (newest={}, maxAgeHours={}) — running live pipeline",
                    profileId, newest, maxAgeHours);
            return forecastForProfile(profileId, true);
        }

        log.info("Forecast fresh for profile={} (newest={}, maxAgeHours={}) — serving cached DB rows",
                profileId, newest, maxAgeHours);
        return loadMarketsFromDb(profileId);
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
        return loadMarketsFromDb(profileId, null);
    }

    /**
     * Same as {@link #loadMarketsFromDb(UUID)}, but when {@code categoryFilter} is
     * non-blank the per-market selection is pinned to that one category instead of
     * picking the best-ranked category across all of the profile's categories
     * (Task 11, Part A).
     *
     * <p>If {@code categoryFilter} is not one of the profile's own categories, this
     * returns an empty {@link MarketsResponse} rather than falling back to the
     * unfiltered (best-ranked) behaviour — a category the caller's profile doesn't
     * have must never silently widen into "all markets".
     */
    public MarketsResponse loadMarketsFromDb(UUID profileId, String categoryFilter) {
        List<MarketResultBundle> bundles = new ArrayList<>();

        // Selection rule (Task 1a.2b): forecasts are now produced per (category,
        // market), so more than one ForecastResult can exist per market. We
        // preserve today's response cardinality (one entry per market, no
        // `category` field on MarketDto) by picking the BEST-RANKED category
        // per market — i.e. the category whose latest MarketScore is highest —
        // rather than an arbitrary/most-recent one. This is the safer default
        // per the task: it doesn't change what the frontend receives, only
        // which category's numbers back it.
        BusinessProfile profile = profileRepo.findById(profileId).orElse(null);
        List<String> categories = (profile != null && profile.categoriesList() != null
                && !profile.categoriesList().isEmpty())
                ? profile.categoriesList()
                : List.of();

        boolean hasFilter = categoryFilter != null && !categoryFilter.isBlank();
        if (hasFilter) {
            // Task 11: a category the profile doesn't have must yield an empty
            // markets list, never a throw and never a fallback to all markets.
            if (!categories.contains(categoryFilter)) {
                log.info("Category '{}' not found on profile={} — returning empty markets list",
                        categoryFilter, profileId);
                return new MarketsResponse(List.of());
            }
            categories = List.of(categoryFilter);
        }

        for (String market : MARKETS) {
            ForecastResult fr4w = null;
            MarketScore ms = null;

            for (String category : categories) {
                Optional<ForecastResult> candidateOpt = forecastRepo
                        .findTopByBusinessProfileIdAndTargetMarketAndCategoryAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                                profileId, market, category, 4);
                if (candidateOpt.isEmpty()) continue;
                ForecastResult candidate = candidateOpt.get();
                List<MarketScore> candidateScores = scoreRepo.findByForecastResultIdOrderByMarketRankAsc(
                        candidate.getForecastResultId());
                if (candidateScores.isEmpty()) continue;
                MarketScore candidateMs = candidateScores.get(0);
                if (ms == null || safeScore(candidateMs) > safeScore(ms)) {
                    fr4w = candidate;
                    ms = candidateMs;
                }
            }

            // Pre-V20 fallback: no category produced a match (either the profile
            // has no categories set yet, or the persisted rows predate V20 and
            // have category = null so the scoped finder above can't see them).
            // Fall back to the legacy category-agnostic finder so a profile with
            // older data still gets a market card instead of silently dropping it.
            // Skipped when a category filter is active — falling back would pull
            // in data for a *different* category than what the caller asked for,
            // silently defeating the filter.
            if (fr4w == null && !hasFilter) {
                Optional<ForecastResult> fallbackOpt = forecastRepo
                        .findTopByBusinessProfileIdAndTargetMarketAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                                profileId, market, 4);
                if (fallbackOpt.isEmpty()) continue;
                fr4w = fallbackOpt.get();
                List<MarketScore> fallbackScores = scoreRepo.findByForecastResultIdOrderByMarketRankAsc(
                        fr4w.getForecastResultId());
                if (fallbackScores.isEmpty()) continue;
                ms = fallbackScores.get(0);
            }

            // hasFilter with no scoped match for this market — skip it rather
            // than fall back (see comment above); a filtered result can
            // legitimately have fewer than 3 markets.
            if (fr4w == null) continue;

            List<MarketSignalRecord> history = loadCategoryScopedHistory(profileId, market, fr4w.getCategory());
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
                        OffsetDateTime asOf = t.getGdpFetchedAt() != null ? t.getGdpFetchedAt() : t.getFetchedAt();
                        // Reading straight from tbl_market_economic_trend, never a live call — a
                        // persisted row's own gdp_source (Step 6) survives the round-trip; "unknown"
                        // only for pre-Step-6 rows that never had a tag written.
                        String source = t.getGdpSource() != null ? t.getGdpSource() : "unknown";
                        return new GdpTrendDto(t.getCurrencyCode() != null ? t.getCurrencyCode() : market,
                                pts, latest, asOf, source);
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
                        OffsetDateTime asOf = t.getForexFetchedAt() != null ? t.getForexFetchedAt() : t.getFetchedAt();
                        String source = t.getForexSource() != null ? t.getForexSource() : "unknown";
                        return new ForexTrendDto(t.getCurrencyCode() != null ? t.getCurrencyCode() : market,
                                pts, latest, asOf, source);
                    } catch (Exception e) {
                        return null;
                    }
                })
                .orElse(null);
    }

    /**
     * Loads signal history scoped to (profile, market, category); falls back to
     * the category-agnostic finder when the scoped read is empty (Task 1a.2b).
     *
     * <p>Two situations land here: (1) a genuinely new category that hasn't
     * been ingested yet, and (2) rows that predate the V20 migration and have
     * {@code category = null}. In both cases returning nothing would silently
     * starve the forecast of history it actually has, so we widen the read
     * rather than throw. {@code category == null} skips straight to the
     * unscoped finder.
     */
    private List<MarketSignalRecord> loadCategoryScopedHistory(UUID profileId, String market, String category) {
        // Step 4 (contract §2): ordered by observation week, not write time — see
        // MarketSignalRecordRepository.findByProfileMarketCategoryOrderByWeekDesc.
        List<MarketSignalRecord> scoped = category != null
                ? signalRepo.findByProfileMarketCategoryOrderByWeekDesc(profileId, market, category)
                : List.of();
        if (!scoped.isEmpty()) return scoped;
        return signalRepo.findByProfileMarketOrderByWeekDesc(profileId, market);
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
        BusinessProfile profile = profileRepo.findById(profileId).orElse(null);
        boolean canPersist = profile != null;
        if (!canPersist) {
            log.warn("Profile {} not found in tbl_business_profile — pipeline will run without persistence", profileId);
        }

        // Categories to forecast for this profile (Task 1a.2b — mirrors ingestion's
        // per-(category, market) shape). Falls back to a single null-category pass
        // when the profile is missing/has no categories, so the in-memory-stub path
        // (canPersist=false) and any legacy caller keep working.
        List<String> categories = (profile != null && profile.categoriesList() != null
                && !profile.categoriesList().isEmpty())
                ? profile.categoriesList()
                : Collections.singletonList(null);

        // "Primary" category used to build the ONE Gemini demand-forecast sequence
        // per market (Phase A/B below stay market-scoped, not category-scoped —
        // see the Phase C comment for why). Deterministic: first category in the
        // profile's stored (comma-joined) order.
        String primaryCategory = categories.get(0);

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

            // Build enriched sequence. When no genuinely-measured signal data
            // exists, this is reported as a structured MOD22_NO_MARKET_DATA (503)
            // rather than fabricating a baseline series — an invented "demand is
            // ~50" reading is indistinguishable from a real one once forecast.
            Map<String, Object> sequence;
            try {
                sequence = sequenceBuilder.buildSequence(profileId, market, primaryCategory);
            } catch (IllegalStateException seqEx) {
                String seqMsg = seqEx.getMessage();
                if (seqMsg != null && seqMsg.startsWith("enriched_dataset_empty")) {
                    MDC.put("code", Module2ErrorCodes.MOD22_NO_MARKET_DATA);
                    String lastError = jobRepo.findTopByMarketOrderByLastAttemptedAtDesc(market)
                            .map(TrendFetchJob::getLastError)
                            .orElse(null);
                    // Step 7 (contract §3.1): surface WHY the matrix couldn't be built —
                    // the real weekly-row count, or which feature had no usable earlier
                    // value to carry forward — rather than a bare "no data" message.
                    String detail = seqMsg.contains(":") ? seqMsg.substring(seqMsg.indexOf(':') + 1) : null;
                    StringBuilder combinedErrorBuilder = new StringBuilder(detail != null
                            ? "insufficient real weekly history (" + detail + ") for the 12-week feature matrix"
                            : "no measured signal data");
                    if (lastError != null) combinedErrorBuilder.append("; last ingestion error: ").append(lastError);
                    String combinedError = combinedErrorBuilder.toString();
                    log.warn("No measured signal data for market={} profile={} — "
                             + "MOD22_NO_MARKET_DATA ({})",
                            market, profileId, combinedError);
                    MDC.remove("code");
                    throw noMarketData(market, combinedError);
                }
                throw seqEx;
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

        // ── Phase C: per-market demand read + per-category scoring/persistence ──
        // The Gemini demand forecast (demand4w/12w, weeklyForecasts, mape/mae/rmse/
        // confidence) is looked up ONCE per market from the Phase B batch response,
        // which is keyed by plain market name — it is built from exactly one
        // sequence per market (the profile's primary category, Phase A), so the
        // live Gemini call count stays bounded at MARKETS.size() regardless of how
        // many categories the profile has (see class Javadoc / Task 1a.2b report).
        // What genuinely varies per category is seasonality, spike, GDP/forex
        // context and therefore the XGBoost economic-viability score — those are
        // computed from category-scoped signal history inside the inner loop below,
        // and one ForecastResult + MarketScore row is persisted per (category,
        // market) pair so the DB reflects real per-category standing.
        List<MarketResultBundle> allBundles = new ArrayList<>();

        for (MarketSetup setup : setups) {
            String              market     = setup.market();
            GdpTrendDto         gdpTrend   = setup.gdpTrend();
            ForexTrendDto       forexTrend = setup.forexTrend();

            // Look up this market's Gemini result from the batch response
            Map<String, Object> inference = batchInference.get(market);
            if (inference == null) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "MOD22_FORECAST_FAILED :: Batch response missing results for market=" + market);
            }

            // Step 6 (contract; H-29): a missing field here used to silently become
            // demand=50 / mape=10 / mae=6 / rmse=9 / confidence=0.8 — indistinguishable
            // from a real measurement once persisted and charted. requireNum throws
            // instead, so an incomplete Gemini/Groq response fails loudly.
            double demand4w   = requireNum(inference, "predicted_demand_4w",  market);
            double demand12w  = requireNum(inference, "predicted_demand_12w", market);
            double mape       = requireNum(inference, "mape",       market);
            double mae        = requireNum(inference, "mae",        market);
            double rmse       = requireNum(inference, "rmse",       market);
            double confidence = requireNum(inference, "confidence", market);
            String source = requireSource(inference, market);

            // Per-week forecasts [Wk+1..Wk+12] — Gemini returns varying values
            // so the chart shows a real trend line (not a flat repeated scalar).
            List<Double> weeklyForecasts = requireWeeklyForecasts(inference, market);

            // FR2.12 — MAPE warning
            if (mape > MAPE_THRESHOLD) {
                MDC.put("code", Module2ErrorCodes.MOD22_FORECAST_MAPE_WARNING);
                log.warn("MAPE {}% exceeds threshold for market={}", mape, market);
                MDC.remove("code");
            }

            ExternalMarketDataClient.FlightReferenceDto flight = externalClient.getFlightReference(market);

            for (String category : categories) {
                // Category-scoped signal history — falls back to the category-agnostic
                // finder when empty (new category not yet ingested, or pre-V20 rows
                // with category=null). See loadCategoryScopedHistory Javadoc.
                List<MarketSignalRecord> history = loadCategoryScopedHistory(profileId, market, category);
                MarketSignalRecord latest = history.isEmpty() ? null : history.get(0);

                // Step 6 (contract; H-29): seasonality/gdp/forex used to silently default to
                // 0.5 / 2.0 / 1.0 when `latest` (or one of its fields) was null — indistinguishable
                // from a real measurement once it fed the XGBoost score and chart. Scans the
                // full week-ordered history for the most recent NON-null reading of each field
                // (a genuine last-known-good, same three-tier spirit as the macro-input policy)
                // and throws only when NO row in the category's history has ever measured it.
                double seasonality = requireLatestMeasured(history, market, category,
                        "seasonality_score", MarketSignalRecord::getSeasonalityScore);
                boolean spike = latest != null && Boolean.TRUE.equals(latest.getSpikeIndicator());
                double gdp    = requireLatestMeasured(history, market, category,
                        "gdp_growth", MarketSignalRecord::getGdpGrowth);
                double forex  = requireLatestMeasured(history, market, category,
                        "forex_rate", MarketSignalRecord::getForexRate);
                Double yoyRatio = latest != null ? latest.getYoyRatio() : null;

                // Persist ForecastResult (4w + 12w) — only when a valid profile row exists
                ForecastResult fr4w;
                if (canPersist) {
                    fr4w = persistForecastResult(
                            profileId, market, category, demand4w, confidence, mape, mae, rmse, 4,
                            weeklyForecasts, yoyRatio, source);
                    persistForecastResult(profileId, market, category, demand12w, confidence, mape, mae, rmse, 12,
                            yoyRatio, source);
                } else {
                    // In-memory stub so downstream DTO assembly has a non-null object
                    fr4w = new ForecastResult();
                    fr4w.setForecastResultId(UUID.randomUUID());
                    fr4w.setBusinessProfileId(profileId);
                    fr4w.setTargetMarket(market);
                    fr4w.setCategory(category);
                    fr4w.setPredictedDemand(demand4w);
                    fr4w.setForecastConfidence(confidence);
                    fr4w.setMapeScore(mape);
                    fr4w.setForecastHorizonWeeks(4);
                    fr4w.setYoyRatio(yoyRatio);
                    fr4w.setSource(source);
                }

                // ── XGBoost economic viability scoring (FR2.13) — category-specific
                // seasonality/spike inputs, so this runs once per (market, category) ──
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
                double marketScore = requireNum(scoreResult, "market_score", market);

                // Persist MarketScore (and demand alert) — only when profile row exists
                MarketScore ms;
                if (canPersist) {
                    ms = persistMarketScore(
                            fr4w.getForecastResultId(), marketScore, seasonality, spike, gdp, forex, yoyRatio);
                    // An absent/invalid baseline is not replaced with a made-up value:
                    // it simply cannot produce a baseline-relative demand-window alert.
                    Double rollingAvg = latest != null ? latest.getRollingAverage7d() : null;
                    persistDemandAlert(profileId, category, ms.getMarketScoreId(), market, demand4w,
                            rollingAvg, spike, yoyRatio, weeklyForecasts, latest);
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
                    // historical_arrivals remains nullable: there is no real arrivals feed in
                    // Module 2, so Step 10 deliberately does not invent a value.
                    ms.setYoyRatio(yoyRatio);
                }

                allBundles.add(new MarketResultBundle(
                        market, marketScore, ms, fr4w, history, spike, confidence,
                        gdpTrend, forexTrend, weeklyForecasts, latest));
            }

            // ── Persist economic trend snapshot (once per market) ─────────────────
            persistEconomicTrend(market, gdpTrend, forexTrend);
        }

        // Selection rule (Task 1a.2b): keep one entry per market in the response —
        // the best-scoring category's bundle — mirroring loadMarketsFromDb's rule
        // so the live pipeline and the DB-only read path agree on cardinality and
        // on which category "speaks for" a market when several are ingested.
        Map<String, MarketResultBundle> bestPerMarket = new LinkedHashMap<>();
        for (MarketResultBundle b : allBundles) {
            MarketResultBundle current = bestPerMarket.get(b.market());
            if (current == null || b.marketScore() > current.marketScore()) {
                bestPerMarket.put(b.market(), b);
            }
        }
        List<MarketResultBundle> bundles = new ArrayList<>(bestPerMarket.values());

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

    private ForecastResult persistForecastResult(UUID profileId, String market, String category,
                                                  double demand, double confidence,
                                                  double mape, double mae, double rmse, int horizon,
                                                  Double yoyRatio, String source) {
        return persistForecastResult(profileId, market, category, demand, confidence, mape, mae, rmse, horizon,
                null, yoyRatio, source);
    }

    private ForecastResult persistForecastResult(UUID profileId, String market, String category,
                                                  double demand, double confidence,
                                                  double mape, double mae, double rmse, int horizon,
                                                  List<Double> weeklyForecasts, Double yoyRatio, String source) {
        ForecastResult fr = new ForecastResult();
        fr.setBusinessProfileId(profileId);
        fr.setTargetMarket(market);
        fr.setCategory(category);
        fr.setPredictedDemand(demand);
        fr.setForecastConfidence(confidence);
        fr.setMapeScore(mape);
        fr.setMae(mae);
        fr.setRmse(rmse);
        fr.setForecastHorizonWeeks(horizon);
        fr.setYoyRatio(yoyRatio);
        fr.setSource(source);
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
                                           double gdp, double forex, Double yoyRatio) {
        MarketScore ms = new MarketScore();
        ms.setForecastResultId(forecastResultId);
        ms.setMarketScore(score);
        ms.setSeasonalityScore(seasonality);   // stored as 0–1
        ms.setSpikeIndicator(spike);
        ms.setGdpPerCapitaGrowth(gdp);
        ms.setForexVsPhp(forex);
        // Leave historical_arrivals NULL. The only prior value was the synthetic
        // 80,000 placeholder; there is no owned, verified arrivals source yet.
        ms.setYoyRatio(yoyRatio);
        return scoreRepo.save(ms);
    }

    private void persistDemandAlert(UUID profileId, String category, UUID marketScoreId, String market,
                                    double demand4w, Double rolling7dAverage, boolean spikeIndicator,
                                    Double yoyRatio, List<Double> weeklyForecasts,
                                    MarketSignalRecord latestSignal) {
        OffsetDateTime firstForecastWeek = firstForecastWeekStart(latestSignal);
        Optional<DemandAlertDecision> decision = deriveDemandAlert(
                demand4w, rolling7dAverage, spikeIndicator, yoyRatio, weeklyForecasts, firstForecastWeek);
        if (decision.isEmpty()) {
            return;
        }

        DemandAlertDecision alertDecision = decision.get();
        String marketName = MARKET_META.getOrDefault(market,
                new String[]{market, market, "???", "CEB"})[0];

        DemandAlert alert = new DemandAlert();
        alert.setMarketScoreId(marketScoreId);
        alert.setBusinessProfileId(profileId);
        alert.setCategory(category);
        alert.setAlertLevel(alertDecision.level());
        alert.setUpliftPct(alertDecision.upliftPct());
        alert.setAlertMessage(String.format(
                "%s for %s — the 4-week forecast is %.1f%% above the rolling baseline. "
                + "First forecast week crossing the demand-window threshold starts %s.",
                alertDecision.level().equals("CRITICAL") ? "Critical demand window" : "Demand window detected",
                marketName, alertDecision.upliftPct(), alertDecision.windowOpenDate().toLocalDate()));
        alert.setTrend(alertDecision.trend());
        alert.setIsRead(false);
        alert.setWindowOpenDate(alertDecision.windowOpenDate());
        alertRepo.save(alert);
        MDC.put("code", Module2ErrorCodes.MOD22_ALERT_GENERATED);
        log.info("Demand alert generated for market={} level={} upliftPct={}",
                market, alertDecision.level(), alertDecision.upliftPct());
        MDC.remove("code");
    }

    /**
     * Implements the frozen demand-window rule. This is deliberately not called
     * a "surge": the rule measures a 20% rolling-baseline uplift, while a surge
     * has the stricter 2σ definition used by the UI's surge surfaces.
     *
     * <p>A missing year-over-year ratio can never elevate an alert to CRITICAL;
     * it remains WARNING when every other warning condition is met.
     */
    static Optional<DemandAlertDecision> deriveDemandAlert(double predictedDemand4w,
                                                            Double rolling7dAverage,
                                                            boolean spikeIndicator,
                                                            Double yoyRatio,
                                                            List<Double> weeklyForecasts,
                                                            OffsetDateTime firstForecastWeek) {
        if (rolling7dAverage == null || !Double.isFinite(rolling7dAverage) || rolling7dAverage <= 0.0) {
            return Optional.empty();
        }
        if (!Double.isFinite(predictedDemand4w) || weeklyForecasts == null || firstForecastWeek == null) {
            return Optional.empty();
        }

        double threshold = rolling7dAverage * DEMAND_WINDOW_MULTIPLIER;
        if (predictedDemand4w <= threshold) {
            return Optional.empty();
        }

        int firstCrossingWeek = -1;
        for (int i = 0; i < weeklyForecasts.size(); i++) {
            Double weeklyForecast = weeklyForecasts.get(i);
            if (weeklyForecast != null && Double.isFinite(weeklyForecast) && weeklyForecast > threshold) {
                firstCrossingWeek = i;
                break;
            }
        }
        if (firstCrossingWeek < 0) {
            return Optional.empty();
        }

        double upliftPct = calculateUpliftPct(predictedDemand4w, rolling7dAverage);
        boolean critical = spikeIndicator && yoyRatio != null && Double.isFinite(yoyRatio) && yoyRatio >= 1.0;
        return Optional.of(new DemandAlertDecision(
                critical ? "CRITICAL" : "WARNING",
                upliftPct,
                spikeIndicator ? "Sudden interest spike" : "Rising demand window",
                firstForecastWeek.plusWeeks(firstCrossingWeek)));
    }

    static double calculateUpliftPct(double predictedDemand4w, double rolling7dAverage) {
        if (!Double.isFinite(rolling7dAverage) || rolling7dAverage <= 0.0) {
            throw new IllegalArgumentException("rolling_7d_avg must be a finite positive number");
        }
        if (!Double.isFinite(predictedDemand4w)) {
            throw new IllegalArgumentException("predicted_demand_4w must be finite");
        }
        return (predictedDemand4w / rolling7dAverage - 1.0) * 100.0;
    }

    private static OffsetDateTime firstForecastWeekStart(MarketSignalRecord latestSignal) {
        LocalDate latestWeekStart = latestSignal != null ? latestSignal.getWeekStartDate() : null;
        if (latestWeekStart == null && latestSignal != null && latestSignal.getAggregatedAt() != null) {
            LocalDate observedDate = latestSignal.getAggregatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDate();
            latestWeekStart = observedDate.minusDays(observedDate.getDayOfWeek().getValue() - 1L);
        }
        if (latestWeekStart == null) {
            throw new IllegalStateException("Cannot derive forecast window without a latest signal week");
        }
        return latestWeekStart.plusWeeks(1).atStartOfDay().atOffset(ZoneOffset.UTC);
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

        // Radar-drawer fields (Purchasing Power / Seasonal Patterns tabs). All sourced
        // from data already loaded onto the bundle — no extra per-market query.
        MarketScore ms = b.ms();
        String currency = b.forexTrend() != null ? b.forexTrend().currencyCode() : "";
        double gdpValue = ms.getGdpPerCapitaGrowth() != null
                ? ms.getGdpPerCapitaGrowth()
                : (b.gdpTrend() != null ? b.gdpTrend().latest() : 0.0);
        double forexValue = ms.getForexVsPhp() != null
                ? ms.getForexVsPhp()
                : (b.forexTrend() != null ? b.forexTrend().latest() : 0.0);

        // Age of the newest measured signal behind this card — the dashboard shows
        // a staleness banner instead of pretending old-but-real numbers are fresh.
        OffsetDateTime signalAsOf = b.latestSignal() != null ? b.latestSignal().getAggregatedAt() : null;
        String  dataAsOf  = signalAsOf != null ? signalAsOf.toString() : null;
        boolean dataStale = EnrichedSequenceBuilder.isStale(signalAsOf, OffsetDateTime.now());

        // Macro-input provenance (Step 6, contract; C-06, H-18) — which tier produced
        // gdpValue/forexValue, and how old the older of the two readings is, so the
        // operator can tell a live number from a last-known-good one on screen.
        String gdpSource   = b.gdpTrend()   != null ? b.gdpTrend().source()   : null;
        String forexSource = b.forexTrend() != null ? b.forexTrend().source() : null;
        OffsetDateTime gdpAsOfInstant   = b.gdpTrend()   != null ? b.gdpTrend().fetchedAt()   : null;
        OffsetDateTime forexAsOfInstant = b.forexTrend() != null ? b.forexTrend().fetchedAt() : null;
        OffsetDateTime macroAsOfInstant;
        if (gdpAsOfInstant != null && forexAsOfInstant != null) {
            macroAsOfInstant = gdpAsOfInstant.isBefore(forexAsOfInstant) ? gdpAsOfInstant : forexAsOfInstant;
        } else {
            macroAsOfInstant = gdpAsOfInstant != null ? gdpAsOfInstant : forexAsOfInstant;
        }
        String macroAsOf = macroAsOfInstant != null ? macroAsOfInstant.toString() : null;

        return new MarketDto(
                market, rank, meta[0], meta[1], matchScore, directive,
                flight.directFlight(), flight.flightHours(), flight.distanceKm(),
                meta[2], meta[3],
                accessibilityScore,
                flight.flightFrequency(),
                avgFlightPrice,
                airlines,
                PEAK_MONTHS.getOrDefault(market, List.of()),
                buildEconomyInsight(b.ms(), b.forexTrend()),
                buildSeasonalityInsight(b.ms()),
                chartData,
                gdpTrendDtos,
                forexTrendDtos,
                MarketFlags.isoFor(market),
                currency,
                forexLabel(currency),
                gdpValue,
                forexValue,
                ms.getSeasonalityScore() != null ? ms.getSeasonalityScore() : 0.0,
                ms.getYoyRatio(),
                Boolean.TRUE.equals(ms.getSpikeIndicator()),
                dataAsOf,
                dataStale,
                gdpSource,
                forexSource,
                macroAsOf
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

    /** Contract §1.3: the single template every forex axis label is built from. */
    private static final String FOREX_LABEL_FORMAT = "PHP per 1 %s";

    static String forexLabel(String currency) {
        return currency.isBlank() ? "" : String.format(FOREX_LABEL_FORMAT, currency);
    }

    /**
     * Contract §1: forex is canonical PHP per 1 unit of foreign currency everywhere, so a
     * fixed magnitude threshold (the previous "&gt; 15.0 = exceptional") is meaningless
     * across markets — canonical rates span more than three orders of magnitude purely
     * from how many units of each currency equal one peso (korea ≈ 0.04, japan ≈ 0.38,
     * usa ≈ 57), which is a currency-denomination artifact, not a real difference in
     * purchasing power. The purchasing-power signal here is instead the CURRENT rate's
     * % deviation from the mean of its own forex_trend_json series — a ratio of two
     * values in the same unit, so it is comparable across every market regardless of
     * that unit's magnitude.
     */
    static String buildEconomyInsight(MarketScore ms, ExternalMarketDataClient.ForexTrendDto forexTrend) {
        double gdp = ms.getGdpPerCapitaGrowth() != null ? ms.getGdpPerCapitaGrowth() : 0.0;
        String gdpTrend = gdp > 3.0 ? "strong growth" : gdp > 1.5 ? "moderate growth" : "stable";

        Double changePct = forexChangeVsTwelveMonthMeanPct(forexTrend);
        String forexSentiment;
        String trendClause;
        if (changePct == null) {
            forexSentiment = "an undetermined";
            trendClause = "not enough exchange-rate history yet to compare against";
        } else if (changePct >= 3.0) {
            forexSentiment = "an improving";
            trendClause = String.format("%.1f%% stronger than its own 12-month average", changePct);
        } else if (changePct <= -3.0) {
            forexSentiment = "a softening";
            trendClause = String.format("%.1f%% weaker than its own 12-month average", changePct);
        } else {
            forexSentiment = "a stable";
            trendClause = "close to its own 12-month average";
        }

        return String.format(
                "GDP is showing %s (%.1f%% YoY). The exchange rate signals %s purchasing power trend "
                + "for visitors spending in Cebu — the currency is currently %s. An XGBoost economic "
                + "viability score was used to weight this market's accessibility alongside flight data.",
                gdpTrend, gdp, forexSentiment, trendClause);
    }

    /**
     * % difference between a market's latest forex reading and the mean of its own
     * forex_trend_json series (up to 12 monthly points, contract §1 canonical unit).
     * Unit-independent by construction — both operands are in the same unit, so the
     * ratio is comparable across every market regardless of that unit's magnitude.
     * Null when there is no trend history yet, or its mean is non-positive.
     */
    static Double forexChangeVsTwelveMonthMeanPct(ExternalMarketDataClient.ForexTrendDto forexTrend) {
        if (forexTrend == null || forexTrend.points().isEmpty()) return null;
        double mean = forexTrend.points().stream()
                .mapToDouble(ForexTrendPoint::value)
                .average()
                .orElse(0.0);
        if (mean <= 0) return null;
        return (forexTrend.latest() - mean) / mean * 100.0;
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
            trend.setGdpSource(gdp != null ? gdp.source() : null);
            trend.setGdpFetchedAt(gdp != null ? gdp.fetchedAt() : null);
            trend.setForexSource(forex != null ? forex.source() : null);
            trend.setForexFetchedAt(forex != null ? forex.fetchedAt() : null);

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

    /**
     * Like {@link #num} but never falls back to a fabricated default (Step 6,
     * contract; H-29) — a batch-inference response missing a required numeric
     * field throws instead of silently becoming demand=50 / mape=10 / etc.
     */
    private static double requireNum(Map<String, Object> map, String key, String market) {
        Object v = map.get(key);
        if (v instanceof Number n && Double.isFinite(n.doubleValue())) return n.doubleValue();
        throw AiDependencyException.fromBody(502, Map.of(
                "code", Module2ErrorCodes.MOD22_INFERENCE_FAILED,
                "message", "Forecast inference for " + market + " is missing required field '" + key + "'.",
                "dependency", "groq",
                "cause", "batch inference response for " + market + " did not include a numeric '" + key + "' value",
                "stage", "spring/forecasting"), "forecasting/pipeline");
    }

    private static String requireSource(Map<String, Object> inference, String market) {
        Object value = inference.get("source");
        if (value instanceof String source && !source.isBlank()) return source;
        throw AiDependencyException.fromBody(502, Map.of(
                "code", Module2ErrorCodes.MOD22_INFERENCE_FAILED,
                "message", "Forecast inference for " + market + " is missing its engine source.",
                "dependency", "forecast-engine",
                "cause", "batch inference response for " + market + " omitted non-empty 'source'",
                "stage", "spring/forecasting"), "forecasting/pipeline");
    }

    private static List<Double> requireWeeklyForecasts(Map<String, Object> inference, String market) {
        Object raw = inference.get("weekly_forecasts");
        if (!(raw instanceof List<?> values) || values.size() != 12) {
            throw AiDependencyException.fromBody(502, Map.of(
                    "code", Module2ErrorCodes.MOD22_INFERENCE_FAILED,
                    "message", "Forecast inference for " + market + " must contain exactly 12 weekly forecasts.",
                    "dependency", "forecast-engine",
                    "cause", "weekly_forecasts is absent or has a length other than 12",
                    "stage", "spring/forecasting"), "forecasting/pipeline");
        }
        List<Double> weekly = new ArrayList<>(12);
        for (Object value : values) {
            if (!(value instanceof Number number) || !Double.isFinite(number.doubleValue())
                    || number.doubleValue() < 0.0 || number.doubleValue() > 100.0) {
                throw AiDependencyException.fromBody(502, Map.of(
                        "code", Module2ErrorCodes.MOD22_INFERENCE_FAILED,
                        "message", "Forecast inference for " + market + " has an invalid weekly forecast.",
                        "dependency", "forecast-engine",
                        "cause", "weekly_forecasts must be 12 finite 0-100 numbers",
                        "stage", "spring/forecasting"), "forecasting/pipeline");
            }
            weekly.add(number.doubleValue());
        }
        return List.copyOf(weekly);
    }

    /**
     * The most recent non-null reading of one signal field across a category's
     * week-ordered history (Step 6, contract; H-29) — the "last-known-good"
     * counterpart of {@link #requireNum} for signal-derived inputs (seasonality,
     * GDP, forex) rather than inference-response fields. Throws only when NOT A
     * SINGLE row in the history has ever measured this field — never fabricates
     * the 0.5 / 2.0 / 1.0 constants this replaces.
     */
    private static double requireLatestMeasured(List<MarketSignalRecord> historyWeekDesc, String market,
            String category, String field, java.util.function.Function<MarketSignalRecord, Double> getter) {
        for (MarketSignalRecord r : historyWeekDesc) {
            Double v = getter.apply(r);
            if (v != null) return v;
        }
        throw noMeasuredCategoryInput(market, category, field);
    }

    private static AiDependencyException noMeasuredCategoryInput(String market, String category, String field) {
        return AiDependencyException.fromBody(503, Map.of(
                "code", "MOD22_NO_MARKET_DATA",
                "message", "No measured " + field + " exists for " + market + "/" + category + " yet.",
                "dependency", "market-signal",
                "cause", "no MarketSignalRecord in history for this (market, category) has a non-null " + field,
                "stage", "spring/forecasting"), "forecasting/pipeline");
    }

    private double safeScore(MarketScore ms) {
        return ms.getMarketScore() != null ? ms.getMarketScore() : 0.0;
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

    /** Package-visible pure result of the frozen demand-window alert rule. */
    record DemandAlertDecision(String level, double upliftPct, String trend, OffsetDateTime windowOpenDate) {}
}
