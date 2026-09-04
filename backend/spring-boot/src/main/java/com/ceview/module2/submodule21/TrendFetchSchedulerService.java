package com.ceview.module2.submodule21;

import com.ceview.common.TraceIdFilter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Objects;
import java.time.OffsetDateTime;
import java.time.temporal.IsoFields;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Decoupled Google Trends orchestration service — Module 2.1 (FR2.2).
 *
 * <h3>Scheduling</h3>
 * Fires every Sunday at 00:00 UTC.  Google Trends weekly data updates on
 * Sunday/Monday; aligning the fetch to Sunday ensures the newest week's
 * data is always captured.
 *
 * <h3>Decoupled design (one request per category/market pair)</h3>
 * The scheduler sends 21 individual, isolated {@code POST /api/trends/fetch}
 * requests sequentially — one per (category × market) combination.  This is
 * intentional and matches the FastAPI endpoint design:
 * <ul>
 *   <li>A single HTTP 429 from Google Trends does not fail all 21 combinations.</li>
 *   <li>The built-in 4–12 s jitter sleep on the FastAPI side prevents rate-limiting;
 *       each request may take up to 15 s — this is expected, not a timeout.</li>
 *   <li>DB state tracking ensures a failed run resumes from the first PENDING or
 *       FAILED row without re-fetching rows that already succeeded.</li>
 * </ul>
 *
 * <h3>State tracking (resume-on-failure)</h3>
 * <pre>
 *   1. computeWeekOf()  — ISO year-week string for the current run ("YYYY-Www")
 *   2. upsertPendingJobs() — create PENDING rows for any (category, market) pair
 *      that does not yet have a record for this week_of
 *   3. findRetryableJobs() — PENDING + FAILED rows where attempt_count < max_attempts
 *   4. For each job: mark IN_PROGRESS → POST FastAPI → mark SUCCESS or FAILED
 *   5. Next run: step 3 picks up only rows that still need processing
 * </pre>
 */
@Service
public class TrendFetchSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(TrendFetchSchedulerService.class);

    /** Exactly 7 × 3 = 21 (category, market) combinations per weekly run. */
    private static final List<String> CATEGORIES = List.of(
        "Coastal & Island",
        "Adventure & Nature",
        "Cultural & Heritage",
        "Theme Parks / Entertainment",
        "Urban & City",
        "Culinary & Gastronomy",
        "Accommodation & Staycation"
    );

    private static final List<String> MARKETS = List.of("korea", "japan", "usa");

    /** FastAPI jitter adds 4–12 s per request; allow 30 s total per HTTP call. */
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final TrendFetchJobRepository jobRepo;
    private final WebClient               transformerClient;

    public TrendFetchSchedulerService(
            TrendFetchJobRepository jobRepo,
            @Qualifier("fastapiTransformerClient") WebClient transformerClient) {
        this.jobRepo           = jobRepo;
        this.transformerClient = transformerClient;
    }

    // ─── Weekly cron trigger ──────────────────────────────────────────────────

    /**
     * Main entry point — fires every Sunday at 00:00 UTC.
     *
     * <p>Steps:
     * <ol>
     *   <li>Compute ISO week string for today's run.</li>
     *   <li>Upsert PENDING rows for any combination not yet recorded this week.</li>
     *   <li>Fetch retryable rows (PENDING + FAILED, attempt_count &lt; max_attempts).</li>
     *   <li>Process each row sequentially with individual WebClient POSTs.</li>
     *   <li>Log a completion summary.</li>
     * </ol>
     */
    @Scheduled(cron = "0 0 0 * * SUN", zone = "UTC")
    public void runWeeklyTrendFetch() {
        String weekOf = computeWeekOf();
        MDC.put("weekOf", weekOf);
        log.info("TrendFetchScheduler started — weekOf={}", weekOf);

        try {
            // ── Step 1: Seed PENDING rows for any missing (category, market) combos ──
            int seeded = upsertPendingJobs(weekOf);
            log.info("Seeded {} new PENDING jobs for weekOf={}", seeded, weekOf);

            // ── Step 2: Load retryable jobs (PENDING + FAILED, not exhausted) ────────
            List<TrendFetchJob> jobs = jobRepo.findRetryableJobs(weekOf);
            log.info("Found {} retryable jobs for weekOf={}", jobs.size(), weekOf);

            if (jobs.isEmpty()) {
                log.info("All jobs for weekOf={} are complete — nothing to do.", weekOf);
                return;
            }

            // ── Step 3: Process each job sequentially ─────────────────────────────────
            int success = 0;
            int failed  = 0;

            for (TrendFetchJob job : jobs) {
                boolean ok = processJob(job);
                if (ok) success++; else failed++;
            }

            // ── Step 4: Completion summary ────────────────────────────────────────────
            log.info(
                "TrendFetchScheduler run complete — weekOf={} success={} failed={} total={}",
                weekOf, success, failed, jobs.size()
            );

        } finally {
            MDC.remove("weekOf");
        }
    }

    // ─── Job processing ───────────────────────────────────────────────────────

    /**
     * Process a single TrendFetchJob: mark IN_PROGRESS → POST FastAPI → update status.
     *
     * @return true if the job succeeded; false if it failed
     */
    private boolean processJob(TrendFetchJob job) {
        // ── Mark as IN_PROGRESS ───────────────────────────────────────────────
        job.setStatus(TrendFetchJob.STATUS_IN_PROGRESS);
        job.setAttemptCount(job.getAttemptCount() + 1);
        job.setLastAttemptedAt(OffsetDateTime.now());
        jobRepo.save(job);

        log.debug(
            "Processing job category='{}' market='{}' attempt={}/{}",
            job.getCategory(), job.getMarket(), job.getAttemptCount(), job.getMaxAttempts()
        );

        try {
            // ── POST to FastAPI /api/trends/fetch ──────────────────────────
            // Use HashMap (not Map.of) so the JDT null checker recognises it
            // as definitively @NonNull, satisfying bodyValue(@NonNull Object).
            HashMap<String, Object> payload = new HashMap<>(2);
            payload.put("market",   job.getMarket());
            payload.put("category", job.getCategory());

            String traceId = MDC.get(TraceIdFilter.MDC_KEY);
            Map<String, Object> result = transformerClient.post()
                .uri("/api/trends/fetch")
                .headers(h -> { if (traceId != null) h.set(TraceIdFilter.HEADER, traceId); })
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(Objects.requireNonNull(MAP_TYPE))   // asserts non-null for JDT
                .block(REQUEST_TIMEOUT);

            if (result == null) {
                throw new IllegalStateException("FastAPI returned null response body");
            }

            // ── Mark SUCCESS and store result snapshot ────────────────────────
            applyResult(job, result);

            if (!isTrustworthy(result)) {
                markFailed(job, "untrusted source: " + result.get("source"));
                log.warn("Trend fetch for category={} market={} returned an untrusted source ({}); "
                         + "no signal record written", job.getCategory(), job.getMarket(),
                         result.get("source"));
                return false;
            }

            job.setStatus(TrendFetchJob.STATUS_SUCCESS);
            job.setCompletedAt(OffsetDateTime.now());
            job.setLastError(null);
            jobRepo.save(job);

            log.info(
                "Job SUCCESS — category='{}' market='{}' trend_index={} source={}",
                job.getCategory(), job.getMarket(),
                result.getOrDefault("trend_index", "?"),
                result.getOrDefault("source", "?")
            );
            return true;

        } catch (WebClientResponseException e) {
            String errMsg = String.format("HTTP %d from FastAPI: %s",
                e.getStatusCode().value(), e.getResponseBodyAsString());
            markFailed(job, errMsg);
            log.warn("Job FAILED (HTTP error) — category='{}' market='{}' error={}",
                job.getCategory(), job.getMarket(), errMsg);
            return false;

        } catch (Exception e) {
            String errMsg = e.getClass().getSimpleName() + ": " + e.getMessage();
            markFailed(job, errMsg);
            log.warn("Job FAILED — category='{}' market='{}' attempt={}/{} error={}",
                job.getCategory(), job.getMarket(),
                job.getAttemptCount(), job.getMaxAttempts(), errMsg);
            return false;
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Ensure every (category, market) combination has a PENDING row for {@code weekOf}.
     * Existing rows (any status) are left unchanged — idempotent.
     *
     * @return count of newly created rows
     */
    private int upsertPendingJobs(String weekOf) {
        int created = 0;
        for (String category : CATEGORIES) {
            for (String market : MARKETS) {
                Optional<TrendFetchJob> existing =
                    jobRepo.findByWeekOfAndCategoryAndMarket(weekOf, category, market);
                if (existing.isEmpty()) {
                    TrendFetchJob job = new TrendFetchJob();
                    job.setCategory(category);
                    job.setMarket(market);
                    job.setWeekOf(weekOf);
                    job.setStatus(TrendFetchJob.STATUS_PENDING);
                    jobRepo.save(job);
                    created++;
                }
            }
        }
        return created;
    }

    /**
     * Only a genuinely-measured fetch may become a signal record.
     *
     * <p>Task 11 deletes the synthetic path in fastapi-transformer, so
     * {@code source = "stub"} should no longer be producible. This guard stays
     * anyway: it is one line, and it means a regression in the Python service
     * cannot silently repopulate the database with fabricated trend indices.
     */
    public static boolean isTrustworthy(Map<String, Object> result) {
        return "pytrends".equals(result == null ? null : result.get("source"));
    }

    /** Apply FastAPI response fields to the job entity result columns. */
    private void applyResult(TrendFetchJob job, Map<String, Object> result) {
        job.setTrendIndex(     num(result, "trend_index"));
        job.setRolling7dAvg(   num(result, "rolling_7d_avg"));
        job.setRolling30dAvg(  num(result, "rolling_30d_avg"));
        job.setRolling7dStd(   num(result, "rolling_7d_std"));
        job.setYoyRatio(       num(result, "yoy_ratio"));
        job.setSeasonalityScore(num(result, "seasonality_score"));
        job.setDataPoints(     intVal(result, "data_points"));
        job.setSource(         strVal(result, "source"));

        Object spikeObj = result.get("spike_indicator");
        if (spikeObj instanceof Boolean)  job.setSpikeIndicator((Boolean) spikeObj);
        else if (spikeObj != null)        job.setSpikeIndicator(Boolean.parseBoolean(spikeObj.toString()));
    }

    /** Mark a job as FAILED and persist the error message. */
    private void markFailed(TrendFetchJob job, String error) {
        job.setStatus(TrendFetchJob.STATUS_FAILED);
        job.setLastError(error);
        jobRepo.save(job);
    }

    /**
     * Compute the ISO week string for today's date: "YYYY-Www", e.g. "2026-W21".
     * Uses ISO week numbering (Monday = start of week; week 1 = first week with Thursday).
     */
    private String computeWeekOf() {
        LocalDate today = LocalDate.now();
        int year = today.get(IsoFields.WEEK_BASED_YEAR);
        int week = today.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
        return String.format("%d-W%02d", year, week);
    }

    private Double num(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return (v instanceof Number) ? ((Number) v).doubleValue() : null;
    }

    private Integer intVal(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return (v instanceof Number) ? ((Number) v).intValue() : null;
    }

    private String strVal(Map<String, Object> map, String key) {
        Object v = map.get(key);
        return (v != null) ? v.toString() : null;
    }
}
