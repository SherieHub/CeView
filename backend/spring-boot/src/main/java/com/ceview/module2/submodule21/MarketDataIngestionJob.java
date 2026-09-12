package com.ceview.module2.submodule21;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.Module2ErrorCodes;
import com.ceview.module2.submodule22.ForecastingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Daily market data aggregation job (FR2.1).
 * Fires at 00:00 UTC every day when ceview.ingestion.enabled=true.
 * Each profile's failure is caught individually — one bad profile
 * does not abort the entire job run.
 *
 * <p>Step 16 (C-07, C-08, C-09): closes the "ingestion runs but nothing ever
 * forecasts it" gap. After a profile is successfully ingested, this job also
 * triggers that profile's forecast pipeline — real alerts exist by the time
 * an operator opens the dashboard, not only after they press Refresh. The
 * forecast phase runs with bounded concurrency (the AI calls, not the DB
 * writes, are the expensive part) and the same per-profile failure isolation
 * as the ingestion phase.
 */
@Component
public class MarketDataIngestionJob {

    private static final Logger log = LoggerFactory.getLogger(MarketDataIngestionJob.class);
    private static final String JOB_NAME = "MARKET_DATA_AGGREGATION";
    /** Forecast triggers are one Gemini/Groq batch call + XGBoost calls each —
     *  bounded so a large operator base can't open dozens of AI calls at once. */
    private static final int FORECAST_CONCURRENCY = 4;

    private final MarketDataIngestionService ingestionService;
    private final ForecastingService forecastingService;
    private final BusinessProfileRepository profileRepo;
    private final IngestionJobLogRepository jobLogRepo;
    private final boolean ingestionEnabled;

    public MarketDataIngestionJob(MarketDataIngestionService ingestionService,
                                  ForecastingService forecastingService,
                                  BusinessProfileRepository profileRepo,
                                  IngestionJobLogRepository jobLogRepo,
                                  @Value("${ceview.ingestion.enabled:true}") boolean ingestionEnabled) {
        this.ingestionService  = ingestionService;
        this.forecastingService = forecastingService;
        this.profileRepo       = profileRepo;
        this.jobLogRepo        = jobLogRepo;
        this.ingestionEnabled  = ingestionEnabled;
    }

    @Scheduled(cron = "0 0 0 * * *", zone = "UTC")
    public void runDailyIngestion() {
        if (!ingestionEnabled) {
            log.debug("Ingestion job disabled via ceview.ingestion.enabled=false — skipping");
            return;
        }

        MDC.put("code", Module2ErrorCodes.MOD21_INGESTION_JOB_STARTED);
        log.info("Market data ingestion job started");
        MDC.remove("code");

        IngestionJobLog jobLog = new IngestionJobLog();
        jobLog.setJobName(JOB_NAME);
        jobLog.setStatus("STARTED");
        jobLogRepo.save(jobLog);

        // findAllNonReference(), not findAll(): the V26 uniqueness corpus lives in
        // tbl_business_profile as is_reference rows with no operator. They must
        // never reach tenant-facing work like this daily ingestion sweep. See
        // ReferenceProfileIsolationTest.
        List<BusinessProfile> profiles = profileRepo.findAllNonReference();
        int marketsProcessed = 0;
        int recordsIngested  = 0;
        StringBuilder errors = new StringBuilder();

        // ── Phase 1: per-profile ingestion (existing, sequential) ────────────
        // Sequential is deliberate here, unlike Phase 2 below: PyTrends fetches
        // are already jittered/rate-limited per (market, category) inside
        // MarketDataIngestionService, and running many profiles' ingestion
        // concurrently would multiply real outbound Google Trends traffic.
        List<BusinessProfile> ingestedProfiles = new ArrayList<>();
        for (BusinessProfile profile : profiles) {
            try {
                int ingested = ingestionService.ingestForProfile(profile);
                recordsIngested  += ingested;
                marketsProcessed += 3; // always attempts all 3 markets
                // Only a profile that actually got new signal data this run is
                // worth forecasting immediately — one with 0 ingested pairs
                // (no categories set, or every pair failed) has nothing new for
                // the pipeline to read that ensureFreshForecast won't already
                // catch on the operator's next dashboard visit.
                if (ingested > 0) ingestedProfiles.add(profile);
            } catch (Exception e) {
                String msg = "profile=" + profile.getBusinessProfileId() + ": " + e.getMessage();
                errors.append(msg).append("; ");
                log.warn("Ingestion error — {}", msg);
            }
        }

        // ── Phase 2: post-ingestion forecast trigger (Step 16) ────────────────
        // Bounded concurrency + per-profile isolation: a profile whose forecast
        // fails (AI outage, no market data yet, etc.) must never block or fail
        // the others, and must never abort the ingestion phase already committed.
        int forecastsTriggered = 0;
        int forecastFailures   = 0;
        if (!ingestedProfiles.isEmpty()) {
            ExecutorService executor = Executors.newFixedThreadPool(
                    Math.min(FORECAST_CONCURRENCY, ingestedProfiles.size()));
            try {
                List<CompletableFuture<Boolean>> futures = new ArrayList<>(ingestedProfiles.size());
                for (BusinessProfile profile : ingestedProfiles) {
                    UUID profileId = profile.getBusinessProfileId();
                    futures.add(CompletableFuture.supplyAsync(() -> {
                        try {
                            // refresh=false: this profile was just ingested above in
                            // this same run — re-ingesting here would be redundant
                            // and would double today's PyTrends/GDP/forex calls.
                            forecastingService.forecastForProfile(profileId, false);
                            return Boolean.TRUE;
                        } catch (Exception e) {
                            log.warn("Post-ingestion forecast trigger failed — profile={}: {}",
                                    profileId, e.getMessage());
                            return Boolean.FALSE;
                        }
                    }, executor));
                }
                // .join() blocks per-future but each task's own try/catch above
                // already turned a failure into a plain Boolean.FALSE — no
                // exception ever propagates out of join() here, so one
                // profile's failure can never skip or abort the rest of this loop.
                for (CompletableFuture<Boolean> future : futures) {
                    if (Boolean.TRUE.equals(future.join())) forecastsTriggered++; else forecastFailures++;
                }
            } finally {
                executor.shutdown();
            }
        }
        if (forecastFailures > 0) {
            errors.append(forecastFailures).append(" profile(s) failed the post-ingestion forecast trigger; ");
        }

        boolean failed = errors.length() > 0 && recordsIngested == 0;
        jobLog.setStatus(failed ? "FAILED" : "COMPLETED");
        jobLog.setMarketsProcessed(marketsProcessed);
        jobLog.setRecordsIngested(recordsIngested);
        jobLog.setForecastsTriggered(forecastsTriggered);
        jobLog.setForecastFailures(forecastFailures);
        jobLog.setCompletedAt(OffsetDateTime.now());
        if (errors.length() > 0) jobLog.setErrorMessage(errors.toString());
        jobLogRepo.save(jobLog);

        String code = failed
                ? Module2ErrorCodes.MOD21_INGESTION_JOB_FAILED
                : Module2ErrorCodes.MOD21_INGESTION_JOB_COMPLETED;
        MDC.put("code", code);
        log.info("Market data ingestion job {} — profiles={} markets={} records={} forecastsTriggered={} forecastFailures={}",
                jobLog.getStatus(), profiles.size(), marketsProcessed, recordsIngested,
                forecastsTriggered, forecastFailures);
        MDC.remove("code");
    }
}
