package com.ceview.module2.submodule22;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.dto.MarketDtos.MarketsResponse;
import com.ceview.module2.submodule21.ExternalMarketDataClient;
import com.ceview.module2.submodule21.MarketDataIngestionService;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Audit C-09 — {@code POST /api/forecasting/ensure} is called on dashboard
 * mount with a 12h staleness gate. Proves it is cheap on fresh data (a DB read,
 * no AI pipeline) and runs the pipeline when the newest forecast is stale.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class EnsureFreshForecastTest {

    @Autowired ForecastingService forecastingService;
    @Autowired ForecastResultRepository forecastRepo;
    @Autowired MarketScoreRepository scoreRepo;
    @Autowired BusinessProfileRepository profileRepo;
    @Autowired MarketSignalRecordRepository signalRepo;

    @MockBean AIInferenceGatewayService ai;
    @MockBean ExternalMarketDataClient externalClient;
    @MockBean MarketDataIngestionService ingestionService;

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
        profile.setBusinessName("Ensure Test");
        profile.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(profile);
    }

    private void seedForecast(OffsetDateTime generatedAt) {
        ForecastResult fr = new ForecastResult();
        fr.setBusinessProfileId(profileId);
        fr.setTargetMarket("korea");
        fr.setForecastHorizonWeeks(4);
        fr.setPredictedDemand(60.0);
        fr.setForecastConfidence(0.8);
        fr.setGeneratedAt(generatedAt);   // @PrePersist only fills this when null
        forecastRepo.save(fr);
    }

    private void seedTwelveWeeksOfSignal() {
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
    }

    @Test
    void returnsCachedRowsWithoutRunningThePipelineWhenTheForecastIsFresh() {
        seedForecast(OffsetDateTime.now());   // fresh — inside the 12h window

        MarketsResponse res = forecastingService.ensureFreshForecast(profileId, 12);

        assertThat(res).isNotNull();
        // Cheap path: a pure DB read, no inference and no ingestion.
        verifyNoInteractions(ai);
        verifyNoInteractions(ingestionService);
    }

    @Test
    void runsThePipelineWhenTheNewestForecastIsStale() {
        seedForecast(OffsetDateTime.now().minusHours(24));   // older than maxAgeHours=12
        seedTwelveWeeksOfSignal();
        when(ai.runForecastInferenceBatch(any()))
                .thenThrow(new RuntimeException("reached the pipeline"));

        assertThatThrownBy(() -> forecastingService.ensureFreshForecast(profileId, 12))
                .hasMessageContaining("reached the pipeline");

        verify(ai).runForecastInferenceBatch(any());
    }

    @Test
    void fastFailsForAnUnknownProfileWithoutTouchingThePipeline() {
        assertThatThrownBy(() -> forecastingService.ensureFreshForecast(UUID.randomUUID(), 12))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(ai);
    }
}
