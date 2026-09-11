package com.ceview.module2.submodule21;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule22.ForecastingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Audit C-08 — the daily ingestion job now runs the forecast pipeline for each
 * profile it ingests, so a new operator sees alerts without pressing Refresh.
 * Proves the trigger fires per profile, isolates a per-profile forecast failure
 * without aborting the run, records it on {@code tbl_ingestion_job_log}, and
 * skips profiles that ingested nothing.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@TestPropertySource(properties = "ceview.ingestion.enabled=true")
class MarketDataIngestionJobTest {

    @Autowired MarketDataIngestionJob job;
    @Autowired BusinessProfileRepository profileRepo;
    @Autowired IngestionJobLogRepository jobLogRepo;

    @MockBean MarketDataIngestionService ingestionService;
    @MockBean ForecastingService forecastingService;

    private UUID p1;
    private UUID p2;
    private UUID p3;

    @BeforeEach
    void setUp() {
        jobLogRepo.deleteAll();
        profileRepo.deleteAll();
        p1 = seedProfile("Alpha Dive");
        p2 = seedProfile("Bravo Tours");
        p3 = seedProfile("Charlie Cafe");
        // Default: every profile ingests some rows.
        when(ingestionService.ingestForProfile(any())).thenReturn(3);
    }

    private UUID seedProfile(String name) {
        UUID id = UUID.randomUUID();
        BusinessProfile p = new BusinessProfile();
        p.setBusinessProfileId(id);
        p.setBusinessName(name);
        p.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(p);
        return id;
    }

    private IngestionJobLog latestLog() {
        return jobLogRepo.findTopByJobNameOrderByStartedAtDesc("MARKET_DATA_AGGREGATION").orElseThrow();
    }

    @Test
    void forecastsEveryProfileThatIngestedData() {
        job.runDailyIngestion();

        verify(forecastingService).forecastForProfile(p1, false);
        verify(forecastingService).forecastForProfile(p2, false);
        verify(forecastingService).forecastForProfile(p3, false);
    }

    @Test
    void oneProfileFailingForecastDoesNotBlockTheRest() {
        when(forecastingService.forecastForProfile(eq(p2), anyBoolean()))
                .thenThrow(new RuntimeException("forecaster down"));

        job.runDailyIngestion();

        // All three were still attempted despite p2 blowing up.
        verify(forecastingService).forecastForProfile(p1, false);
        verify(forecastingService).forecastForProfile(p2, false);
        verify(forecastingService).forecastForProfile(p3, false);

        IngestionJobLog log = latestLog();
        // Records were ingested, so the run as a whole COMPLETED — a single
        // forecast failure is isolated, not fatal.
        assertThat(log.getStatus()).isEqualTo("COMPLETED");
        assertThat(log.getErrorMessage())
                .contains("forecast profile=" + p2)
                .contains("forecaster down");
    }

    @Test
    void doesNotForecastAProfileThatIngestedNothing() {
        when(ingestionService.ingestForProfile(
                argThat(p -> p != null && p3.equals(p.getBusinessProfileId()))))
                .thenReturn(0);

        job.runDailyIngestion();

        verify(forecastingService).forecastForProfile(p1, false);
        verify(forecastingService).forecastForProfile(p2, false);
        verify(forecastingService, never()).forecastForProfile(eq(p3), anyBoolean());
    }
}
