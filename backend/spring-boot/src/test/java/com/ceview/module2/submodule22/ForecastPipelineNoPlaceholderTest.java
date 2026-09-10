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
    @Autowired BusinessProfileRepository profileRepo;
    @Autowired MarketSignalRecordRepository signalRepo;

    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        signalRepo.deleteAll();
        forecastRepo.deleteAll();
        profileRepo.deleteAll();

        profileId = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setBusinessProfileId(profileId);
        profile.setBusinessName("No Placeholder Test");
        profile.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(profile);

        // 4 weeks of real, measured history per market — mirrors ChartDataVisualTest's
        // proven-working seed shape (category left null; loadCategoryScopedHistory
        // falls back to the unscoped finder) so this test fails only for the H-29
        // reason under test, not for an unrelated "no signal data" reason.
        for (String market : List.of("korea", "japan", "usa")) {
            for (int i = 0; i < 4; i++) {
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
                r.setAggregatedAt(OffsetDateTime.now().minusWeeks(3 - i));
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
                new ExternalMarketDataClient.FlightReferenceDto("korea", true, "3h", 2_000, 10, List.of()));

        // The exact H-29 defect: predicted_demand_4w is missing from every market's
        // batch-inference result.
        Map<String, Object> incompleteForecast = Map.of(
                "predicted_demand_12w", 55.0,
                "mape", 8.0, "mae", 4.0, "rmse", 6.0, "confidence", 0.8);
        when(ai.runForecastInferenceBatch(any())).thenReturn(Map.of(
                "korea", incompleteForecast, "japan", incompleteForecast, "usa", incompleteForecast));
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
    }
}
