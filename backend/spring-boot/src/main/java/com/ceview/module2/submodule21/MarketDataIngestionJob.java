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
import java.util.List;

/**
 * Daily market data aggregation job (FR2.1).
 * Fires at 00:00 UTC every day when ceview.ingestion.enabled=true.
 * Each profile's failure is caught individually — one bad profile
 * does not abort the entire job run.
 */
@Component
public class MarketDataIngestionJob {

    private static final Logger log = LoggerFactory.getLogger(MarketDataIngestionJob.class);
    private static final String JOB_NAME = "MARKET_DATA_AGGREGATION";

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
        this.ingestionService   = ingestionService;
        this.forecastingService = forecastingService;
        this.profileRepo        = profileRepo;
        this.jobLogRepo         = jobLogRepo;
        this.ingestionEnabled   = ingestionEnabled;
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

        List<BusinessProfile> profiles = profileRepo.findAll();
        int marketsProcessed = 0;
        int recordsIngested  = 0;
        int forecastsRun     = 0;
        int forecastsFailed  = 0;
        StringBuilder errors = new StringBuilder();

        for (BusinessProfile profile : profiles) {
            int ingested = 0;
            try {
                ingested = ingestionService.ingestForProfile(profile);
                recordsIngested  += ingested;
                marketsProcessed += 3; // always attempts all 3 markets
            } catch (Exception e) {
                String msg = "ingest profile=" + profile.getBusinessProfileId() + ": " + e.getMessage();
                errors.append(msg).append("; ");
                log.warn("Ingestion error — {}", msg);
            }

            // C-08: forecast this profile right after its ingestion so a new
            // operator sees alerts without pressing Refresh. Sequential by
            // design (bound = 1): the pipeline's Groq batch call is globally
            // ~1 RPM, so parallel forecast runs would only contend on that
            // limit. Per-profile failure is isolated — a down forecaster for
            // one operator must not stop the rest, and is recorded on the job
            // log, not thrown. refresh=false: ingestion already ran this pass.
            if (ingested > 0) {
                try {
                    forecastingService.forecastForProfile(profile.getBusinessProfileId(), false);
                    forecastsRun++;
                } catch (Exception e) {
                    forecastsFailed++;
                    String msg = "forecast profile=" + profile.getBusinessProfileId() + ": " + e.getMessage();
                    errors.append(msg).append("; ");
                    log.warn("Post-ingestion forecast failed — {}", msg);
                }
            }
        }

        boolean failed = errors.length() > 0 && recordsIngested == 0;
        jobLog.setStatus(failed ? "FAILED" : "COMPLETED");
        jobLog.setMarketsProcessed(marketsProcessed);
        jobLog.setRecordsIngested(recordsIngested);
        jobLog.setCompletedAt(OffsetDateTime.now());
        if (errors.length() > 0) {
            jobLog.setErrorMessage(errors.toString());
        }
        jobLogRepo.save(jobLog);

        String code = failed
                ? Module2ErrorCodes.MOD21_INGESTION_JOB_FAILED
                : Module2ErrorCodes.MOD21_INGESTION_JOB_COMPLETED;
        MDC.put("code", code);
        log.info("Market data ingestion job {} — profiles={} markets={} records={} forecastsRun={} forecastsFailed={}",
                jobLog.getStatus(), profiles.size(), marketsProcessed, recordsIngested, forecastsRun, forecastsFailed);
        MDC.remove("code");
    }
}
