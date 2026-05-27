package com.ceview.module2.submodule21;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Dev/test endpoint to manually trigger the nightly ingestion job
 * without waiting for the 00:00 UTC cron schedule.
 */
@RestController
@RequestMapping("/api/v1/admin/ingestion")
public class IngestionTriggerController {

    private final MarketDataIngestionJob ingestionJob;

    public IngestionTriggerController(MarketDataIngestionJob ingestionJob) {
        this.ingestionJob = ingestionJob;
    }

    @PostMapping("/trigger")
    public Map<String, Object> trigger() {
        ingestionJob.runDailyIngestion();
        return Map.of(
                "status", "triggered",
                "triggeredAt", OffsetDateTime.now().toString()
        );
    }
}
