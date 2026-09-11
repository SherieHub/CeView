package com.ceview.module2.submodule21;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.submodule22.ForecastingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Module 2 E2E, Step 16 (C-07, C-08, C-09).
 *
 * MarketDataIngestionJob used to stop at ingestion — no forecast pipeline ran
 * afterward, so a brand-new operator's alerts stayed empty until they pressed
 * Refresh even though ingestion had already run. These tests prove the new
 * post-ingestion trigger: every profile that ingestion actually produced new
 * data for gets forecastForProfile called, one profile's forecast failing
 * never blocks or fails the others (bounded-concurrency isolation), a
 * profile ingestion skipped entirely is never forecast, and the outcome is
 * logged to tbl_ingestion_job_log.
 *
 * MarketDataIngestionService and ForecastingService are both mocked: this
 * test is about the JOB's own orchestration (which profiles get forecast,
 * isolation, logging), not either service's internals — those are already
 * covered by MarketDataIngestionService/ForecastingService's own test suites.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
class MarketDataIngestionJobForecastTriggerTest {

    @Autowired MarketDataIngestionJob job;
    @Autowired BusinessProfileRepository profileRepo;
    @Autowired IngestionJobLogRepository jobLogRepo;

    @MockBean MarketDataIngestionService ingestionService;
    @MockBean ForecastingService forecastingService;

    private UUID goodProfileA;
    private UUID goodProfileB;
    private UUID failingProfile;
    private UUID skippedProfile;

    @BeforeEach
    void setUp() {
        jobLogRepo.deleteAll();
        profileRepo.deleteAll();

        goodProfileA   = seedProfile("Ingestion Trigger A");
        goodProfileB   = seedProfile("Ingestion Trigger B");
        failingProfile = seedProfile("Ingestion Trigger Failing");
        skippedProfile = seedProfile("Ingestion Trigger Skipped");

        // 0 pairs ingested for skippedProfile (e.g. every pytrends fetch failed
        // this run) — the job must never bother forecasting it.
        when(ingestionService.ingestForProfile(any())).thenAnswer(inv -> {
            BusinessProfile p = inv.getArgument(0);
            return skippedProfile.equals(p.getBusinessProfileId()) ? 0 : 3;
        });

        // One profile's forecast trigger throws — bounded-concurrency isolation
        // must still let the other two succeed. Unstubbed calls (goodProfileA/B)
        // return Mockito's default null MarketsResponse, i.e. "succeeded".
        doThrow(new RuntimeException("Gemini quota exceeded"))
                .when(forecastingService).forecastForProfile(eq(failingProfile), eq(false));
    }

    private UUID seedProfile(String name) {
        UUID id = UUID.randomUUID();
        BusinessProfile profile = new BusinessProfile();
        profile.setBusinessProfileId(id);
        profile.setBusinessName(name);
        profile.setCategoriesList(List.of("Coastal & Island"));
        profileRepo.save(profile);
        return id;
    }

    @Test
    void everyIngestedProfileIsForecastAndOneFailureDoesNotBlockTheOthers() {
        job.runDailyIngestion();

        verify(forecastingService).forecastForProfile(goodProfileA, false);
        verify(forecastingService).forecastForProfile(goodProfileB, false);
        verify(forecastingService).forecastForProfile(failingProfile, false);
        // 0 pairs ingested -> never handed to the forecast phase at all.
        verify(forecastingService, never()).forecastForProfile(eq(skippedProfile), anyBoolean());
    }

    @Test
    void theOutcomeIsLoggedToIngestionJobLog() {
        job.runDailyIngestion();

        IngestionJobLog log = jobLogRepo.findTopByJobNameOrderByStartedAtDesc("MARKET_DATA_AGGREGATION")
                .orElseThrow(() -> new AssertionError("expected a job log row"));

        assertThat(log.getForecastsTriggered()).isEqualTo(2);   // goodProfileA + goodProfileB
        assertThat(log.getForecastFailures()).isEqualTo(1);     // failingProfile
        // Records WERE ingested this run (3 pairs x 3 profiles), so a single
        // forecast failure must not flip the whole run to FAILED.
        assertThat(log.getStatus()).isEqualTo("COMPLETED");
        assertThat(log.getErrorMessage()).contains("1 profile(s) failed the post-ingestion forecast trigger");
    }
}
