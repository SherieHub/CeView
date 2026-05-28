package com.ceview.module2.submodule22;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule21.MarketEconomicTrend;
import com.ceview.module2.submodule21.MarketEconomicTrendRepository;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Seeds realistic mock market radar data into the DB on startup when no forecast
 * data exists yet for any business profile.
 *
 * Idempotent: skipped entirely if tbl_forecast_result already has rows for the
 * target profile. Re-run the app after clearing forecast rows to re-seed.
 */
@Component
public class MarketRadarDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MarketRadarDataSeeder.class);

    private final BusinessProfileRepository profileRepo;
    private final MarketSignalRecordRepository signalRepo;
    private final ForecastResultRepository forecastRepo;
    private final MarketScoreRepository scoreRepo;
    private final DemandAlertRepository alertRepo;
    private final MarketEconomicTrendRepository economicTrendRepo;
    private final ObjectMapper objectMapper;

    public MarketRadarDataSeeder(BusinessProfileRepository profileRepo,
                                 MarketSignalRecordRepository signalRepo,
                                 ForecastResultRepository forecastRepo,
                                 MarketScoreRepository scoreRepo,
                                 DemandAlertRepository alertRepo,
                                 MarketEconomicTrendRepository economicTrendRepo,
                                 ObjectMapper objectMapper) {
        this.profileRepo       = profileRepo;
        this.signalRepo        = signalRepo;
        this.forecastRepo      = forecastRepo;
        this.scoreRepo         = scoreRepo;
        this.alertRepo         = alertRepo;
        this.economicTrendRepo = economicTrendRepo;
        this.objectMapper      = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        Optional<BusinessProfile> profileOpt = profileRepo.findAll().stream()
                .filter(p -> p.categoriesList() != null && !p.categoriesList().isEmpty())
                .findFirst();

        if (profileOpt.isEmpty()) {
            log.info("MarketRadarDataSeeder: no business profile with categories found — skipping seed");
            return;
        }

        BusinessProfile profile = profileOpt.get();
        UUID profileId = profile.getBusinessProfileId();

        if (forecastRepo.existsByBusinessProfileId(profileId)) {
            log.info("MarketRadarDataSeeder: forecast data already exists for profile={} — skipping seed", profileId);
            return;
        }

        log.info("MarketRadarDataSeeder: seeding mock market radar data for profile={}", profileId);

        try {
            seedMarket(profileId, "korea",
                    new double[]{58,60,62,63,65,66,68,69,70,72,73,75},
                    2.8, 0.026, 0.72, true, 71.0, 0.83,
                    new double[]{62,65,68,71,73,75,72,69,66,64,67,70},
                    "[{\"year\":2020,\"value\":-0.7},{\"year\":2021,\"value\":4.1},{\"year\":2022,\"value\":2.6},{\"year\":2023,\"value\":1.4},{\"year\":2024,\"value\":2.8}]",
                    "[{\"date\":\"2024-06\",\"value\":0.0251},{\"date\":\"2024-07\",\"value\":0.0255},{\"date\":\"2024-08\",\"value\":0.0258},{\"date\":\"2024-09\",\"value\":0.0254},{\"date\":\"2024-10\",\"value\":0.0252},{\"date\":\"2024-11\",\"value\":0.0250},{\"date\":\"2024-12\",\"value\":0.0248},{\"date\":\"2025-01\",\"value\":0.0253},{\"date\":\"2025-02\",\"value\":0.0257},{\"date\":\"2025-03\",\"value\":0.0260},{\"date\":\"2025-04\",\"value\":0.0263},{\"date\":\"2025-05\",\"value\":0.0261}]",
                    "KRW", 0.0261, 2.8, 1);

            seedMarket(profileId, "japan",
                    new double[]{48,49,50,51,52,53,54,55,56,57,57,58},
                    1.5, 0.19, 0.60, false, 54.0, 0.66,
                    new double[]{51,53,55,57,56,54,52,50,51,53,55,54},
                    "[{\"year\":2020,\"value\":-4.1},{\"year\":2021,\"value\":2.1},{\"year\":2022,\"value\":1.0},{\"year\":2023,\"value\":1.9},{\"year\":2024,\"value\":1.5}]",
                    "[{\"date\":\"2024-06\",\"value\":0.184},{\"date\":\"2024-07\",\"value\":0.187},{\"date\":\"2024-08\",\"value\":0.189},{\"date\":\"2024-09\",\"value\":0.191},{\"date\":\"2024-10\",\"value\":0.188},{\"date\":\"2024-11\",\"value\":0.185},{\"date\":\"2024-12\",\"value\":0.183},{\"date\":\"2025-01\",\"value\":0.186},{\"date\":\"2025-02\",\"value\":0.190},{\"date\":\"2025-03\",\"value\":0.193},{\"date\":\"2025-04\",\"value\":0.191},{\"date\":\"2025-05\",\"value\":0.189}]",
                    "JPY", 0.189, 1.5, 2);

            seedMarket(profileId, "usa",
                    new double[]{42,43,43,44,45,45,46,47,47,48,49,50},
                    2.5, 0.018, 0.52, false, 46.0, 0.57,
                    new double[]{44,46,48,47,45,43,44,46,48,50,49,47},
                    "[{\"year\":2020,\"value\":-2.8},{\"year\":2021,\"value\":5.9},{\"year\":2022,\"value\":2.1},{\"year\":2023,\"value\":2.5},{\"year\":2024,\"value\":2.5}]",
                    "[{\"date\":\"2024-06\",\"value\":0.0175},{\"date\":\"2024-07\",\"value\":0.0177},{\"date\":\"2024-08\",\"value\":0.0179},{\"date\":\"2024-09\",\"value\":0.0180},{\"date\":\"2024-10\",\"value\":0.0178},{\"date\":\"2024-11\",\"value\":0.0176},{\"date\":\"2024-12\",\"value\":0.0175},{\"date\":\"2025-01\",\"value\":0.0178},{\"date\":\"2025-02\",\"value\":0.0180},{\"date\":\"2025-03\",\"value\":0.0182},{\"date\":\"2025-04\",\"value\":0.0181},{\"date\":\"2025-05\",\"value\":0.0180}]",
                    "USD", 0.0180, 2.5, 3);

            log.info("MarketRadarDataSeeder: seed complete for profile={}", profileId);
        } catch (Exception e) {
            log.error("MarketRadarDataSeeder: seed failed for profile={}: {}", profileId, e.getMessage(), e);
        }
    }

    /**
     * Seeds all rows for one market: 12 signal records, 2 forecast results (4w + 12w),
     * 1 market score, 1 demand alert (if spike), and 1 economic trend snapshot.
     */
    private void seedMarket(UUID profileId, String market,
                             double[] trendHistory,
                             double gdp, double forex, double seasonality, boolean spike,
                             double demand4w, double marketScore,
                             double[] weeklyForecasts,
                             String gdpTrendJson, String forexTrendJson,
                             String currencyCode, double forexLatest, double gdpLatest,
                             int rank) throws Exception {

        OffsetDateTime now = OffsetDateTime.now();

        // ── 12 weekly signal records (oldest first, newest = now) ─────────────
        double rollingAvg  = trendHistory[trendHistory.length - 1];
        double rollingStd  = 4.5;
        double rollingAvg30 = rollingAvg * 0.95;

        for (int i = 0; i < 12; i++) {
            MarketSignalRecord rec = new MarketSignalRecord();
            rec.setBusinessProfileId(profileId);
            rec.setTargetMarket(market);
            rec.setTrendIndex(trendHistory[i]);
            rec.setForexRate(forex);
            rec.setGdpGrowth(gdp);
            rec.setSeasonalityScore(seasonality);
            rec.setRollingAverage(rollingAvg);
            rec.setRollingAverage7d(rollingAvg);
            rec.setRollingAverage30d(rollingAvg30);
            rec.setRollingStdDev(rollingStd);
            rec.setSpikeIndicator(i == 11 && spike);
            rec.setYoyRatio(1.05);
            rec.setAggregatedAt(now.minusWeeks(11 - i));
            signalRepo.save(rec);
        }

        // ── Forecast results (4w and 12w) ─────────────────────────────────────
        List<Double> wfList = new java.util.ArrayList<>();
        for (double v : weeklyForecasts) wfList.add(v);
        String wfJson = objectMapper.writeValueAsString(wfList);

        ForecastResult fr4w = new ForecastResult();
        fr4w.setBusinessProfileId(profileId);
        fr4w.setTargetMarket(market);
        fr4w.setPredictedDemand(demand4w);
        fr4w.setForecastConfidence(0.82);
        fr4w.setMapeScore(8.5);
        fr4w.setMae(5.2);
        fr4w.setRmse(7.8);
        fr4w.setForecastHorizonWeeks(4);
        fr4w.setWeeklyForecastsJson(wfJson);
        forecastRepo.save(fr4w);

        ForecastResult fr12w = new ForecastResult();
        fr12w.setBusinessProfileId(profileId);
        fr12w.setTargetMarket(market);
        fr12w.setPredictedDemand(demand4w * 0.95);
        fr12w.setForecastConfidence(0.74);
        fr12w.setMapeScore(11.2);
        fr12w.setMae(7.1);
        fr12w.setRmse(10.3);
        fr12w.setForecastHorizonWeeks(12);
        forecastRepo.save(fr12w);

        // ── Market score ──────────────────────────────────────────────────────
        MarketScore ms = new MarketScore();
        ms.setForecastResultId(fr4w.getForecastResultId());
        ms.setMarketScore(marketScore);
        ms.setSeasonalityScore(seasonality);
        ms.setSpikeIndicator(spike);
        ms.setGdpPerCapitaGrowth(gdp);
        ms.setForexVsPhp(forex);
        ms.setHistoricalArrivals(80_000);
        ms.setMarketRank(rank);
        scoreRepo.save(ms);

        // ── Demand alert (Korea only — spike = true) ──────────────────────────
        if (spike) {
            DemandAlert alert = new DemandAlert();
            alert.setMarketScoreId(ms.getMarketScoreId());
            alert.setAlertLevel("WARNING");
            alert.setAlertMessage("Demand window opening for South Korea — predicted demand 20% above baseline. Target within 4 weeks for maximum reach.");
            alert.setTrend("Rising demand window");
            alert.setIsRead(false);
            alert.setWindowOpenDate(now.plusWeeks(1));
            alertRepo.save(alert);
        }

        // ── Economic trend snapshot ───────────────────────────────────────────
        MarketEconomicTrend trend = new MarketEconomicTrend();
        trend.setMarket(market);
        trend.setGdpTrendJson(gdpTrendJson);
        trend.setForexTrendJson(forexTrendJson);
        trend.setGdpLatest(gdpLatest);
        trend.setForexLatest(forexLatest);
        trend.setCurrencyCode(currencyCode);
        trend.setGdpPoints(5);
        trend.setForexPoints(12);
        economicTrendRepo.save(trend);
    }
}
