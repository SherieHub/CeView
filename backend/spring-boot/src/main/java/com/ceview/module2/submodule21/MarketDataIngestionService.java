package com.ceview.module2.submodule21;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module2.Module2ErrorCodes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * Orchestrates the full Submodule 2.1 ingestion pipeline for a single
 * business profile (FR2.1–FR2.8):
 *   fetch trends + GDP + forex concurrently → normalize → rolling stats
 *   → spike indicator → seasonality score → persist MarketSignalRecord
 */
@Service
public class MarketDataIngestionService {

    private static final Logger log = LoggerFactory.getLogger(MarketDataIngestionService.class);

    private static final List<String> MARKETS = List.of("korea", "japan", "usa");
    private static final int ROLLING_WINDOW = 4;
    private static final int FOREX_ROLLING_WINDOW = 30;
    private static final int MIN_WEEKS_FOR_SEASONALITY = 52;
    private static final double SPIKE_MULTIPLIER = 1.5;

    private final AIInferenceGatewayService ai;
    private final ExternalMarketDataClient externalClient;
    private final MarketSignalRecordRepository signalRepo;

    public MarketDataIngestionService(AIInferenceGatewayService ai,
                                      ExternalMarketDataClient externalClient,
                                      MarketSignalRecordRepository signalRepo) {
        this.ai = ai;
        this.externalClient = externalClient;
        this.signalRepo = signalRepo;
    }

    /**
     * Run the 2.1 pipeline for a single profile across all three target markets.
     *
     * @return number of records successfully ingested
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
        UUID profileId = profile.getBusinessProfileId();
        List<String> categories = profile.categoriesList();

        // Concurrent fetch: trends (via FastAPI), GDP, forex
        CompletableFuture<Map<String, Object>> trendsFuture =
                CompletableFuture.supplyAsync(() ->
                        ai.fetchTrends(Map.of("market", market, "categories", categories)));

        CompletableFuture<ExternalMarketDataClient.GdpDataDto> gdpFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchGdpGrowth(market));

        CompletableFuture<ExternalMarketDataClient.ForexDataDto> forexFuture =
                CompletableFuture.supplyAsync(() -> externalClient.fetchForexRate(market));

        CompletableFuture.allOf(trendsFuture, gdpFuture, forexFuture).join();

        Map<String, Object> trendsResult = trendsFuture.join();
        ExternalMarketDataClient.GdpDataDto gdp = gdpFuture.join();
        ExternalMarketDataClient.ForexDataDto forex = forexFuture.join();

        double rawTrend = ((Number) trendsResult.getOrDefault("trend_index", 50.0)).doubleValue();
        double trendIndex = Math.max(0.0, Math.min(100.0, rawTrend));

        // Rolling stats from recent signal records
        List<MarketSignalRecord> history = signalRepo
                .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);

        List<Double> recentTrends = history.stream()
                .limit(ROLLING_WINDOW)
                .map(MarketSignalRecord::getTrendIndex)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        List<Double> recentForex = history.stream()
                .limit(FOREX_ROLLING_WINDOW)
                .map(MarketSignalRecord::getForexRate)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        double rollingMean   = mean(recentTrends);
        double rollingStdDev = stdDev(recentTrends, rollingMean);
        double forexAvg      = recentForex.isEmpty() ? forex.rateVsPhp() : mean(recentForex);
        boolean spike        = rollingMean > 0 && rollingStdDev > SPIKE_MULTIPLIER * rollingMean;

        // Seasonality score: delegate FFT to FastAPI when enough history exists
        double seasonalityScore = 0.5;
        if (history.size() >= MIN_WEEKS_FOR_SEASONALITY) {
            List<Double> weeklyHistory = history.stream()
                    .map(MarketSignalRecord::getTrendIndex)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
            Collections.reverse(weeklyHistory); // chronological order for FFT
            try {
                Map<String, Object> sResult = ai.computeSeasonality(Map.of(
                        "profileId", profileId.toString(),
                        "market", market,
                        "weekly_history", weeklyHistory));
                seasonalityScore = ((Number) sResult.getOrDefault("seasonality_score", 0.5)).doubleValue();
            } catch (Exception e) {
                log.debug("Seasonality compute failed — using default 0.5: {}", e.getMessage());
            }
        }

        // Persist
        MarketSignalRecord record = new MarketSignalRecord();
        record.setBusinessProfileId(profileId);
        record.setTargetMarket(market);
        record.setTrendIndex(trendIndex);
        record.setForexRate(forexAvg);  // 30-day rolling average per FR2.4
        record.setGdpGrowth(gdp.gdpGrowth());
        record.setSeasonalityScore(seasonalityScore);
        record.setRollingAverage(rollingMean == 0.0 ? trendIndex : rollingMean);
        record.setRollingStdDev(rollingStdDev);
        record.setSpikeIndicator(spike);
        signalRepo.save(record);

        log.debug("Ingested signal: profile={} market={} trend={} spike={}",
                profileId, market, trendIndex, spike);
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
}
