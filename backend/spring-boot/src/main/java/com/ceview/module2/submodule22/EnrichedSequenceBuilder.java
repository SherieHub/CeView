package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds the Gemini forecast context payload for a (profileId, market) pair
 * (FR2.10 — Phase 2 pivot from BiLSTM feature vectors to Gemini prompt context).
 *
 * The payload shape mirrors {@code GeminiForecastRequest} in the FastAPI router:
 *   trendSeries    — full chronological list of weekly trend indices (0–100)
 *   rolling7dAvg   — 7-period rolling mean from the latest signal record
 *   rolling30dAvg  — 30-period rolling mean (≈ 30-day MA)
 *   rollingStd7d   — 7-period rolling std-dev (for 2σ spike context)
 *   spikeIndicator — boolean breakout flag (current > μ + 2σ)
 *   yoyRatio       — Year-over-Year ratio (null when history < 59 weeks)
 *   seasonalityScore — composite 0–1 score from SeasonalShiftDetector
 *   forexRate      — latest 30-day rolling average forex vs PHP
 *   gdpGrowth      — latest GDP annual growth %
 *   holidayFlag    — true if the current ISO week is a known holiday period
 */
@Service
public class EnrichedSequenceBuilder {

    private static final int MIN_RECORDS = 4;

    /**
     * How old the newest real signal may be before the UI calls it stale.
     * Matches the trend-fetch scheduler's weekly-with-daily-retry cadence with
     * room for one missed run. Defined once, here, so it is not re-derived.
     */
    public static final java.time.Duration STALE_AFTER = java.time.Duration.ofHours(48);

    /** ISO week numbers for known high-demand holiday periods per market. */
    private static final Map<String, Set<Integer>> HOLIDAY_WEEKS = Map.of(
            "korea", Set.of(1, 2, 22, 23, 37, 38, 52),   // Lunar New Year, Chuseok
            "japan", Set.of(1, 18, 19, 20, 31, 32, 52),   // Golden Week, Obon
            "usa",   Set.of(47, 48, 51, 52, 1)             // Thanksgiving, Christmas
    );

    private final MarketSignalRecordRepository signalRepo;

    public EnrichedSequenceBuilder(MarketSignalRecordRepository signalRepo) {
        this.signalRepo = signalRepo;
    }

    /**
     * Build the Gemini forecast context payload.
     *
     * @throws IllegalStateException("enriched_dataset_empty") when fewer than
     *         MIN_RECORDS signal records exist — propagates as a 500 error to the caller.
     * @deprecated category-agnostic — kept only so nothing outside this task's
     *         scope breaks; prefer {@link #buildSequence(UUID, String, String)}.
     */
    @Deprecated
    public Map<String, Object> buildSequence(UUID profileId, String market) {
        return buildSequence(profileId, market, null);
    }

    /**
     * Build the Gemini forecast context payload, scoped to a single category
     * (Task 1a.2b). Ingestion now writes one {@link MarketSignalRecord} per
     * (category, market) pair, so blending them here would silently mix
     * unrelated trend series into one prompt. {@code category} is the
     * business profile's chosen "primary" category for this market's demand
     * forecast — see {@code ForecastingService} for how that is selected.
     *
     * <p>Pre-V20 fallback: when the category-scoped read returns nothing
     * (either the category hasn't been ingested yet, or the rows predate the
     * V20 migration and have {@code category = null}), falls back to the
     * category-agnostic finder rather than throwing — a profile with older
     * data should not suddenly see an empty forecast.
     */
    public Map<String, Object> buildSequence(UUID profileId, String market, String category) {
        // DESC order: most-recent first. Real (source='pytrends') rows only —
        // stub is purged by V23 and 'unknown' is untrusted by policy.
        List<MarketSignalRecord> records =
                signalRepo.findRealByProfileAndMarket(profileId, market, category);
        if (records.isEmpty() && category != null) {
            // Category not yet ingested — fall back to the market's other real
            // records rather than to nothing. Still real-only.
            records = signalRepo.findRealByProfileAndMarket(profileId, market, null);
        }

        if (records.size() < MIN_RECORDS) {
            throw new IllegalStateException("enriched_dataset_empty");
        }

        // Reverse to chronological order for the trend series
        List<MarketSignalRecord> chronological = new ArrayList<>(records);
        Collections.reverse(chronological);

        // Full chronological trend-index series for the Gemini prompt —
        // unmeasured records are dropped, never defaulted to a midpoint.
        List<Double> trendSeries = trendSeriesOf(chronological);

        // Use the latest record for pre-computed rolling stats
        MarketSignalRecord latest = records.get(0);

        // Holiday flag: is the current ISO week a known high-demand period?
        int isoWeek = latest.getAggregatedAt() != null
                ? latest.getAggregatedAt().toLocalDate().getDayOfYear() / 7 + 1
                : 0;
        boolean holidayFlag = HOLIDAY_WEEKS.getOrDefault(market, Set.of()).contains(isoWeek);

        // Use LinkedHashMap so null yoyRatio is accepted (Map.of() rejects nulls)
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("profileId",       profileId.toString());
        payload.put("market",          market);
        payload.put("category",        category);   // extra context; ignored by FastAPI if unused
        payload.put("trendSeries",     trendSeries);
        // Prefer the explicit 7d column; fall back to legacy rollingAverage
        // Measured fields pass through raw: an absent measurement must reach the
        // forecaster as null, not as an invented number it cannot tell apart
        // from a real reading. gemini_forecaster raises on an unusable payload.
        payload.put("rolling7dAvg",     latest.getRollingAverage7d());
        payload.put("rolling30dAvg",    latest.getRollingAverage30d());
        payload.put("rollingStd7d",     latest.getRollingStdDev());
        payload.put("spikeIndicator",   Boolean.TRUE.equals(latest.getSpikeIndicator()));
        payload.put("yoyRatio",         latest.getYoyRatio());   // may be null — Map.of() forbidden
        payload.put("seasonalityScore", latest.getSeasonalityScore());
        payload.put("forexRate",        latest.getForexRate());
        payload.put("gdpGrowth",        latest.getGdpGrowth());
        payload.put("dataAsOf", latest.getAggregatedAt() == null
                ? null : latest.getAggregatedAt().toString());
        payload.put("dataStale", isStale(latest.getAggregatedAt(), java.time.OffsetDateTime.now()));
        payload.put("holidayFlag",      holidayFlag);
        return payload;
    }

    /**
     * Trend indices, chronological, with unmeasured records dropped.
     *
     * <p>This used to substitute {@code 50.0} for a null index — a fabricated
     * midpoint the forecaster could not distinguish from a real measurement.
     * Omitting the point is honest; the series is shorter and MIN_RECORDS still
     * guards the floor.
     */
    public static List<Double> trendSeriesOf(List<MarketSignalRecord> chronological) {
        return chronological.stream()
                .map(MarketSignalRecord::getTrendIndex)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    /** True when the newest real signal is older than {@link #STALE_AFTER}. */
    public static boolean isStale(java.time.OffsetDateTime newest, java.time.OffsetDateTime now) {
        if (newest == null) return true;
        return java.time.Duration.between(newest, now).compareTo(STALE_AFTER) > 0;
    }
}
