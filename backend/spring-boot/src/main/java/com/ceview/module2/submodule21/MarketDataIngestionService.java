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
     * Run the 2.1 ingestion pipeline for all three target markets.
     *
     * @return number of markets successfully ingested
     */
    public int ingestForProfile(BusinessProfile profile) {
        int count = 0;
        for (String market : MARKETS) {
            try {
                ingestMarket(profile, market);
                count++;
            } catch (Exception e) {
                MDC.put("code", Module2ErrorCodes.MOD21_INGESTION_JOB_FAILED);
                log.warn("Ingestion failed for profile={} market={}: {}",
                        profile.getBusinessProfileId(), market, e.getMessage());
                MDC.remove("code");
            }
        }
        return count;
    }

    // ─── private pipeline ────────────────────────────────────────────────────

    private void ingestMarket(BusinessProfile profile, String market) {
        UUID         profileId  = profile.getBusinessProfileId();
        List<String> categories = profile.categoriesList();

        // ── Concurrent external fetches ──────────────────────────────────────
        CompletableFuture<ExternalMarketDataClient.GdpDataDto> gdpFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchGdpGrowth(market));

        CompletableFuture<ExternalMarketDataClient.ForexDataDto> forexFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchForexRate(market));

        CompletableFuture.allOf(gdpFuture, forexFuture).join();

        ExternalMarketDataClient.GdpDataDto    gdp   = gdpFuture.join();
        ExternalMarketDataClient.ForexDataDto  forex = forexFuture.join();

        // ── Load existing signal history ──────────────────────────────────────
        List<MarketSignalRecord> history = signalRepo
                .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);

        // ── First ingestion: backfill N weeks of real historical trend data ───
        // On first run for a profile/market there are no signal records, so the
        // chart would show a flat line.  Fetch 12 weeks of weekly PyTrends data
        // and persist one MarketSignalRecord per historical week so the chart
        // shows real week-over-week variance from the very first forecast.
        double trendIndex;
        if (history.isEmpty()) {
            Map<String, Object> historyResult = ai.fetchTrendHistory(
                    Map.of("market", market, "categories", categories, "weeks", 12));
            trendIndex = backfillHistory(profileId, market, historyResult, gdp, forex);
            // Reload history so the seasonality call below has the backfilled series
            history = signalRepo
                    .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);
        } else {
            Map<String, Object> trendsResult = ai.fetchTrends(
                    Map.of("market", market, "categories", categories));
            trendIndex = Math.max(0.0, Math.min(100.0,
                    ((Number) trendsResult.getOrDefault("trend_index", 50.0)).doubleValue()));
        }

        // Build chronological weekly trend series for SeasonalShiftDetector
        List<Double> weeklyHistory = history.stream()
                .map(MarketSignalRecord::getTrendIndex)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
        Collections.reverse(weeklyHistory);        // oldest first (chronological)
        weeklyHistory.add(trendIndex);             // append today's fresh observation

        // 30-period rolling average for forex (smooths FX volatility — FR2.4)
        List<Double> recentForex = history.stream()
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
        boolean  spike            = false;
        Double   yoyRatio         = null;

        try {
            Map<String, Object> sResult = ai.computeSeasonality(Map.of(
                    "profile_id",     profileId.toString(),
                    "market",         market,
                    "weekly_history", weeklyHistory
            ));
            seasonalityScore = num(sResult, "seasonality_score", 0.5);
            rolling7d        = num(sResult, "rolling_7d_avg",    trendIndex);
            rolling30d       = num(sResult, "rolling_30d_avg",   trendIndex);
            rollingStd7d     = num(sResult, "rolling_7d_std",    0.0);
            spike            = Boolean.TRUE.equals(sResult.get("spike_indicator"));

            Object yoyObj = sResult.get("yoy_ratio");
            if (yoyObj instanceof Number) {
                yoyRatio = ((Number) yoyObj).doubleValue();
            }

        } catch (Exception e) {
            // FastAPI unreachable — apply inline 2σ spike as fallback
            log.debug("Seasonality compute unavailable, applying local 2σ spike fallback: {}",
                    e.getMessage());
            if (weeklyHistory.size() >= 7) {
                List<Double> w7 = weeklyHistory.subList(
                        weeklyHistory.size() - 7, weeklyHistory.size());
                double localMean = mean(w7);
                double localStd  = stdDev(w7, localMean);
                spike     = trendIndex > localMean + 2.0 * localStd;
                rolling7d = localMean;
                rollingStd7d = localStd;
            }
        }

        // ── Persist ────────────────────────────────────────────────────────
        MarketSignalRecord record = new MarketSignalRecord();
        record.setBusinessProfileId(profileId);
        record.setTargetMarket(market);
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
        signalRepo.save(record);

        log.debug("Ingested: profile={} market={} trend={} spike={} yoy={}",
                profileId, market, String.format("%.1f", trendIndex), spike, yoyRatio);
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
    private double backfillHistory(UUID profileId, String market,
                                   Map<String, Object> historyResult,
                                   ExternalMarketDataClient.GdpDataDto gdp,
                                   ExternalMarketDataClient.ForexDataDto forex) {
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

        for (int i = 0; i < historical.size(); i++) {
            Map<String, Object> point = historical.get(i);
            double ti = ((Number) point.getOrDefault("trend_index", 50.0)).doubleValue();

            MarketSignalRecord rec = new MarketSignalRecord();
            rec.setBusinessProfileId(profileId);
            rec.setTargetMarket(market);
            rec.setTrendIndex(ti);
            rec.setForexRate(forex.rateVsPhp());
            rec.setGdpGrowth(gdp.gdpGrowth());
            rec.setSeasonalityScore(0.5);
            rec.setRollingAverage(ti);
            rec.setRollingAverage7d(ti);
            rec.setRollingAverage30d(ti);
            rec.setRollingStdDev(0.0);
            rec.setSpikeIndicator(false);

            // Set the timestamp to the corresponding past week
            String dateStr = (String) point.get("date");
            if (dateStr != null) {
                try {
                    rec.setAggregatedAt(
                            LocalDate.parse(dateStr).atStartOfDay().atOffset(ZoneOffset.UTC));
                } catch (Exception ignored) {
                    rec.setAggregatedAt(
                            OffsetDateTime.now().minusWeeks(historical.size() - i));
                }
            } else {
                rec.setAggregatedAt(OffsetDateTime.now().minusWeeks(historical.size() - i));
            }

            signalRepo.save(rec);
        }

        log.info("Backfilled {} historical signal records for profile={} market={}",
                historical.size(), profileId, market);

        Map<String, Object> last = series.get(series.size() - 1);
        return Math.max(0.0, Math.min(100.0,
                ((Number) last.getOrDefault("trend_index", 50.0)).doubleValue()));
    }

    // ─── math helpers ─────────────────────────────────────────────────────────

    private double mean(List<Double> values) {
        if (values.isEmpty()) return 0.0;
        return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private double stdDev(List<Double> values, double mean) {
        if (values.size() < 2) return 0.0;
        double variance = values.stream()
                .mapToDouble(v -> (v - mean) * (v - mean))
                .average().orElse(0.0);
        return Math.sqrt(variance);
    }

    private double num(Map<String, Object> map, String key, double def) {
        Object v = map.get(key);
        return v instanceof Number ? ((Number) v).doubleValue() : def;
    }
}
