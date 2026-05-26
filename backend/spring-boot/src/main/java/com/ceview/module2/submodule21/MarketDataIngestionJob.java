package com.ceview.module2.submodule21;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module2.Module2ErrorCodes;
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
    private final BusinessProfileRepository profileRepo;
    private final IngestionJobLogRepository jobLogRepo;
    private final boolean ingestionEnabled;

    public MarketDataIngestionJob(MarketDataIngestionService ingestionService,
                                  BusinessProfileRepository profileRepo,
                                  IngestionJobLogRepository jobLogRepo,
                                  @Value("${ceview.ingestion.enabled:true}") boolean ingestionEnabled) {
        this.ingestionService = ingestionService;
        this.profileRepo      = profileRepo;
        this.jobLogRepo       = jobLogRepo;
        this.ingestionEnabled = ingestionEnabled;
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
        StringBuilder errors = new StringBuilder();

        for (BusinessProfile profile : profiles) {
            try {
                int ingested = ingestionService.ingestForProfile(profile);
                recordsIngested  += ingested;
                marketsProcessed += 3; // always attempts all 3 markets
            } catch (Exception e) {
                String msg = "profile=" + profile.getBusinessProfileId() + ": " + e.getMessage();
                errors.append(msg).append("; ");
                log.warn("Ingestion error — {}", msg);
            }
        }

        boolean failed = errors.length() > 0 && recordsIngested == 0;
        jobLog.setStatus(failed ? "FAILED" : "COMPLETED");
        jobLog.setMarketsProcessed(marketsProcessed);
        jobLog.setRecordsIngested(recordsIngested);
        jobLog.setCompletedAt(OffsetDateTime.now());
        if (errors.length() > 0) jobLog.setErrorMessage(errors.toString());
        jobLogRepo.save(jobLog);

        String code = failed
                ? Module2ErrorCodes.MOD21_INGESTION_JOB_FAILED
                : Module2ErrorCodes.MOD21_INGESTION_JOB_COMPLETED;
        MDC.put("code", code);
        log.info("Market data ingestion job {} — profiles={} markets={} records={}",
                jobLog.getStatus(), profiles.size(), marketsProcessed, recordsIngested);
        MDC.remove("code");
    }
}
