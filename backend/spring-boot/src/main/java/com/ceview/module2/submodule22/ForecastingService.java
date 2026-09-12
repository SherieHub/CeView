package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.ai.AiDependencyException;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.MarketCatalog;
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
import com.ceview.module2.submodule21.MarketIngestionError;
import com.ceview.module2.submodule21.MarketIngestionErrorRepository;
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
    /**
     * How long a persisted per-(market, category) demand forecast may be reused
     * instead of spending another forecast-engine call to recompute it.
     *
     * <p>Added after a live run against FORECAST_ENGINE=bilstm: one category
     * succeeded against Hugging Face's shared ZeroGPU quota, the very next
     * category in the same batch exhausted it, and — because {@link #runPipeline}
     * is {@code @Transactional} — the whole batch rolled back, discarding the
     * successful call along with the failed one. Retrying then unconditionally
     * re-sent EVERY category, including the one that had just succeeded,
     * spending quota a second time for no new information.
     *
     * <p>This window lets a category with a recent, genuinely-computed demand
     * number skip the forecast-engine call entirely and reuse it. Every other
     * part of the pipeline — ingestion, seasonality, GDP/forex, the XGBoost
     * economic score, and alerts — still recomputes every run; only the scarce,
     * quota-metered forecast-engine call is cached. The all-or-nothing
     * transactional guarantee for whatever a run DOES send to the engine is
     * otherwise unchanged.
     */
    private static final long PER_CATEGORY_FORECAST_FRESH_HOURS = 6;
    /**
     * Below this rolling-7-day-average trend index, a percentage-change uplift
     * is not a meaningful number — it isn't capped or floored, it is simply not
     * reported.
     *
     * <p>Percentage change is unbounded by construction: {@code (a/b - 1) * 100}
     * grows without limit as {@code b} approaches zero. A market whose real
     * baseline search interest is near-zero (a genuinely thin/emerging market,
     * not a data error — Google Trends legitimately reports near-0 index values)
     * can turn an ordinary demand forecast into a percentage in the tens of
     * thousands, which reads as a bug even though every input is honest.
     *
     * <p>5.0 is on the 0-100 Google-Trends-style trend index scale used
     * throughout this pipeline (see {@code MarketSignalRecord.trendIndex}) —
     * below it, a percentage comparison against that baseline stops being a
     * meaningful statement, so {@link #deriveDemandAlert} omits upliftPct
     * (leaves it {@code null}) rather than reporting an arithmetically correct
     * but unreadable figure. The demand-window trigger itself (this class's
     * {@code DEMAND_WINDOW_MULTIPLIER} check) is unaffected — it compares the
     * same raw ratio regardless of this floor, so detection behavior does not
     * change, only whether a percentage is shown alongside it.
     */
    private static final double MIN_BASELINE_FOR_UPLIFT_PCT = 5.0;

    private static final String[] MONTH_ABBR = {
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    };
    /** H-19: minimum weekly signal rows before peak months may be derived rather than read from reference. */
    private static final int PEAK_MONTHS_MIN_WEEKS = 52;
    /** H-19: minimum distinct calendar months that must carry data for a derivation to be trustworthy. */
    private static final int PEAK_MONTHS_MIN_COVERAGE = 8;

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
    private final MarketIngestionErrorRepository ingestionErrorRepo;

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
                              ObjectMapper objectMapper,
                              MarketIngestionErrorRepository ingestionErrorRepo) {
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
        this.ingestionErrorRepo = ingestionErrorRepo;
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
                "dependency", "serpapi",
                "cause", lastIngestionError == null
                        ? "no successful trend fetch has completed for this market"
                        : lastIngestionError,
                "stage", "spring/forecasting"), "forecasting/markets");
    }

    /**
     * Run the full 2.2 pipeline for a profile.
     * Throws IllegalStateException when enriched data is absent — run ingestion first.
     *
     * <p>Always forces a genuine forecast-engine call for every (market, category)
     * pair — see {@link #forecastForProfile(UUID, boolean, boolean)} for the
     * cache-aware variant. This overload exists so every EXISTING caller (and
     * test) keeps its current "calling this always produces fresh numbers"
     * guarantee unchanged.
     */
    @Transactional
    public MarketsResponse forecastForProfile(UUID profileId, boolean refresh) {
        return forecastForProfile(profileId, refresh, false);
    }

    /**
     * Same as {@link #forecastForProfile(UUID, boolean)}, but when
     * {@code useForecastCache} is true a (market, category) pair with a
     * persisted forecast younger than {@link #PER_CATEGORY_FORECAST_FRESH_HOURS}
     * skips the forecast-engine call and reuses it — see that constant's
     * Javadoc. Ingestion, seasonality, GDP/forex, and the XGBoost economic
     * score are unaffected and still recompute every run regardless of this
     * flag; only the scarce, quota-metered forecast-engine call is ever cached.
     *
     * <p>Used by the user-facing Analyze/Recompute endpoints and by
     * {@link #ensureFreshForecast}, where retrying after a partial failure
     * (see that constant's Javadoc for the incident that motivated this)
     * should not re-spend quota on a category that already succeeded moments
     * earlier. NOT used by the nightly ingestion job, which runs once a day
     * per profile and has no comparable retry-storm risk to guard against.
     */
    @Transactional
    public MarketsResponse forecastForProfile(UUID profileId, boolean refresh, boolean useForecastCache) {
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
            return runPipeline(profileId, useForecastCache);
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
        for (String market : MarketCatalog.IDS) {
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
            return forecastForProfile(profileId, true, true);
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

        for (String market : MarketCatalog.IDS) {
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

            DemandAlert activeAlert = alertRepo.findTopByMarketScoreIdOrderByAlertDateDesc(ms.getMarketScoreId())
                    .orElse(null);
            bundles.add(new MarketResultBundle(
                    market, marketScore, ms, fr4w, history, spike, confidence,
                    gdpTrend, forexTrend, weeklyForecasts, latest,
                    activeAlert != null ? activeAlert.getAlertLevel() : null,
                    activeAlert != null ? activeAlert.getUpliftPct() : null,
                    activeAlert != null ? activeAlert.getWindowOpenDate() : null));
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
    protected MarketsResponse runPipeline(UUID profileId, boolean useForecastCache) {
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

        // ── Phase A: build one sequence per (market, category) pair (no AI calls) ──
        // Each market's demand forecast is now computed genuinely per category —
        // previously only the first-listed ("primary") category ever got a real
        // demand forecast, and every other category silently reused that same
        // number, which made every demand-window alert claim the primary category
        // even when a market was actually surging in a different one. GDP/forex
        // trend fetches stay per-market (they don't vary by category), cached in
        // `marketMeta` so they're fetched once and Phase C can persist one economic
        // trend snapshot per market rather than one per (market, category) row.
        record MarketMeta(GdpTrendDto gdpTrend, ForexTrendDto forexTrend) {}
        record CategorySequence(
                String market,
                String category,
                Map<String, Object> sequence,
                /** "{market}::{category}" — must match stub_forecaster.forecast_batch's
                 *  and gemini_forecaster.forecast_batch_requests' key format exactly;
                 *  a bare market name would collide once a market carries more than
                 *  one category. */
                String key) {}

        Map<String, MarketMeta> marketMeta = new LinkedHashMap<>();
        List<CategorySequence> setups = new ArrayList<>();

        for (String market : MarketCatalog.IDS) {
            GdpTrendDto   gdpTrend   = externalClient.fetchGdpTrend(market);
            ForexTrendDto forexTrend = externalClient.fetchForexTrend(market);
            marketMeta.put(market, new MarketMeta(gdpTrend, forexTrend));

            for (String category : categories) {
                // Build enriched sequence. When no genuinely-measured signal data
                // exists, this is reported as a structured MOD22_NO_MARKET_DATA (503)
                // rather than fabricating a baseline series — an invented "demand is
                // ~50" reading is indistinguishable from a real one once forecast.
                Map<String, Object> sequence;
                try {
                    sequence = sequenceBuilder.buildSequence(profileId, market, category);
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
                        log.warn("No measured signal data for market={} category={} profile={} — "
                                 + "MOD22_NO_MARKET_DATA ({})",
                                market, category, profileId, combinedError);
                        MDC.remove("code");
                        throw noMarketData(market, combinedError);
                    }
                    throw seqEx;
                }

                // NOTE: this used to inject `gdpTrendDirection`/`gdpTrendDelta` into
                // `sequence` for the old free-text Gemini prompt path. The current
                // FastAPI endpoint consumes the fixed-width SequenceForecastRequest
                // shape instead, which has `extra="forbid"` and does not declare
                // either field — adding them here made every batch call fail with a
                // 422 ("Extra inputs are not permitted") whenever GDP trend data had
                // 2+ points. gdpTrend/forexTrend are read from `marketMeta` below by
                // whatever legitimately needs them later in this pipeline.

                String key = market + "::" + (category != null ? category : "");
                setups.add(new CategorySequence(market, category, sequence, key));
            }
        }

        // ── Phase B: single batch forecast-engine call for every STALE (market,
        // category) pair ── one HTTP call regardless of how many rows end up in
        // `allSequences`; the engine itself decides whether that means one shared
        // LLM prompt or N independent per-row calls (see forecast_engine.py's
        // engine implementations). No fallback for a pair that IS sent — propagate
        // exception so the controller returns a structured error response instead
        // of silently using stub values.
        //
        // When useForecastCache is true, a pair with a persisted forecast younger
        // than PER_CATEGORY_FORECAST_FRESH_HOURS is held back from this call
        // entirely and its result reused below (see buildCachedInferenceResult) —
        // see that constant's Javadoc for why. `category` is never null here when
        // `canPersist` is true (categories comes from profile.categoriesList()),
        // so this cannot mask the legacy category=null path. When useForecastCache
        // is false (the default forecastForProfile overload — every existing
        // caller), every pair is always sent, exactly as before this cache existed.
        List<CategorySequence> staleSetups = new ArrayList<>();
        Map<String, Map<String, Object>> batchInference = new LinkedHashMap<>();
        for (CategorySequence s : setups) {
            Optional<ForecastResult> cached = (useForecastCache && canPersist)
                    ? forecastRepo.findTopByBusinessProfileIdAndTargetMarketAndCategoryAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                              profileId, s.market(), s.category(), 4)
                          .filter(fr -> fr.getGeneratedAt() != null
                                  && fr.getGeneratedAt().isAfter(OffsetDateTime.now().minusHours(PER_CATEGORY_FORECAST_FRESH_HOURS)))
                    : Optional.empty();
            if (cached.isPresent()) {
                Map<String, Object> reused = buildCachedInferenceResult(profileId, s.market(), s.category(), cached.get());
                if (reused != null) {
                    log.info("Reusing forecast-engine result for market={} category={} — "
                            + "generated {} ago, within the {}h freshness window",
                            s.market(), s.category(),
                            java.time.Duration.between(cached.get().getGeneratedAt(), OffsetDateTime.now()),
                            PER_CATEGORY_FORECAST_FRESH_HOURS);
                    batchInference.put(s.key(), reused);
                    continue;
                }
            }
            staleSetups.add(s);
        }

        List<Map<String, Object>> allSequences = new ArrayList<>();
        for (CategorySequence s : staleSetups) allSequences.add(s.sequence());
        if (!allSequences.isEmpty()) {
            batchInference.putAll(ai.runForecastInferenceBatch(allSequences));
        }

        // ── Phase C: per-(market, category) demand read + scoring/persistence ──
        // Every field below — demand, seasonality, spike, GDP/forex, and therefore
        // the XGBoost economic-viability score — is now genuinely computed per
        // (market, category) pair, so a market's demand-window alert can only ever
        // be attributed to the category it actually spiked in.
        List<MarketResultBundle> allBundles = new ArrayList<>();

        for (CategorySequence setup : setups) {
            String market   = setup.market();
            String category = setup.category();
            MarketMeta meta  = marketMeta.get(market);
            GdpTrendDto   gdpTrend   = meta.gdpTrend();
            ForexTrendDto forexTrend = meta.forexTrend();

            // Look up this (market, category) pair's forecast-engine result.
            Map<String, Object> inference = batchInference.get(setup.key());
            if (inference == null) {
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.BAD_GATEWAY,
                        "MOD22_FORECAST_FAILED :: Batch response missing results for market=" + market
                                + " category=" + category);
            }

            // Step 6 (contract; H-29): a missing field here used to silently become
            // demand=50 / mape=10 / mae=6 / rmse=9 / confidence=0.8 — indistinguishable
            // from a real measurement once persisted and charted. requireNum throws
            // instead, so an incomplete Gemini/Groq response fails loudly.
            double demand4w   = requireNum(inference, "predicted_demand_4w",  market);
            double demand12w  = requireNum(inference, "predicted_demand_12w", market);
            // mape/mae/rmse are declared `float | None` in FastAPI's own ForecastResponse
            // schema (backend/fastapi-transformer/app/routers/forecasting.py) — null is a
            // legitimate, documented value, not a missing-field error. MAPE in particular
            // is mathematically undefined whenever the actual value is 0 (division by
            // zero), which is common for a thin-history category with near-zero measured
            // search interest — requireNum would wrongly abort the entire pipeline for
            // every market/category over one category's honestly-uncomputable backtest.
            Double mape       = optionalNum(inference, "mape");
            Double mae        = optionalNum(inference, "mae");
            Double rmse       = optionalNum(inference, "rmse");
            double confidence = requireNum(inference, "confidence", market);
            String source = requireSource(inference, market);

            // Per-week forecasts [Wk+1..Wk+12] — Gemini returns varying values
            // so the chart shows a real trend line (not a flat repeated scalar).
            List<Double> weeklyForecasts = requireWeeklyForecasts(inference, market);

            // FR2.12 — MAPE warning
            if (mape != null && mape > MAPE_THRESHOLD) {
                MDC.put("code", Module2ErrorCodes.MOD22_FORECAST_MAPE_WARNING);
                log.warn("MAPE {}% exceeds threshold for market={} category={}", mape, market, category);
                MDC.remove("code");
            }

            ExternalMarketDataClient.FlightReferenceDto flight = externalClient.getFlightReference(market);

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
            String scorer = requireScorer(scoreResult, market);

            // Persist MarketScore (and demand alert) — only when profile row exists
            MarketScore ms;
            if (canPersist) {
                ms = persistMarketScore(
                        fr4w.getForecastResultId(), marketScore, seasonality, spike, gdp, forex, yoyRatio, scorer);
                // An absent/invalid baseline is not replaced with a made-up value:
                // it simply cannot produce a baseline-relative demand-window alert.
                Double rollingAvg = latest != null ? latest.getRollingAverage7d() : null;
                DemandAlert activeAlert = persistDemandAlert(profileId, category, ms.getMarketScoreId(), market, demand4w,
                        rollingAvg, spike, yoyRatio, weeklyForecasts, latest);
                allBundles.add(new MarketResultBundle(
                        market, marketScore, ms, fr4w, history, spike, confidence,
                        gdpTrend, forexTrend, weeklyForecasts, latest,
                        activeAlert != null ? activeAlert.getAlertLevel() : null,
                        activeAlert != null ? activeAlert.getUpliftPct() : null,
                        activeAlert != null ? activeAlert.getWindowOpenDate() : null));
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
                ms.setScorer(scorer);
                allBundles.add(new MarketResultBundle(
                        market, marketScore, ms, fr4w, history, spike, confidence,
                        gdpTrend, forexTrend, weeklyForecasts, latest, null, null, null));
            }
        }

        // ── Persist economic trend snapshot (once per market, not per category) ──
        for (Map.Entry<String, MarketMeta> entry : marketMeta.entrySet()) {
            persistEconomicTrend(entry.getKey(), entry.getValue().gdpTrend(), entry.getValue().forexTrend());
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

    // ─── forecast-engine cache reuse ────────────────────────────────────────

    /**
     * Rebuilds the map shape {@code batchInference} normally holds for a
     * (market, category) pair from its own persisted 4-week and 12-week
     * {@link ForecastResult} rows, so Phase C can process a reused result
     * through the exact same {@code requireNum}/{@code optionalNum}/
     * {@code requireSource}/{@code requireWeeklyForecasts} path as a freshly
     * computed one — see {@link #PER_CATEGORY_FORECAST_FRESH_HOURS}.
     *
     * @return the reconstructed map, or {@code null} when the matching 12-week
     *         row is missing (a pre-migration or partial row) — the caller
     *         falls through to a real forecast-engine call rather than persist
     *         a half-reconstructed result.
     */
    private Map<String, Object> buildCachedInferenceResult(UUID profileId, String market, String category,
                                                           ForecastResult fr4w) {
        Optional<ForecastResult> fr12wOpt = forecastRepo
                .findTopByBusinessProfileIdAndTargetMarketAndCategoryAndForecastHorizonWeeksOrderByGeneratedAtDesc(
                        profileId, market, category, 12);
        if (fr12wOpt.isEmpty()) {
            log.info("No matching 12-week row for cached market={} category={} — forcing a real recompute",
                    market, category);
            return null;
        }

        List<Double> weeklyForecasts = List.of();
        if (fr4w.getWeeklyForecastsJson() != null) {
            try {
                weeklyForecasts = objectMapper.readValue(
                        fr4w.getWeeklyForecastsJson(), new TypeReference<List<Double>>() {});
            } catch (Exception e) {
                log.warn("Failed to deserialize cached weeklyForecastsJson for market={} category={}: {}",
                        market, category, e.getMessage());
                return null;
            }
        }
        if (weeklyForecasts.isEmpty()) return null;   // requireWeeklyForecasts would reject this anyway

        Map<String, Object> reused = new LinkedHashMap<>();
        reused.put("predicted_demand_4w",  fr4w.getPredictedDemand());
        reused.put("predicted_demand_12w", fr12wOpt.get().getPredictedDemand());
        reused.put("mape",       fr4w.getMapeScore());
        reused.put("mae",        fr4w.getMae());
        reused.put("rmse",       fr4w.getRmse());
        reused.put("confidence", fr4w.getForecastConfidence());
        reused.put("source",     fr4w.getSource());
        reused.put("weekly_forecasts", weeklyForecasts);
        return reused;
    }

    // ─── persistence helpers ──────────────────────────────────────────────────

    private ForecastResult persistForecastResult(UUID profileId, String market, String category,
                                                  double demand, double confidence,
                                                  Double mape, Double mae, Double rmse, int horizon,
                                                  Double yoyRatio, String source) {
        return persistForecastResult(profileId, market, category, demand, confidence, mape, mae, rmse, horizon,
                null, yoyRatio, source);
    }

    private ForecastResult persistForecastResult(UUID profileId, String market, String category,
                                                  double demand, double confidence,
                                                  Double mape, Double mae, Double rmse, int horizon,
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
                                           double gdp, double forex, Double yoyRatio, String scorer) {
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
        ms.setScorer(scorer);
        return scoreRepo.save(ms);
    }

    private DemandAlert persistDemandAlert(UUID profileId, String category, UUID marketScoreId, String market,
                                    double demand4w, Double rolling7dAverage, boolean spikeIndicator,
                                    Double yoyRatio, List<Double> weeklyForecasts,
                                    MarketSignalRecord latestSignal) {
        // Retire whatever alert(s) already exist for this exact (profile, category,
        // market) triple before deciding on a new one — every pipeline run used to
        // INSERT a fresh row here without ever superseding the last one, so the
        // feed accumulated duplicate cards for the same market/category (only the
        // uplift % differed run to run), and a market that stopped surging kept
        // showing its old "active surge" alert forever. Delete-then-maybe-reinsert
        // makes the feed reflect current state instead of a growing history log.
        List<DemandAlert> stale = alertRepo.findByProfileAndCategoryAndMarket(profileId, category, market);
        if (!stale.isEmpty()) alertRepo.deleteAll(stale);

        OffsetDateTime firstForecastWeek = firstForecastWeekStart(latestSignal);
        Optional<DemandAlertDecision> decision = deriveDemandAlert(
                demand4w, rolling7dAverage, spikeIndicator, yoyRatio, weeklyForecasts, firstForecastWeek);
        if (decision.isEmpty()) {
            return null;
        }

        DemandAlertDecision alertDecision = decision.get();
        String marketName = MarketCatalog.displayName(market);

        DemandAlert alert = new DemandAlert();
        alert.setMarketScoreId(marketScoreId);
        alert.setBusinessProfileId(profileId);
        alert.setCategory(category);
        alert.setAlertLevel(alertDecision.level());
        alert.setUpliftPct(alertDecision.upliftPct());
        alert.setAlertMessage(String.format(
                "%s for %s — %s First forecast week crossing the demand-window threshold starts %s.",
                alertDecision.level().equals("CRITICAL") ? "Critical demand window" : "Demand window detected",
                marketName, upliftClause(alertDecision.upliftPct(), demand4w),
                alertDecision.windowOpenDate().toLocalDate()));
        alert.setTrend(alertDecision.trend());
        alert.setIsRead(false);
        alert.setWindowOpenDate(alertDecision.windowOpenDate());
        DemandAlert saved = alertRepo.save(alert);
        MDC.put("code", Module2ErrorCodes.MOD22_ALERT_GENERATED);
        log.info("Demand alert generated for market={} level={} upliftPct={}",
                market, alertDecision.level(), alertDecision.upliftPct());
        MDC.remove("code");
        return saved;
    }

    /**
     * Implements the frozen demand-window rule. This is deliberately not called
     * a generic spike: the rule measures a 20% rolling-baseline uplift. Under
     * the frozen UI vocabulary, a persisted WARNING or CRITICAL is an active
     * surge; the 2σ spike is only an additional condition for CRITICAL.
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

        // See MIN_BASELINE_FOR_UPLIFT_PCT: the raw ratio above already decided
        // whether this is a demand window (predictedDemand4w > threshold) —
        // that detection is unaffected by this floor. Only whether a percentage
        // is worth reporting alongside the decision depends on it.
        Double upliftPct = rolling7dAverage < MIN_BASELINE_FOR_UPLIFT_PCT
                ? null
                : calculateUpliftPct(predictedDemand4w, rolling7dAverage);
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

    /**
     * The uplift half of a demand-window sentence — a percentage claim when
     * {@code upliftPct} is meaningful (see {@link #MIN_BASELINE_FOR_UPLIFT_PCT}),
     * or an absolute-point statement when it is not. Never fabricates a capped
     * or floored percentage; below the floor it simply stops claiming one.
     */
    static String upliftClause(Double upliftPct, double demand4w) {
        if (upliftPct != null) {
            return String.format("the 4-week forecast is %.1f%% above the rolling baseline.", upliftPct);
        }
        return String.format(
                "the 4-week forecast reaches %.1f (out of 100), up sharply from a near-zero recent baseline "
                + "— too low for a percentage comparison to be meaningful.",
                demand4w);
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
        String name = MarketCatalog.displayName(market);
        String city = MarketCatalog.city(market);
        ExternalMarketDataClient.FlightReferenceDto flight = externalClient.getFlightReference(market);

        int matchScore = (int) Math.round(b.marketScore() * 100);

        // Per-carrier direct flag now comes from the route reference (H-21), not
        // a blanket route-level value; tier was a matchScore restatement never
        // rendered by the UI and has been dropped (T-06).
        List<AirlineDto> airlines = flight.airlines().stream()
                .map(c -> new AirlineDto(
                        c.name(),
                        c.code(),
                        c.frequency().replace("x/", "x / "),
                        c.direct()))
                .collect(Collectors.toList());

        List<ChartDataPointDto> chartData = buildChartData(
                b.history(), b.fr4w(), b.weeklyForecasts(), b.latestSignal());

        String directive = buildDirective(market, b.upliftPct(), b.windowOpenDate(), b.spike(), b.confidence(),
                b.fr4w().getPredictedDemand());

        // H-14: computed from the route reference (frequency, direct/stopover,
        // block hours) — see MarketDto.accessibilityScore javadoc.
        int accessibilityScore = computeAccessibility(flight);

        // H-19: derive peak months from ≥52 weeks of seasonal history when it
        // exists; otherwise fall back to the route table's reference list, and
        // tell the UI which one it is looking at.
        Optional<List<String>> derivedPeaks = derivePeakMonths(b.history());
        List<String> peakMonths = derivedPeaks.orElseGet(flight::peakMonths);
        String peakMonthsSource = derivedPeaks.isPresent() ? "seasonal_history" : "reference";

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
        String dataStaleCause = null;
        if (dataStale && b.fr4w().getCategory() != null && b.fr4w().getBusinessProfileId() != null) {
            dataStaleCause = ingestionErrorRepo
                    .findByBusinessProfileIdAndCategoryAndTargetMarket(
                            b.fr4w().getBusinessProfileId(), b.fr4w().getCategory(), market)
                    .map(MarketIngestionError::getErrorMessage)
                    .orElse(null);
        }

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
                market, rank, name, city, matchScore, directive,
                flight.directFlight(), flight.flightHours(), flight.distanceKm(),
                flight.nearestAirport(), flight.destinationAirport(),
                accessibilityScore,
                flight.flightFrequency(),
                flight.fareMinPhp(),
                flight.fareMaxPhp(),
                flight.fareSource(),
                flight.fareValidFrom(),
                airlines,
                peakMonths,
                peakMonthsSource,
                buildEconomyInsight(b.ms(), b.forexTrend()),
                buildSeasonalityInsight(b.ms()),
                chartData,
                gdpTrendDtos,
                forexTrendDtos,
                currency,
                forexLabel(currency),
                gdpValue,
                forexValue,
                ms.getSeasonalityScore() != null ? ms.getSeasonalityScore() : 0.0,
                ms.getYoyRatio(),
                Boolean.TRUE.equals(ms.getSpikeIndicator()),
                dataAsOf,
                dataStale,
                dataStaleCause,
                gdpSource,
                forexSource,
                macroAsOf,
                b.surgeLevel(),
                b.upliftPct(),
                b.windowOpenDate() != null ? b.windowOpenDate().toString() : null,
                ms.getScorer(),
                b.confidence(),
                b.fr4w().getMapeScore() != null && b.fr4w().getMapeScore() > MAPE_THRESHOLD,
                b.fr4w().getSource()
        );
    }

    /**
     * H-14 route-accessibility score on a 1–10 scale, computed from the route
     * reference (never a flat {@code direct ? 9 : 6}). See the
     * {@code MarketDto.accessibilityScore} javadoc for the weighting. Today's
     * reference data yields Korea 10, Japan 9, USA 4.
     */
    static int computeAccessibility(ExternalMarketDataClient.FlightReferenceDto f) {
        double base      = f.directFlight() ? 6.0 : 3.0;
        double freqNorm  = Math.min(1.0, Math.max(0, f.flightFrequency()) / 14.0);
        double hoursNorm = 1.0 - Math.min(1.0, parseBlockHours(f.flightHours()) / 18.0);
        double raw = base + 2.0 * freqNorm + 2.0 * hoursNorm;
        return (int) Math.round(Math.max(1.0, Math.min(10.0, raw)));
    }

    /**
     * Best-effort block-hours from a route's {@code flightHours} label.
     * "3h 45m" → 3.75; "16h+ (via MNL)" → 16; anything unparseable → 12.
     */
    static double parseBlockHours(String flightHours) {
        if (flightHours == null) return 12.0;
        int hIdx = flightHours.indexOf('h');
        if (hIdx <= 0) return 12.0;
        try {
            int start = hIdx;
            while (start > 0 && Character.isDigit(flightHours.charAt(start - 1))) start--;
            double hours = Double.parseDouble(flightHours.substring(start, hIdx).trim());
            int mIdx = flightHours.indexOf('m', hIdx);
            if (mIdx > hIdx) {
                int mStart = mIdx;
                while (mStart > hIdx && Character.isDigit(flightHours.charAt(mStart - 1))) mStart--;
                String mins = flightHours.substring(mStart, mIdx).trim();
                if (!mins.isEmpty()) hours += Double.parseDouble(mins) / 60.0;
            }
            return hours > 0 ? hours : 12.0;
        } catch (RuntimeException e) {
            return 12.0;
        }
    }

    /**
     * H-19: derive the four peak months for a market from its own weekly signal
     * history — the calendar months whose mean seasonality score is highest.
     *
     * <p>Returns empty (caller falls back to the route table's reference list)
     * unless there are at least {@link #PEAK_MONTHS_MIN_WEEKS} weekly rows AND
     * data in at least {@link #PEAK_MONTHS_MIN_COVERAGE} distinct calendar
     * months, so a short or lopsided series never produces a confident-looking
     * derivation. Months are returned in calendar order.
     */
    static Optional<List<String>> derivePeakMonths(List<MarketSignalRecord> history) {
        if (history == null || history.size() < PEAK_MONTHS_MIN_WEEKS) return Optional.empty();

        double[] sum = new double[12];
        int[] count = new int[12];
        for (MarketSignalRecord r : history) {
            LocalDate week = r.getWeekStartDate();
            Double seasonality = r.getSeasonalityScore();
            if (week == null || seasonality == null || !Double.isFinite(seasonality)) continue;
            int m = week.getMonthValue() - 1;
            sum[m] += seasonality;
            count[m]++;
        }

        List<Integer> withData = new ArrayList<>();
        for (int m = 0; m < 12; m++) if (count[m] > 0) withData.add(m);
        if (withData.size() < PEAK_MONTHS_MIN_COVERAGE) return Optional.empty();

        withData.sort((a, b) -> Double.compare(sum[b] / count[b], sum[a] / count[a]));
        List<Integer> top = new ArrayList<>(withData.subList(0, Math.min(4, withData.size())));
        top.sort(Integer::compareTo);

        List<String> months = new ArrayList<>();
        for (int m : top) months.add(MONTH_ABBR[m]);
        return Optional.of(months);
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

        // Latest signal value carried forward into future chart points. Per-point
        // forex/gdp were removed (T-06): nothing rendered them — the drawer's
        // Purchasing Power tab reads MarketDto.gdpValue/forexValue and the
        // gdpTrend/forexTrend series instead.
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
        // ── Real history points ───────────────────────────────────────────────
        // Formula: label = "Wk -" + (recent.size() - 1 - i) for non-Current slots.
        // This scales to any number of real records (1..12).
        for (int i = 0; i < recent.size(); i++) {
            MarketSignalRecord r = recent.get(i);
            boolean isCurrent = (i == recent.size() - 1);
            String label = isCurrent ? "Current" : "Wk -" + (recent.size() - 1 - i);
            Double seasonality100 = (r.getSeasonalityScore() != null)
                    ? r.getSeasonalityScore() * 100.0 : null;
            double spikeVal = Boolean.TRUE.equals(r.getSpikeIndicator()) ? 1.0 : 0.0;
            // "Current" shows both history observation and Wk+1 forecast as the transition
            Double forecastValue = isCurrent ? wf.get(0) : null;

            points.add(new ChartDataPointDto(
                    label, r.getWeekStartDate() != null ? r.getWeekStartDate().toString() : null,
                    r.getTrendIndex(), forecastValue,
                    seasonality100, spikeVal));
        }

        // Synthetic "Current" anchor when no real history exists at all
        // ── 12 forecast points (Wk +1 … Wk +12) ─────────────────────────────
        for (int w = 1; w <= 12; w++) {
            points.add(new ChartDataPointDto(
                    "Wk +" + w,
                    latestSignal != null && latestSignal.getWeekStartDate() != null
                            ? latestSignal.getWeekStartDate().plusWeeks(w).toString() : null,
                    null,
                    wf.get(w - 1),
                    null,
                    0.0
            ));
        }

        return points;
    }

    /**
     * Truthful operator directive. Every numeric/date claim comes from the
     * persisted alert or forecast, rather than from a generic marketing script.
     */
    static String buildDirective(String market, Double upliftPct, OffsetDateTime windowOpenDate,
                                 boolean spike, double confidence, double demand4w) {
        String marketName = MarketCatalog.displayName(market);
        String confidenceText = String.format("%.0f%%", Math.max(0.0, Math.min(1.0, confidence)) * 100.0);
        // windowOpenDate alone decides whether a window is active — upliftPct can
        // be null on an active window (MIN_BASELINE_FOR_UPLIFT_PCT) and must never
        // be misread as "no window" (that was a real bug this fix would otherwise
        // have introduced: a genuine alert with a near-zero baseline would have
        // silently rendered as "No active demand window").
        if (windowOpenDate != null) {
            String upliftPhrase = upliftPct != null
                    ? String.format("a %.1f%% forecast uplift above its rolling baseline", upliftPct)
                    : String.format(
                            "a forecast reaching %.1f (out of 100) — up sharply from a near-zero recent "
                            + "baseline, too low for a percentage comparison to be meaningful",
                            demand4w);
            return String.format(
                    "%s has %s; the demand window opens %s. %s Forecast confidence is %s.",
                    marketName, upliftPhrase, windowOpenDate.toLocalDate(),
                    spike ? "A current interest spike is present." : "No current interest spike is present.",
                    confidenceText);
        }
        return String.format("No active demand window is currently persisted for %s. Forecast confidence is %s.",
                marketName, confidenceText);
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
                + "for visitors spending in Cebu — the currency is currently %s. The %s economic "
                + "viability scorer weighted this market's accessibility alongside flight data.",
                gdpTrend, gdp, forexSentiment, trendClause,
                "xgboost".equals(ms.getScorer()) ? "XGBoost" : "linear fallback");
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
    static String buildSeasonalityInsight(MarketScore ms) {
        double score = ms.getSeasonalityScore() != null ? ms.getSeasonalityScore() : 0.5;
        if (score >= 0.85)
            return "Strong recurring seasonal patterns detected (high YoY ratio + spike signals). "
                 + "Align campaigns with peak travel windows 6–8 weeks ahead for maximum impact.";
        if (score >= 0.70)
            return "Moderate seasonal pattern detected. Use the identified peak months to time campaigns, "
                 + "while continuing to validate recurrence with new weekly data.";
        if (score >= 0.40)
            return "Weak — emerging seasonal pattern. Keep a steady content cadence and use new weekly "
                 + "signals to confirm whether the identified peak months recur.";
        return "No seasonal basis yet. Continue collecting weekly history before assigning campaign timing "
             + "to a recurring seasonal pattern.";
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
        // "dependency" names whichever engine actually produced this response (stub-v1,
        // groq, bilstm, ...) rather than a hardcoded "groq" — the same class of stale
        // label bug already fixed for the pytrends→serpapi migration elsewhere in this
        // pipeline; this error is reachable under any forecast engine, not only Groq.
        String dependency = String.valueOf(map.getOrDefault("source", "forecast-engine"));
        throw AiDependencyException.fromBody(502, Map.of(
                "code", Module2ErrorCodes.MOD22_INFERENCE_FAILED,
                "message", "Forecast inference for " + market + " is missing required field '" + key + "'.",
                "dependency", dependency,
                "cause", "batch inference response for " + market + " did not include a numeric '" + key + "' value",
                "stage", "spring/forecasting"), "forecasting/pipeline");
    }

    /**
     * Like {@link #requireNum}, but for a field the FastAPI contract itself declares
     * nullable (mape/mae/rmse in ForecastResponse — see
     * backend/fastapi-transformer/app/routers/forecasting.py). A null here is a
     * legitimate "could not be computed" answer (MAPE is undefined when the actual
     * value is 0, which a thin-history/near-zero-interest category hits often) —
     * not a missing-field error, so this returns null instead of throwing.
     */
    private static Double optionalNum(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return (v instanceof Number n && Double.isFinite(n.doubleValue())) ? n.doubleValue() : null;
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

    private static String requireScorer(Map<String, Object> scoreResult, String market) {
        Object value = scoreResult.get("scorer");
        if (value instanceof String scorer && ("xgboost".equals(scorer) || "linear".equals(scorer))) {
            return scorer;
        }
        throw AiDependencyException.fromBody(502, Map.of(
                "code", Module2ErrorCodes.MOD22_INFERENCE_FAILED,
                "message", "Economic score for " + market + " is missing a valid scorer identifier.",
                "dependency", "economic-scorer",
                "cause", "score response must contain scorer=xgboost or scorer=linear",
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
            MarketSignalRecord latestSignal,
            String surgeLevel,
            Double upliftPct,
            OffsetDateTime windowOpenDate) {}

    /** Package-visible pure result of the frozen demand-window alert rule. */
    /**
     * {@code upliftPct} is {@code null} when the rolling-7d baseline is below
     * {@link #MIN_BASELINE_FOR_UPLIFT_PCT} — see that constant's Javadoc. The
     * alert itself is still real; only the percentage claim is withheld.
     */
    record DemandAlertDecision(String level, Double upliftPct, String trend, OffsetDateTime windowOpenDate) {}
}
