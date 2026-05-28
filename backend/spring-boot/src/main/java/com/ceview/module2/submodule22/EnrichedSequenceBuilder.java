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
<<<<<<< HEAD
     *         MIN_RECORDS signal records exist — propagates as a 500 error to the caller.
=======
     *         MIN_RECORDS signal records exist — triggers the legacy stub fallback.
>>>>>>> paldo
     */
    public Map<String, Object> buildSequence(UUID profileId, String market) {
        // DESC order: most-recent first
        List<MarketSignalRecord> records = signalRepo
                .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);

        if (records.size() < MIN_RECORDS) {
            throw new IllegalStateException("enriched_dataset_empty");
        }

        // Reverse to chronological order for the trend series
        List<MarketSignalRecord> chronological = new ArrayList<>(records);
        Collections.reverse(chronological);

        // Full chronological trend-index series for the Gemini prompt
        List<Double> trendSeries = chronological.stream()
                .map(r -> orDefault(r.getTrendIndex(), 50.0))
                .collect(Collectors.toList());

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
        payload.put("trendSeries",     trendSeries);
        // Prefer the explicit 7d column; fall back to legacy rollingAverage
        payload.put("rolling7dAvg",    orDefault(
                latest.getRollingAverage7d(),
                orDefault(latest.getRollingAverage(), 50.0)));
        payload.put("rolling30dAvg",   orDefault(
                latest.getRollingAverage30d(),
                orDefault(latest.getRollingAverage(), 50.0)));
        payload.put("rollingStd7d",    orDefault(latest.getRollingStdDev(), 0.0));
        payload.put("spikeIndicator",  Boolean.TRUE.equals(latest.getSpikeIndicator()));
        payload.put("yoyRatio",        latest.getYoyRatio());   // may be null — Map.of() forbidden
        payload.put("seasonalityScore", orDefault(latest.getSeasonalityScore(), 0.5));
        payload.put("forexRate",       orDefault(latest.getForexRate(), 1.0));
        payload.put("gdpGrowth",       orDefault(latest.getGdpGrowth(), 2.0));
        payload.put("holidayFlag",     holidayFlag);
        return payload;
    }

    private double orDefault(Double value, double def) {
        return value != null ? value : def;
    }
}
