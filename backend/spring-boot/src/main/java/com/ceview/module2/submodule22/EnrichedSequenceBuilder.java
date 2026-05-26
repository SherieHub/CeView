package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Reads persisted signal records and constructs the multivariate input
 * sequences sent to FastAPI for BiLSTM+Transformer inference (FR2.10).
 */
@Service
public class EnrichedSequenceBuilder {

    private static final int MIN_RECORDS = 4;

    // ISO week numbers for known holiday periods per market
    // Used to populate the holidayFlag feature in the sequence
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
     * Build the multivariate sequence payload for a (profileId, market) pair.
     *
     * @throws IllegalStateException if fewer than MIN_RECORDS signal records exist
     */
    public Map<String, Object> buildSequence(UUID profileId, String market) {
        List<MarketSignalRecord> records = signalRepo
                .findByBusinessProfileIdAndTargetMarketOrderByAggregatedAtDesc(profileId, market);

        if (records.size() < MIN_RECORDS) {
            throw new IllegalStateException("enriched_dataset_empty");
        }

        // Reverse to chronological order for the model
        List<MarketSignalRecord> chronological = new ArrayList<>(records);
        Collections.reverse(chronological);

        Set<Integer> holidays = HOLIDAY_WEEKS.getOrDefault(market, Set.of());

        List<Map<String, Object>> sequences = chronological.stream()
                .map(r -> buildFeatureMap(r, holidays))
                .collect(Collectors.toList());

        return Map.of(
                "profileId",      profileId.toString(),
                "market",         market,
                "sequences",      sequences,
                "sequenceLength", sequences.size()
        );
    }

    private Map<String, Object> buildFeatureMap(MarketSignalRecord r, Set<Integer> holidays) {
        // Determine ISO week number for holiday flag
        int isoWeek = r.getAggregatedAt() != null
                ? r.getAggregatedAt().toLocalDate().getDayOfYear() / 7 + 1
                : 0;

        Map<String, Object> feature = new LinkedHashMap<>();
        feature.put("week",             r.getAggregatedAt() != null ? r.getAggregatedAt().toString() : "");
        feature.put("trendIndex",       orDefault(r.getTrendIndex(), 50.0));
        feature.put("forexRate",        orDefault(r.getForexRate(), 1.0));
        feature.put("gdpGrowth",        orDefault(r.getGdpGrowth(), 2.0));
        feature.put("seasonalityScore", orDefault(r.getSeasonalityScore(), 0.5));
        feature.put("spikeIndicator",   Boolean.TRUE.equals(r.getSpikeIndicator()));
        feature.put("holidayFlag",      holidays.contains(isoWeek));
        return feature;
    }

    private double orDefault(Double value, double def) {
        return value != null ? value : def;
    }
}
