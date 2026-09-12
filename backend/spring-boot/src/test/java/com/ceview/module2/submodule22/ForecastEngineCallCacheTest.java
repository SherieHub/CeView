package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reproduces the live incident observed on 2026-09-12: a BiLSTM run against
 * Hugging Face's shared ZeroGPU quota forecast korea::Accommodation
 * successfully, then korea::Culinary exhausted the quota -- and because
 * {@link ForecastingService#runPipeline} is {@code @Transactional}, the whole
 * batch rolled back, discarding the successful call. Retrying immediately
 * re-sent EVERY category, including the one that had just succeeded, spending
 * quota a second time for nothing.
 *
 * <p>{@link ForecastingService#PER_CATEGORY_FORECAST_FRESH_HOURS} fixes this
 * by letting a category with a recent, genuinely-persisted forecast skip the
 * forecast-engine call on the next run and reuse it -- see that constant's
 * Javadoc.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class ForecastEngineCallCacheTest {

    @Autowired ForecastingService forecastingService;
    @Autowired ForecastResultRepository forecastRepo;
    @Autowired MarketScoreRepository scoreRepo;
    @Autowired DemandAlertRepository alertRepo;
    @Autowired BusinessProfileRepository profileRepo;
    @Autowired MarketSignalRecordRepository signalRepo;

    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;

    private UUID profileId;

    private static final List<String> CATEGORIES = List.of("Accommodation & Staycation", "Culinary & Gastronomy");

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
        profile.setBusinessName("Forecast Cache Test");
        profile.setCategoriesList(CATEGORIES);
        profileRepo.save(profile);

        for (String market : List.of("korea", "japan", "usa")) {
            for (String category : CATEGORIES) {
                for (int i = 0; i < 12; i++) {
                    MarketSignalRecord r = new MarketSignalRecord();
                    r.setBusinessProfileId(profileId);
                    r.setTargetMarket(market);
                    r.setCategory(category);
                    r.setTrendIndex(60.0 + i);
                    r.setForexRate(23.5);
                    r.setGdpGrowth(2.2);
                    r.setSeasonalityScore(0.6);
                    r.setRollingAverage(60.0);
                    r.setRollingAverage7d(60.0);
                    r.setRollingAverage30d(58.0);
                    r.setRollingStdDev(3.0);
                    r.setSpikeIndicator(false);
                    r.setSource("serpapi");
                    r.setAggregatedAt(OffsetDateTime.now().minusWeeks(11 - i));
                    signalRepo.save(r);
                }
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
        when(ai.runMarketScoring(any())).thenReturn(
                Map.of("market_score", 0.5, "scorer", "linear",
                        "economic_viability_score", 0.5, "components", Map.of()));
    }

    private static Map<String, Object> completeForecast(double demand4w, double demand12w, String source) {
        return Map.of(
                "predicted_demand_4w", demand4w, "predicted_demand_12w", demand12w,
                "weekly_forecasts", List.of(demand4w, demand4w, demand4w, demand4w,
                        demand12w, demand12w, demand12w, demand12w, demand12w, demand12w, demand12w, demand12w),
                "mape", 8.0, "mae", 4.0, "rmse", 6.0, "confidence", 0.5, "source", source);
    }

    @Test
    void aSuccessfulCategoryIsNotResentToTheForecastEngineOnTheNextRun() {
        // First run: everything succeeds and persists.
        Map<String, Object> forecast = completeForecast(40.0, 38.0, "bilstm");
        when(ai.runForecastInferenceBatch(any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sequences = (List<Map<String, Object>>) inv.getArgument(0);
            Map<String, Object> results = new java.util.LinkedHashMap<>();
            for (Map<String, Object> seq : sequences) {
                String market = (String) seq.get("market");
                String category = (String) seq.get("category");
                results.put(market + "::" + category, forecast);
            }
            return results;
        });

        forecastingService.forecastForProfile(profileId, false, true);

        // 3 markets x 2 categories = 6 pairs sent on the first, cold run.
        verify(ai, times(1)).runForecastInferenceBatch(argThat(seqs -> seqs.size() == 6));

        // Second run, immediately after: every pair is still within the freshness
        // window, so the forecast engine must not be called again at all.
        forecastingService.forecastForProfile(profileId, false, true);

        verify(ai, times(1)).runForecastInferenceBatch(any());   // still just the one call from the first run
    }

    @Test
    void reusedResultsStillProduceRealSourcesNotBlankOnes() {
        Map<String, Object> forecast = completeForecast(90.0, 85.0, "bilstm");   // well above the demand-window trigger
        when(ai.runForecastInferenceBatch(any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sequences = (List<Map<String, Object>>) inv.getArgument(0);
            Map<String, Object> results = new java.util.LinkedHashMap<>();
            for (Map<String, Object> seq : sequences) {
                String market = (String) seq.get("market");
                String category = (String) seq.get("category");
                results.put(market + "::" + category, forecast);
            }
            return results;
        });

        forecastingService.forecastForProfile(profileId, false, true);
        long forecastRowsAfterFirstRun = forecastRepo.findAll().stream()
                .filter(fr -> profileId.equals(fr.getBusinessProfileId())).count();

        forecastingService.forecastForProfile(profileId, false, true);

        // The cached path still runs Phase C (scoring/persistence) -- new rows
        // are appended, not skipped, they are just sourced without a new call.
        long forecastRowsAfterSecondRun = forecastRepo.findAll().stream()
                .filter(fr -> profileId.equals(fr.getBusinessProfileId())).count();
        assertThat(forecastRowsAfterSecondRun).isGreaterThan(forecastRowsAfterFirstRun);

        assertThat(forecastRepo.findAll())
                .filteredOn(fr -> profileId.equals(fr.getBusinessProfileId()))
                .as("reused results still carry the real source label, never a blank/placeholder one")
                .allMatch(fr -> "bilstm".equals(fr.getSource()));
    }

    @Test
    void aStaleCategoryIsStillSentEvenWhenItsSiblingIsFresh() {
        Map<String, Object> forecast = completeForecast(40.0, 38.0, "bilstm");
        when(ai.runForecastInferenceBatch(any())).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> sequences = (List<Map<String, Object>>) inv.getArgument(0);
            Map<String, Object> results = new java.util.LinkedHashMap<>();
            for (Map<String, Object> seq : sequences) {
                String market = (String) seq.get("market");
                String category = (String) seq.get("category");
                results.put(market + "::" + category, forecast);
            }
            return results;
        });

        forecastingService.forecastForProfile(profileId, false, true);

        // Age out exactly one pair's persisted forecast past the freshness window --
        // it alone must be re-sent on the next run.
        forecastRepo.findAll().stream()
                .filter(fr -> profileId.equals(fr.getBusinessProfileId())
                        && "korea".equals(fr.getTargetMarket())
                        && "Accommodation & Staycation".equals(fr.getCategory()))
                .forEach(fr -> {
                    fr.setGeneratedAt(OffsetDateTime.now().minusHours(7));
                    forecastRepo.save(fr);
                });

        forecastingService.forecastForProfile(profileId, false, true);

        // First run (cold, 6 pairs) plus this second run (only the one aged-out
        // pair) — two calls total, the second carrying just that one sequence.
        verify(ai, times(1)).runForecastInferenceBatch(argThat(seqs -> seqs.size() == 6));
        verify(ai, times(1)).runForecastInferenceBatch(argThat(seqs -> seqs.size() == 1));
    }
}
