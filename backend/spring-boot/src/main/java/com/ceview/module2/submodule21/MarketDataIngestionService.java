package com.ceview.module2.submodule21;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module2.Module2ErrorCodes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Orchestrates the Submodule 2.1 ingestion pipeline for a single business
 * profile (FR2.1–FR2.8):
 *
 *   1. Concurrent fetch: PyTrends index (FastAPI) + GDP (World Bank) + forex
 *   2. Delegate the full Seasonal Shift Detection to FastAPI
 *      → POST /internal/market-data/seasonality
 *      Returns: seasonality_score (0–1), rolling_7d_avg, rolling_30d_avg,
 *               rolling_7d_std, spike_indicator (2σ), yoy_ratio
 *   3. Persist MarketSignalRecord with all computed fields
 *
 * Spike detection formula (Phase 2):
 *   spike = TRUE iff current_trend > rolling_7d_avg + (2 × rolling_7d_std)
 *   (Previously: stdDev > 1.5 × mean — replaced per CeView_SeasonalShift_Detection.md)
 */
@Service
public class MarketDataIngestionService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataIngestionService.class);

    private static final List<String> MARKETS              = List.of("korea", "japan", "usa");
    private static final int          FOREX_ROLLING_WINDOW = 30;  // 30-period rolling for forex
    /** Step 4 (contract §2): the one ISO-week API used everywhere in this class —
     *  never dayOfYear/7+1, which misclassifies weeks straddling a year boundary. */
    private static final WeekFields   ISO_WEEK             = WeekFields.ISO;

    private final AIInferenceGatewayService    ai;
    private final ExternalMarketDataClient     externalClient;
    private final MarketSignalRecordRepository signalRepo;

    public MarketDataIngestionService(AIInferenceGatewayService ai,
                                      ExternalMarketDataClient externalClient,
                                      MarketSignalRecordRepository signalRepo) {
        this.ai             = ai;
        this.externalClient = externalClient;
        this.signalRepo     = signalRepo;
    }

    /**
     * Run the 2.1 ingestion pipeline for every (category, market) pair on the
     * profile (Task 1a.2 — one fetchTrends call and one persisted
     * MarketSignalRecord per category, so alerts can be attributed to a real
     * category instead of a blended cross-category value).
     *
     * @return number of (category, market) pairs successfully ingested
     */
    public int ingestForProfile(BusinessProfile profile) {
        List<String> categories = profile.categoriesList();
        if (categories == null || categories.isEmpty()) {
            log.warn("Profile {} has no categories set — skipping ingestion (0 pairs)",
                    profile.getBusinessProfileId());
            return 0;
        }

        int count = 0;
        for (String market : MARKETS) {
            for (String category : categories) {
                try {
                    ingestMarket(profile, market, category);
                    count++;
                } catch (Exception e) {
                    MDC.put("code", Module2ErrorCodes.MOD21_INGESTION_JOB_FAILED);
                    log.warn("Ingestion failed for profile={} market={} category={}: {}",
                            profile.getBusinessProfileId(), market, category, e.getMessage());
                    MDC.remove("code");
                }
            }
        }
        return count;
    }

    // ─── private pipeline ────────────────────────────────────────────────────

    private void ingestMarket(BusinessProfile profile, String market, String category) {
        UUID profileId = profile.getBusinessProfileId();

        // ── Concurrent external fetches ──────────────────────────────────────
        CompletableFuture<ExternalMarketDataClient.GdpDataDto> gdpFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchGdpGrowth(market));

        CompletableFuture<ExternalMarketDataClient.ForexDataDto> forexFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchForexRate(market));

        CompletableFuture.allOf(gdpFuture, forexFuture).join();

        ExternalMarketDataClient.GdpDataDto    gdp   = gdpFuture.join();
        ExternalMarketDataClient.ForexDataDto  forex = forexFuture.join();

        // ── This observation's ISO week (contract §2 / Step 4) ───────────────
        // Computed via WeekFields.ISO from the observation instant (now, in
        // UTC) — never dayOfYear/7+1, which misclassifies weeks straddling a
        // year boundary. This is the key the upsert below writes into.
        OffsetDateTime observedAt = OffsetDateTime.now(ZoneOffset.UTC);
        LocalDate      observedDate = observedAt.toLocalDate();
        short          isoYear      = (short) observedDate.get(ISO_WEEK.weekBasedYear());
        short          isoWeek      = (short) observedDate.get(ISO_WEEK.weekOfWeekBasedYear());
        LocalDate      weekStartDate = observedDate.with(ISO_WEEK.dayOfWeek(), 1L);

        // ── Load existing signal history (scoped to this category — Task 1a.2),
        // ordered by observation week (Step 4) ────────────────────────────────
        List<MarketSignalRecord> history = signalRepo
                .findByProfileMarketCategoryOrderByWeekDesc(profileId, market, category);

        // Prior weeks only — excludes THIS ISO week's own row (if a same-week
        // re-ingest already created one earlier today/this week), so it is
        // never double-counted in the series built below.
        List<MarketSignalRecord> priorWeeks = priorWeeksOnly(history, isoYear, isoWeek);

        // ── First ingestion ever for this (profile, category, market): backfill ─
        // On first run there are no signal records at all, so the chart would
        // show a flat line. Fetch 12 weeks of weekly PyTrends data and persist
        // one MarketSignalRecord per historical week so the chart shows real
        // week-over-week variance from the very first forecast. Triggered on
        // history.isEmpty() (not priorWeeks.isEmpty()): a second same-week
        // re-ingest must never re-trigger a full backfill just because there is
        // no PRIOR week yet in a profile's very first week of data.
        double trendIndex;
        String source;
        if (history.isEmpty()) {
            Map<String, Object> historyResult = ai.fetchTrendHistory(
                    Map.of("market", market, "categories", List.of(category), "weeks", 12));
            source = str(historyResult, "source");
            trendIndex = backfillHistory(profileId, market, category, historyResult, gdp, forex, source);
            // Reload so the seasonality call below has the backfilled series —
            // the backfill never writes the current week, so no re-filtering
            // is needed, but priorWeeksOnly is applied anyway for symmetry and
            // as a defensive guard against a same-week backfill point.
            priorWeeks = priorWeeksOnly(
                    signalRepo.findByProfileMarketCategoryOrderByWeekDesc(profileId, market, category),
                    isoYear, isoWeek);
        } else {
            Map<String, Object> trendsResult = ai.fetchTrends(
                    Map.of("market", market, "categories", List.of(category)));
            source = str(trendsResult, "source");
            trendIndex = Math.max(0.0, Math.min(100.0,
                    ((Number) trendsResult.getOrDefault("trend_index", 50.0)).doubleValue()));
        }

        // Build a strictly weekly, gap-free series for SeasonalShiftDetector
        // (contract §2 / Step 4 gap policy — see WeeklySeriesGapFiller): interior
        // gaps among the PRIOR weeks are linearly interpolated and flagged
        // imputed=true; this week's fresh observation is then appended as the
        // final, always-real point. Nothing imputed here is ever persisted.
        List<WeeklySeriesGapFiller.WeekPoint> priorPoints = priorWeeks.stream()
                .filter(r -> r.getTrendIndex() != null && r.getWeekStartDate() != null)
                .map(r -> new WeeklySeriesGapFiller.WeekPoint(r.getWeekStartDate(), r.getTrendIndex()))
                .collect(Collectors.toList());
        Collections.reverse(priorPoints);          // oldest first (chronological)
        List<WeeklySeriesGapFiller.FilledPoint> filled = WeeklySeriesGapFiller.fill(priorPoints);

        List<Double>  weeklyHistory = new ArrayList<>();
        List<Boolean> imputedFlags  = new ArrayList<>();
        for (WeeklySeriesGapFiller.FilledPoint p : filled) {
            weeklyHistory.add(p.value());
            imputedFlags.add(p.imputed());
        }
        weeklyHistory.add(trendIndex);             // this week's fresh observation — always real
        imputedFlags.add(false);

        // 30-period rolling average for forex (smooths FX volatility — FR2.4)
        List<Double> recentForex = priorWeeks.stream()
                .limit(FOREX_ROLLING_WINDOW)
                .map(MarketSignalRecord::getForexRate)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        double forexAvg = recentForex.isEmpty() ? forex.rateVsPhp() : mean(recentForex);

        // ── Delegate all seasonal shift math to FastAPI ───────────────────────
        // POST /internal/market-data/seasonality
        // Returns: seasonality_score, rolling_7d_avg, rolling_30d_avg,
        //          rolling_7d_std, spike_indicator (2σ test), yoy_ratio
        double   seasonalityScore = 0.5;
        double   rolling7d        = trendIndex;    // safe defaults before FastAPI call
        double   rolling30d       = trendIndex;
        double   rollingStd7d     = 0.0;
        Boolean  spike            = false;
        Double   yoyRatio         = null;
        Integer  statsWindowWeeks = null;   // Step 5: null when not computed — never a placeholder

        try {
            Map<String, Object> sResult = ai.computeSeasonality(Map.of(
                    "profile_id",     profileId.toString(),
                    "market",         market,
                    "weekly_history", weeklyHistory,
                    // Parallel to weekly_history (contract §2 gap policy) — lets the
                    // seasonality service tell a real observation from an interior
                    // linear-interpolation fill-in. Always false for the last entry.
                    "imputed_flags",  imputedFlags
            ));
            seasonalityScore = num(sResult, "seasonality_score", 0.5);
            rolling7d        = num(sResult, "rolling_7d_avg",    trendIndex);
            rolling30d       = num(sResult, "rolling_30d_avg",   trendIndex);
            rollingStd7d     = num(sResult, "rolling_7d_std",    0.0);
            spike            = Boolean.TRUE.equals(sResult.get("spike_indicator"));
            statsWindowWeeks = intOrNull(sResult, "stats_window_weeks");

            Object yoyObj = sResult.get("yoy_ratio");
            if (yoyObj instanceof Number) {
                yoyRatio = ((Number) yoyObj).doubleValue();
            }

        } catch (Exception e) {
            // No local substitute. A guessed spike flag renders identically to a
            // measured one in the dashboard's surge chip, and a false surge is
            // worse than no chip at all. Null means "not determined".
            log.warn("Seasonality service unavailable for market={}; spike_indicator left null: {}",
                     market, e.getMessage());
            spike = null;
        }

        // ── Upsert: one row per (profile, category, market, ISO week) ────────
        // Merge rule for a same-week re-ingest (contract §2.2 / Step 4): replace
        // every measured value with this newest observation; keep the row's
        // EARLIEST firstSeenAt; refresh sourceFetchedAt (and aggregatedAt, which
        // keeps its existing "last refreshed" meaning for staleness tracking).
        MarketSignalRecord record = signalRepo
                .findByBusinessProfileIdAndCategoryAndTargetMarketAndIsoYearAndIsoWeek(
                        profileId, category, market, isoYear, isoWeek)
                .orElseGet(MarketSignalRecord::new);
        OffsetDateTime firstSeenAt = record.getFirstSeenAt() != null ? record.getFirstSeenAt() : observedAt;

        record.setBusinessProfileId(profileId);
        record.setTargetMarket(market);
        record.setCategory(category);
        record.setTrendIndex(trendIndex);
        record.setForexRate(forexAvg);
        record.setGdpGrowth(gdp.gdpGrowth());
        record.setSeasonalityScore(seasonalityScore);
        record.setRollingAverage(rolling7d);         // legacy column — kept for backward compat
        record.setRollingAverage7d(rolling7d);
        record.setRollingAverage30d(rolling30d);
        record.setRollingStdDev(rollingStd7d);
        record.setSpikeIndicator(spike);
        record.setYoyRatio(yoyRatio);
        record.setSource(source);
        record.setSourceFetchedAt(observedAt);
        record.setFirstSeenAt(firstSeenAt);
        record.setAggregatedAt(observedAt);
        record.setIsoYear(isoYear);
        record.setIsoWeek(isoWeek);
        record.setWeekStartDate(weekStartDate);
        record.setStatsWindowWeeks(statsWindowWeeks);
        signalRepo.save(record);

        log.debug("Upserted ISO week {}-W{}: profile={} market={} category={} trend={} spike={} yoy={}",
                isoYear, isoWeek, profileId, market, category, String.format("%.1f", trendIndex), spike, yoyRatio);
    }

    /** Rows strictly outside the given ISO week — excludes it whether or not it exists yet. */
    private static List<MarketSignalRecord> priorWeeksOnly(List<MarketSignalRecord> weekOrderedDesc,
                                                            short isoYear, short isoWeek) {
        return weekOrderedDesc.stream()
                .filter(r -> !(Objects.equals(r.getIsoYear(), isoYear) && Objects.equals(r.getIsoWeek(), isoWeek)))
                .collect(Collectors.toList());
    }

    // ─── backfill helper ──────────────────────────────────────────────────────

    /**
     * Persist one MarketSignalRecord per historical week from the PyTrends series.
     * All-but-the-last entries are stored with past timestamps so the chart
     * shows real week-over-week variance.
     *
     * @return the trend_index of the most-recent (current) week in the series
     */
    @SuppressWarnings("unchecked")
    private double backfillHistory(UUID profileId, String market, String category,
                                   Map<String, Object> historyResult,
                                   ExternalMarketDataClient.GdpDataDto gdp,
                                   ExternalMarketDataClient.ForexDataDto forex,
                                   String source) {
        List<Map<String, Object>> series =
                (List<Map<String, Object>>) historyResult.get("weekly_series");
        if (series == null || series.isEmpty()) {
            return 50.0;  // safe default — normal ingestion will compute the real value
        }

        // Persist all weeks except the last; the last is returned for the caller
        // to handle through the normal seasonality pipeline.
        List<Map<String, Object>> historical = series.size() > 1
                ? series.subList(0, series.size() - 1)
                : List.of();

        // ── Real per-week statistics (Step 5, C-04, H-33) ─────────────────────
        // Sent over the FULL series (all N points, including the one the caller
        // will handle separately), so index i in `historical` lines up exactly
        // with statsPoints[i] — one call, one implementation of the maths,
        // reused from the single-point /seasonality endpoint via compute_series().
        List<Double> allTrendIndices = series.stream()
                .map(point -> ((Number) point.getOrDefault("trend_index", 50.0)).doubleValue())
                .collect(Collectors.toList());
        List<Map<String, Object>> statsPoints;
        try {
            Map<String, Object> seriesResult = ai.computeSeasonalitySeries(
                    Map.of("market", market, "weekly_history", allTrendIndices));
            Object pointsObj = seriesResult.get("points");
            statsPoints = pointsObj instanceof List<?> pointsList
                    ? (List<Map<String, Object>>) (List<?>) pointsList
                    : List.of();
        } catch (Exception e) {
            // No local substitute — the exact principle this step exists to
            // enforce. Every backfilled row below persists NULL statistics
            // rather than a fabricated 0.5 / false / 0.0 triple.
            log.warn("Per-week seasonality statistics unavailable for market={} during "
                    + "backfill; persisting NULL rather than a placeholder: {}",
                    market, e.getMessage());
            statsPoints = List.of();
        }

        OffsetDateTime backfilledAt = OffsetDateTime.now(ZoneOffset.UTC);
        int written = 0;
        for (int i = 0; i < historical.size(); i++) {
            Map<String, Object> point = historical.get(i);
            double ti = ((Number) point.getOrDefault("trend_index", 50.0)).doubleValue();
            Map<String, Object> stats = i < statsPoints.size() ? statsPoints.get(i) : null;

            // Historical observation timestamp — the PyTrends-provided week date
            // when available, else a synthetic fallback counting back from now.
            // Either way, its ISO week key (WeekFields.ISO, Step 4) is derived
            // from THIS date, never from "now".
            OffsetDateTime observedAt;
            String dateStr = (String) point.get("date");
            if (dateStr != null) {
                try {
                    observedAt = LocalDate.parse(dateStr).atStartOfDay().atOffset(ZoneOffset.UTC);
                } catch (Exception ignored) {
                    observedAt = OffsetDateTime.now(ZoneOffset.UTC).minusWeeks(historical.size() - i);
                }
            } else {
                observedAt = OffsetDateTime.now(ZoneOffset.UTC).minusWeeks(historical.size() - i);
            }

            LocalDate observedDate = observedAt.toLocalDate();
            short isoYear = (short) observedDate.get(ISO_WEEK.weekBasedYear());
            short isoWeek = (short) observedDate.get(ISO_WEEK.weekOfWeekBasedYear());
            LocalDate weekStartDate = observedDate.with(ISO_WEEK.dayOfWeek(), 1L);

            // Upsert per historical week too: two PyTrends weekly points could in
            // principle map to the same ISO week (date-format edge cases), and
            // this guarantees the (profile, category, market, ISO week) key is
            // never violated even during backfill.
            MarketSignalRecord rec = signalRepo
                    .findByBusinessProfileIdAndCategoryAndTargetMarketAndIsoYearAndIsoWeek(
                            profileId, category, market, isoYear, isoWeek)
                    .orElseGet(MarketSignalRecord::new);
            OffsetDateTime firstSeenAt = rec.getFirstSeenAt() != null ? rec.getFirstSeenAt() : backfilledAt;

            rec.setBusinessProfileId(profileId);
            rec.setTargetMarket(market);
            rec.setCategory(category);
            rec.setTrendIndex(ti);
            rec.setForexRate(forex.rateVsPhp());
            rec.setGdpGrowth(gdp.gdpGrowth());
            // Real per-week statistics (Step 5, C-04, H-33) — null, never a
            // placeholder, when the series call above failed or this index has
            // no corresponding point.
            rec.setSeasonalityScore(numOrNull(stats, "seasonality_score"));
            rec.setRollingAverage(numOrNull(stats, "rolling_7d_avg"));    // legacy column mirrors 7d
            rec.setRollingAverage7d(numOrNull(stats, "rolling_7d_avg"));
            rec.setRollingAverage30d(numOrNull(stats, "rolling_30d_avg"));
            rec.setRollingStdDev(numOrNull(stats, "rolling_7d_std"));
            rec.setSpikeIndicator(boolOrNull(stats, "spike_indicator"));
            rec.setYoyRatio(numOrNull(stats, "yoy_ratio"));
            rec.setStatsWindowWeeks(intOrNull(stats, "stats_window_weeks"));
            rec.setSource(source);
            rec.setSourceFetchedAt(backfilledAt);
            rec.setFirstSeenAt(firstSeenAt);
            rec.setAggregatedAt(observedAt);
            rec.setIsoYear(isoYear);
            rec.setIsoWeek(isoWeek);
            rec.setWeekStartDate(weekStartDate);

            signalRepo.save(rec);
            written++;
        }

        log.info("Backfilled {} historical signal records for profile={} market={} category={}",
                written, profileId, market, category);

        Map<String, Object> last = series.get(series.size() - 1);
        return Math.max(0.0, Math.min(100.0,
                ((Number) last.getOrDefault("trend_index", 50.0)).doubleValue()));
    }

    // ─── math helpers ─────────────────────────────────────────────────────────

    private double mean(List<Double> values) {
        if (values.isEmpty()) return 0.0;
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private double num(Map<String, Object> map, String key, double def) {
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).doubleValue() : def;
    }

    /**
     * Step 5 (C-04, H-33): the "genuinely cannot be computed" case — used wherever
     * a statistic must be persisted as NULL rather than a fabricated default when
     * {@code map} itself is null (the whole per-week call failed) or the key is
     * absent/not a number.
     */
    private static Double numOrNull(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).doubleValue() : null;
    }

    private static Boolean boolOrNull(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object v = map.get(key);
        return v instanceof Boolean ? (Boolean) v : null;
    }

    private static Integer intOrNull(Map<String, Object> map, String key) {
        if (map == null) return null;
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).intValue() : null;
    }

    /** FastAPI's declared provenance for this fetch, or null → entity defaults it to "unknown". */
    private String str(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return v != null ? v.toString() : null;
    }
}
