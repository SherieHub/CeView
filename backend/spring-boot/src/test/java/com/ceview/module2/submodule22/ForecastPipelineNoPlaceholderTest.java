package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.ai.AiDependencyException;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Module 2 E2E, Step 6 (docs/module-2/MODULE_2_E2E_CONTRACT.md; H-29).
 *
 * runPipeline used to silently persist demand=50 (and mape=10 / mae=6 / rmse=9 /
 * confidence=0.8) whenever the Gemini/Groq batch-inference response omitted a
 * required field — a fabricated reading indistinguishable from a real one once
 * charted. This proves the pipeline now throws instead of writing that fallback,
 * and — because {@link ForecastingService#runPipeline} is {@code @Transactional}
 * — that NOTHING is persisted for the run, not even a partial result for a
 * market that was processed before the failing one.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class ForecastPipelineNoPlaceholderTest {

    @Autowired ForecastingService forecastingService;
    @Autowired ForecastResultRepository forecastRepo;
    @Autowired MarketScoreRepository scoreRepo;
    @Autowired DemandAlertRepository alertRepo;
    @Autowired BusinessProfileRepository profileRepo;
    @Autowired MarketSignalRecordRepository signalRepo;

    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        alertRepo.deleteAll();
        scoreRepo.deleteAll();
        forecastRepo.deleteAll();
        signalRepo.deleteAll();
        profileRepo.deleteAll();

        profileId = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setBusinessProfileId(profileId);
        profile.setBusinessName("No Placeholder Test");
        profile.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(profile);

        // 12 weeks of real, measured history per market — the frozen feature
        // matrix must reach Phase B before this test exercises rollback.
        // proven-working seed shape (category left null; loadCategoryScopedHistory
        // falls back to the unscoped finder) so this test fails only for the H-29
        // reason under test, not for an unrelated "no signal data" reason.
        for (String market : List.of("korea", "japan", "usa")) {
            for (int i = 0; i < 12; i++) {
                MarketSignalRecord r = new MarketSignalRecord();
                r.setBusinessProfileId(profileId);
                r.setTargetMarket(market);
                r.setTrendIndex(60.0 + i);
                r.setForexRate(23.5);
                r.setGdpGrowth(2.2);
                r.setSeasonalityScore(0.6);
                r.setRollingAverage(60.0);
                r.setRollingAverage7d(60.0);
                r.setRollingAverage30d(58.0);
                r.setRollingStdDev(3.0);
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
        when(externalClient.getFlightReference(anyString())).thenReturn(
                new ExternalMarketDataClient.FlightReferenceDto("korea", true, "3h", 2_000, 10,
                        "ICN", "CEB", 8_000, 15_000, "static_reference_v1", "2026-09-11",
                        List.of("Jul", "Aug", "Dec", "Jan"), List.of()));

        // The exact H-29 defect: predicted_demand_4w is missing from every market's
        // batch-inference result.
        Map<String, Object> incompleteForecast = Map.of(
                "predicted_demand_12w", 55.0,
                "mape", 8.0, "mae", 4.0, "rmse", 6.0, "confidence", 0.8);
        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.of(
                "korea::Coastal & Island", incompleteForecast,
                "japan::Coastal & Island", incompleteForecast,
                "usa::Coastal & Island",   incompleteForecast));
    }

    @Test
    void missingPredictedDemandThrowsInsteadOfPersistingFifty() {
        assertThatThrownBy(() -> forecastingService.forecastForProfile(profileId, false))
                .isInstanceOf(AiDependencyException.class)
                .satisfies(ex -> assertThat(((AiDependencyException) ex).getCode())
                        .isEqualTo("MOD22_INFERENCE_FAILED"));

        // @Transactional runPipeline rolls back on the thrown exception — nothing
        // persisted for this profile, not even a partial result for a market that
        // was processed before the (deterministically-first) failure.
        assertThat(forecastRepo.findAll())
                .noneMatch(fr -> profileId.equals(fr.getBusinessProfileId()));
        assertThat(scoreRepo.findAll()).isEmpty();
        assertThat(alertRepo.findAll()).isEmpty();
    }

    /**
     * Unlike predicted_demand_4w/12w and confidence, mape/mae/rmse are declared
     * nullable in FastAPI's own ForecastResponse contract — null there means
     * "MAPE is undefined" (e.g. the actual value backtested against was 0), not
     * a missing/broken field. This must NOT throw, and must persist a genuinely
     * null mapeScore rather than crashing the whole pipeline over one category's
     * honestly-uncomputable backtest.
     */
    @Test
    void nullMapeIsPersistedAsNullRatherThanThrowing() {
        Map<String, Object> forecastWithNullMape = Map.of(
                "predicted_demand_4w", 60.0, "predicted_demand_12w", 58.0,
                "weekly_forecasts", List.of(60.0, 60.0, 60.0, 60.0, 58.0, 58.0, 58.0, 58.0, 58.0, 58.0, 58.0, 58.0),
                "mae", 0.0, "rmse", 0.0, "confidence", 0.8, "source", "stub-v1");
        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.of(
                "korea::Coastal & Island", forecastWithNullMape,
                "japan::Coastal & Island", forecastWithNullMape,
                "usa::Coastal & Island",   forecastWithNullMape));
        when(ai.runMarketScoring(any())).thenReturn(
                Map.of("market_score", 0.5, "scorer", "linear",
                        "economic_viability_score", 0.5, "components", Map.of()));

        forecastingService.forecastForProfile(profileId, false);

        List<ForecastResult> results = forecastRepo.findAll().stream()
                .filter(fr -> profileId.equals(fr.getBusinessProfileId()))
                .toList();
        assertThat(results).isNotEmpty();
        assertThat(results).allSatisfy(fr -> assertThat(fr.getMapeScore()).isNull());
    }

    /**
     * Before this fix, persistDemandAlert always INSERTed a fresh row and never
     * retired the previous one for the same (profile, category, market) — every
     * "Refresh forecast" click permanently added another duplicate card to the
     * feed for the same market/category, differing only in uplift %. Running the
     * pipeline twice must leave exactly one alert per pair, carrying the latest
     * run's numbers.
     */
    @Test
    void refreshingTheForecastReplacesThePriorAlertInsteadOfAccumulatingIt() {
        when(ai.runMarketScoring(any())).thenReturn(
                Map.of("market_score", 0.8, "scorer", "linear",
                        "economic_viability_score", 0.8, "components", Map.of()));

        // rolling7dAverage seeded at 60.0 in setUp(); DEMAND_WINDOW_MULTIPLIER=1.2
        // means anything above 72.0 crosses the demand-window threshold.
        Map<String, Object> firstRunForecast = Map.of(
                "predicted_demand_4w", 90.0, "predicted_demand_12w", 88.0,
                "weekly_forecasts", List.of(90.0, 90.0, 90.0, 90.0, 88.0, 88.0, 88.0, 88.0, 88.0, 88.0, 88.0, 88.0),
                "mape", 5.0, "mae", 2.0, "rmse", 3.0, "confidence", 0.9, "source", "stub-v1");
        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.of(
                "korea::Coastal & Island", firstRunForecast,
                "japan::Coastal & Island", firstRunForecast,
                "usa::Coastal & Island",   firstRunForecast));

        forecastingService.forecastForProfile(profileId, false);

        List<DemandAlert> afterFirstRun = alertRepo.findAll().stream()
                .filter(a -> profileId.equals(a.getBusinessProfileId()))
                .toList();
        assertThat(afterFirstRun).hasSize(3); // one per market, all "Coastal & Island"
        double firstUplift = afterFirstRun.get(0).getUpliftPct();

        // Second run: a different (still above-threshold) demand number, mirroring
        // a real "Refresh forecast" click where live trend data shifted slightly.
        Map<String, Object> secondRunForecast = Map.of(
                "predicted_demand_4w", 95.0, "predicted_demand_12w", 92.0,
                "weekly_forecasts", List.of(95.0, 95.0, 95.0, 95.0, 92.0, 92.0, 92.0, 92.0, 92.0, 92.0, 92.0, 92.0),
                "mape", 5.0, "mae", 2.0, "rmse", 3.0, "confidence", 0.9, "source", "stub-v1");
        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.of(
                "korea::Coastal & Island", secondRunForecast,
                "japan::Coastal & Island", secondRunForecast,
                "usa::Coastal & Island",   secondRunForecast));

        forecastingService.forecastForProfile(profileId, false);

        List<DemandAlert> afterSecondRun = alertRepo.findAll().stream()
                .filter(a -> profileId.equals(a.getBusinessProfileId()))
                .toList();
        assertThat(afterSecondRun)
                .as("still exactly one alert per market — the first run's alerts must be replaced, not accumulated")
                .hasSize(3);
        assertThat(afterSecondRun.get(0).getUpliftPct())
                .as("the surviving alert must carry the second run's numbers")
                .isNotEqualTo(firstUplift);
    }
}
