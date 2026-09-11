package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule21.ExternalMarketDataClient;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Module 2 E2E, Step 16 (C-07, C-08, C-09).
 *
 * ensureFreshForecast is the call the dashboard makes on mount (wired to the
 * frontend in this step). It must be cheap when data is already fresh — a DB
 * read, never a pipeline run that re-hits Gemini/XGBoost on every page
 * load — and must run the full live pipeline when data is missing or older
 * than maxAgeHours.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class EnsureFreshForecastTest {

    @Autowired ForecastingService forecastingService;
    @Autowired BusinessProfileRepository profileRepo;
    @Autowired ForecastResultRepository forecastRepo;
    @Autowired MarketScoreRepository scoreRepo;
    @Autowired MarketSignalRecordRepository signalRepo;

    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        scoreRepo.deleteAll();
        forecastRepo.deleteAll();
        signalRepo.deleteAll();
        profileRepo.deleteAll();

        profileId = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setBusinessProfileId(profileId);
        profile.setBusinessName("Ensure Fresh Test");
        profile.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(profile);
    }

    @Test
    void freshDataIsServedFromTheDbWithoutRunningThePipeline() {
        for (String market : List.of("korea", "japan", "usa")) {
            ForecastResult fr = new ForecastResult();
            fr.setBusinessProfileId(profileId);
            fr.setTargetMarket(market);
            fr.setCategory("Coastal & Island");
            fr.setPredictedDemand(60.0);
            fr.setForecastConfidence(0.8);
            fr.setMapeScore(8.0);
            fr.setForecastHorizonWeeks(4);
            fr.setSource("stub-v1");
            fr.setGeneratedAt(OffsetDateTime.now().minusHours(1)); // well within 12h
            forecastRepo.save(fr);

            MarketScore ms = new MarketScore();
            ms.setForecastResultId(fr.getForecastResultId());
            ms.setMarketScore(0.7);
            ms.setSeasonalityScore(0.5);
            ms.setSpikeIndicator(false);
            ms.setScorer("linear");
            scoreRepo.save(ms);
        }

        MarketsResponse response = forecastingService.ensureFreshForecast(profileId, 12L);

        // The whole point: fresh data means no ingestion and no AI calls at all.
        verifyNoInteractions(ai);
        verifyNoInteractions(externalClient);
        assertThat(response.markets()).isNotEmpty();
    }

    @Test
    void staleDataRunsTheLivePipeline() {
        for (String market : List.of("korea", "japan", "usa")) {
            ForecastResult fr = new ForecastResult();
            fr.setBusinessProfileId(profileId);
            fr.setTargetMarket(market);
            fr.setCategory("Coastal & Island");
            fr.setPredictedDemand(60.0);
            fr.setForecastConfidence(0.8);
            fr.setMapeScore(8.0);
            fr.setForecastHorizonWeeks(4);
            fr.setSource("stub-v1");
            fr.setGeneratedAt(OffsetDateTime.now().minusHours(20)); // older than 12h
            forecastRepo.save(fr);
        }

        // 12 weeks of real history per market so EnrichedSequenceBuilder's
        // MIN_RECORDS is satisfied and the live pipeline can actually complete.
        for (String market : List.of("korea", "japan", "usa")) {
            for (int i = 0; i < 12; i++) {
                MarketSignalRecord r = new MarketSignalRecord();
                r.setBusinessProfileId(profileId);
                r.setTargetMarket(market);
                r.setTrendIndex(55.0 + i);
                r.setForexRate(23.5);
                r.setGdpGrowth(2.2);
                r.setSeasonalityScore(0.6);
                r.setSpikeIndicator(false);
                r.setSource("pytrends");
                r.setAggregatedAt(OffsetDateTime.now().minusWeeks(11 - i));
                signalRepo.save(r);
            }
        }

        when(externalClient.fetchGdpTrend(anyString())).thenReturn(
                new ExternalMarketDataClient.GdpTrendDto("KR",
                        List.of(new ExternalMarketDataClient.GdpTrendPoint(2024, 2.2)),
                        2.2, OffsetDateTime.now()));
        when(externalClient.fetchForexTrend(anyString())).thenReturn(
                new ExternalMarketDataClient.ForexTrendDto("KRW",
                        List.of(new ExternalMarketDataClient.ForexTrendPoint("2026-08", 23.5)),
                        23.5, OffsetDateTime.now()));

        Map<String, Object> completeForecast = Map.of(
                "predicted_demand_4w", 65.0, "predicted_demand_12w", 60.0,
                "weekly_forecasts", List.of(61.0, 62.0, 63.0, 64.0, 65.0, 65.0, 64.0, 64.0, 63.0, 63.0, 62.0, 62.0),
                "mape", 8.0, "mae", 4.0, "rmse", 6.0, "confidence", 0.8, "source", "stub-v1");
        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.of(
                "korea", completeForecast, "japan", completeForecast, "usa", completeForecast));
        when(ai.runMarketScoring(any())).thenReturn(
                Map.of("market_score", 0.7, "scorer", "linear", "economic_viability_score", 0.6, "components", Map.of()));

        forecastingService.ensureFreshForecast(profileId, 12L);

        // Stale data means ensureFreshForecast must actually invoke the live
        // pipeline — proven by the Gemini/Groq batch call actually happening,
        // not merely serving the (now-stale) rows already in the DB.
        org.mockito.Mockito.verify(ai).runForecastInferenceBatch(any());
    }
}
