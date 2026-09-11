package com.ceview.module2.submodule22;

import com.ceview.module2.submodule21.MarketEconomicTrend;
import com.ceview.module2.submodule21.MarketEconomicTrendRepository;
import com.ceview.module2.submodule21.MarketSignalRecord;
import com.ceview.module2.submodule21.MarketSignalRecordRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds the per-week feature matrix payload for a (profileId, market) pair
 * (Step 7, docs/module-2/MODULE_2_E2E_CONTRACT.md §3; C-02, H-31, T-09, T-10).
 *
 * <p>The payload's {@code sequence} field is exactly {@link #W} chronological
 * weekly rows (oldest first), each carrying the contract's immutable feature
 * order — {@code [trendIndex, forexRate, gdpGrowth, seasonalityScore,
 * spikeIndicator, holidayFlag]} — plus the row's own {@code isoYear}/
 * {@code isoWeek}/{@code weekStartDate} identity. A parallel {@code imputedMask}
 * contains one field-named mask per row, so a consumer can identify every
 * individual forward-filled cell rather than treating a whole row as opaque.
 *
 * <p>This replaces the previous shape (a flat {@code trendSeries} list plus a
 * handful of scalar "latest record" stats) that fed a Gemini prompt rather than
 * a fixed-width model input — FastAPI's consumption of the new shape is Step 8.
 */
@Service
public class EnrichedSequenceBuilder {

    /** Contract §3.1: every engine receives exactly 12 chronological weekly rows. */
    private static final int W = 12;
    /** Contract §3.1: fewer than 12 valid weekly rows never gets padded — it fails. */
    private static final int MIN_RECORDS = 12;

    /**
     * How old the newest real signal may be before the UI calls it stale.
     * Matches the trend-fetch scheduler's weekly-with-daily-retry cadence with
     * room for one missed run. Defined once, here, so it is not re-derived.
     */
    public static final java.time.Duration STALE_AFTER = java.time.Duration.ofHours(48);

    private final MarketSignalRecordRepository signalRepo;
    private final MarketEconomicTrendRepository economicTrendRepo;
    private final MarketHolidayCalendar holidayCalendar;
    private final ObjectMapper objectMapper;

    public EnrichedSequenceBuilder(MarketSignalRecordRepository signalRepo,
                                   MarketEconomicTrendRepository economicTrendRepo,
                                   MarketHolidayCalendar holidayCalendar,
                                   ObjectMapper objectMapper) {
        this.signalRepo = signalRepo;
        this.economicTrendRepo = economicTrendRepo;
        this.holidayCalendar = holidayCalendar;
        this.objectMapper = objectMapper;
    }

    /**
     * Build the per-week feature-matrix payload.
     *
     * @throws IllegalStateException("enriched_dataset_empty:count=N") when fewer
     *         than {@link #MIN_RECORDS} real signal records exist — N is the
     *         actual count, per the step's explicit ask; caught and converted to
     *         a structured MOD22_NO_MARKET_DATA response by ForecastingService.
     * @throws IllegalStateException("enriched_dataset_empty:field=X") when a
     *         required feature X is null on the oldest usable row AND no earlier
     *         real value exists anywhere in history to carry forward — the model
     *         input is never padded with a fabricated number instead.
     * @deprecated category-agnostic — kept only so nothing outside this task's
     *         scope breaks; prefer {@link #buildSequence(UUID, String, String)}.
     */
    @Deprecated
    public Map<String, Object> buildSequence(UUID profileId, String market) {
        return buildSequence(profileId, market, null);
    }

    /**
     * Build the per-week feature-matrix payload, scoped to a single category
     * (Task 1a.2b). Ingestion writes one {@link MarketSignalRecord} per
     * (category, market) pair, so blending them here would silently mix
     * unrelated trend series into one matrix. {@code category} is the
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
            throw new IllegalStateException("enriched_dataset_empty:count=" + records.size());
        }

        // Full chronological history (oldest first) — kept whole, not truncated
        // to W, so carry-forward imputation for the oldest matrix row can still
        // reach further back than the 12-week output window.
        List<MarketSignalRecord> chronological = new ArrayList<>(records);
        Collections.reverse(chronological);

        int fromIndex = chronological.size() - W;
        List<MarketSignalRecord> window = chronological.subList(fromIndex, chronological.size());

        // Prime carry-forward state from history strictly BEFORE the window, so
        // the window's own oldest row can still be forward-filled from real,
        // older data rather than needing a value present at that exact row.
        Double lastGoodTrend = null, lastGoodForex = null, lastGoodGdp = null;
        List<Double> trendHistory = new ArrayList<>();
        for (int i = 0; i < fromIndex; i++) {
            MarketSignalRecord r = chronological.get(i);
            if (usable(r.getTrendIndex()))       lastGoodTrend       = r.getTrendIndex();
            if (lastGoodTrend != null) trendHistory.add(lastGoodTrend);
            if (usableForex(r.getForexRate()))   lastGoodForex       = r.getForexRate();
            if (usable(r.getGdpGrowth()))         lastGoodGdp         = r.getGdpGrowth();
        }

        MacroSeries macroSeries = macroSeriesFor(market);
        List<Map<String, Object>> sequence = new ArrayList<>(W);
        List<Map<String, Boolean>> imputedMask = new ArrayList<>(W);

        for (MarketSignalRecord r : window) {
            LocalDate weekStart = weekStartOf(r);
            int isoYear = weekStart.get(WeekFields.ISO.weekBasedYear());
            int isoWeek = weekStart.get(WeekFields.ISO.weekOfWeekBasedYear());
            Map<String, Boolean> rowMask = new LinkedHashMap<>();

            Double trend = r.getTrendIndex();
            if (usable(trend)) {
                lastGoodTrend = trend;
                rowMask.put("trendIndex", false);
            } else if (lastGoodTrend != null) {
                trend = lastGoodTrend;
                rowMask.put("trendIndex", true);
            } else {
                throw new IllegalStateException("enriched_dataset_empty:field=trendIndex");
            }
            trendHistory.add(trend);

            // The dated monthly macro series is the primary source. A point is
            // joined to each week by its effective period; only a gap is carried
            // forward. The signal row is a legacy fallback when no dated series
            // is available for this historic snapshot.
            EffectiveValue forexValue = macroSeries.forexAt(weekStart);
            Double forex = usableForex(forexValue.value()) ? forexValue.value() : r.getForexRate();
            if (usableForex(forex) && usableForex(forexValue.value())) {
                lastGoodForex = forex;
                rowMask.put("forexRate", forexValue.imputed());
            } else if (usableForex(forex)) {
                lastGoodForex = forex;
                rowMask.put("forexRate", false);
            } else if (lastGoodForex != null) {
                forex = lastGoodForex;
                rowMask.put("forexRate", true);
            } else {
                throw new IllegalStateException("enriched_dataset_empty:field=forexRate");
            }

            EffectiveValue gdpValue = macroSeries.gdpAt(weekStart);
            Double gdp = usable(gdpValue.value()) ? gdpValue.value() : r.getGdpGrowth();
            if (usable(gdp) && usable(gdpValue.value())) {
                lastGoodGdp = gdp;
                rowMask.put("gdpGrowth", gdpValue.imputed());
            } else if (usable(gdp)) {
                lastGoodGdp = gdp;
                rowMask.put("gdpGrowth", false);
            } else if (lastGoodGdp != null) {
                gdp = lastGoodGdp;
                rowMask.put("gdpGrowth", true);
            } else {
                throw new IllegalStateException("enriched_dataset_empty:field=gdpGrowth");
            }

            // Recompute these two derived features from this row's chronological
            // trend prefix. Persisted values are intentionally not copied or
            // forward-filled: an earlier feature row must never depend on a
            // later week's calculation, and an unavailable detector must not
            // turn into a synthetic stale seasonality value.
            DerivedTrendFeatures derived = deriveTrendFeatures(trendHistory,
                    Boolean.TRUE.equals(rowMask.get("trendIndex")));
            double seasonality = derived.seasonalityScore();
            boolean spike = derived.spikeIndicator();
            rowMask.put("seasonalityScore", false);
            rowMask.put("spikeIndicator", false);

            boolean holidayFlag = holidayCalendar.isHoliday(market, isoYear, isoWeek);
            rowMask.put("holidayFlag", false);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("isoYear",          isoYear);
            row.put("isoWeek",          isoWeek);
            row.put("weekStartDate",    weekStart.toString());
            row.put("trendIndex",       trend);
            row.put("forexRate",        forex);
            row.put("gdpGrowth",        gdp);
            row.put("seasonalityScore", seasonality);
            row.put("spikeIndicator",   spike ? 1.0 : 0.0);
            row.put("holidayFlag",      holidayFlag ? 1.0 : 0.0);
            sequence.add(row);
            imputedMask.add(rowMask);
        }

        MarketSignalRecord latest = records.get(0);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("profileId",   profileId.toString());
        payload.put("market",      market);
        payload.put("category",    category);   // extra context; ignored by FastAPI if unused
        payload.put("sequence",    sequence);
        payload.put("imputedMask", imputedMask);
        payload.put("dataAsOf", latest.getAggregatedAt() == null
                ? null : latest.getAggregatedAt().toString());
        payload.put("dataStale", isStale(latest.getAggregatedAt(), java.time.OffsetDateTime.now()));
        return payload;
    }

    /**
     * Legacy rows may predate the ISO-week migration. Their identifiers are
     * derived from the UTC observation/write timestamp with java.time ISO rules;
     * a malformed row with neither date is rejected rather than serialised with
     * null or zero identity fields.
     */
    private static LocalDate weekStartOf(MarketSignalRecord record) {
        if (record.getWeekStartDate() != null) return record.getWeekStartDate();
        if (record.getAggregatedAt() == null) {
            throw new IllegalStateException("enriched_dataset_empty:field=weekStartDate");
        }
        LocalDate date = record.getAggregatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDate();
        return date.with(WeekFields.ISO.dayOfWeek(), 1L);
    }

    private MacroSeries macroSeriesFor(String market) {
        return economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(market)
                .map(this::parseMacroSeries)
                .orElseGet(MacroSeries::empty);
    }

    /** Parses the persisted historical series once. Malformed points are ignored;
     * the documented fallback chain then either finds an earlier valid point or
     * fails the matrix instead of inventing a macro value. */
    private MacroSeries parseMacroSeries(MarketEconomicTrend trend) {
        NavigableMap<YearMonth, Double> forex = new TreeMap<>();
        NavigableMap<Integer, Double> gdp = new TreeMap<>();
        addForexPoints(trend.getForexTrendJson(), forex);
        addGdpPoints(trend.getGdpTrendJson(), gdp);
        return new MacroSeries(forex, gdp);
    }

    private void addForexPoints(String json, NavigableMap<YearMonth, Double> points) {
        addPoints(json, node -> {
            if (!node.hasNonNull("date") || !node.hasNonNull("value")) return;
            try {
                double value = node.get("value").asDouble();
                if (Double.isFinite(value) && value > 0.0) {
                    points.put(YearMonth.parse(node.get("date").asText()), value);
                }
            } catch (RuntimeException ignored) { /* malformed historic point */ }
        });
    }

    private void addGdpPoints(String json, NavigableMap<Integer, Double> points) {
        addPoints(json, node -> {
            if (!node.hasNonNull("year") || !node.hasNonNull("value")) return;
            double value = node.get("value").asDouble();
            if (Double.isFinite(value)) points.put(node.get("year").asInt(), value);
        });
    }

    private void addPoints(String json, java.util.function.Consumer<JsonNode> consumer) {
        if (json == null || json.isBlank()) return;
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root != null && root.isArray()) root.forEach(consumer);
        } catch (Exception ignored) { /* malformed historic JSON follows fallback chain */ }
    }

    private record EffectiveValue(Double value, boolean imputed) {}

    private static boolean usable(Double value) {
        return value != null && Double.isFinite(value);
    }

    private static boolean usableForex(Double value) {
        return usable(value) && value > 0.0;
    }

    /** Java implementation of the per-prefix seasonal-shift feature derivation.
     * It deliberately mirrors the FastAPI detector's trailing 7-point mean/std,
     * 59-week YoY threshold, and conservative no-YoY score so the matrix is
     * point-in-time correct even if a persisted derived column is stale. */
    private static DerivedTrendFeatures deriveTrendFeatures(List<Double> series, boolean currentTrendImputed) {
        double rolling7 = trailingMean(series, 7);
        double std7 = trailingPopulationStd(series, 7, rolling7);
        boolean spike = !currentTrendImputed
                && series.get(series.size() - 1) > rolling7 + 2.0 * std7;
        Double yoy = null;
        if (series.size() >= 59) {
            int from = series.size() - 59;
            double priorMean = trailingMean(series.subList(from, from + 7), 7);
            if (priorMean > 0.0) yoy = rolling7 / priorMean;
        }
        double base;
        if (yoy != null) {
            base = clamp(0.82 + (yoy - 1.0), 0.0, 1.0);
        } else if (rolling7 > 0.0) {
            base = clamp(0.65 - (std7 / rolling7) * 0.50, 0.25, 0.65);
        } else {
            base = 0.40;
        }
        double score = spike && (yoy == null || yoy < 1.0) ? Math.max(0.0, base - 0.40) : base;
        return new DerivedTrendFeatures(score, spike);
    }

    private static double trailingMean(List<Double> series, int window) {
        int from = Math.max(0, series.size() - window);
        return series.subList(from, series.size()).stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    }

    private static double trailingPopulationStd(List<Double> series, int window, double mean) {
        int from = Math.max(0, series.size() - window);
        int count = series.size() - from;
        if (count < 2) return 0.0;
        double variance = series.subList(from, series.size()).stream()
                .mapToDouble(value -> Math.pow(value - mean, 2)).sum() / count;
        return Math.sqrt(variance);
    }

    private static double clamp(double value, double lower, double upper) {
        return Math.max(lower, Math.min(upper, value));
    }

    private record DerivedTrendFeatures(double seasonalityScore, boolean spikeIndicator) {}

    /**
     * A monthly forex point applies to every week in that month; if a month is
     * absent, the most recent earlier monthly point is forward-filled and marked
     * imputed. GDP follows the equivalent annual rule. Values later than the
     * target week are never used, preventing look-ahead leakage.
     */
    private record MacroSeries(NavigableMap<YearMonth, Double> forex, NavigableMap<Integer, Double> gdp) {
        static MacroSeries empty() { return new MacroSeries(new TreeMap<>(), new TreeMap<>()); }

        EffectiveValue forexAt(LocalDate weekStart) {
            Map.Entry<YearMonth, Double> point = forex.floorEntry(YearMonth.from(weekStart));
            return point == null ? new EffectiveValue(null, false)
                    : new EffectiveValue(point.getValue(), !point.getKey().equals(YearMonth.from(weekStart)));
        }

        EffectiveValue gdpAt(LocalDate weekStart) {
            Map.Entry<Integer, Double> point = gdp.floorEntry(weekStart.getYear());
            return point == null ? new EffectiveValue(null, false)
                    : new EffectiveValue(point.getValue(), point.getKey() != weekStart.getYear());
        }
    }

    /**
     * Trend indices, chronological, with unmeasured records dropped.
     *
     * <p>Retained for callers outside this task's scope; {@link #buildSequence}
     * itself no longer uses a flat trend-only series — see the per-row
     * {@code trendIndex} field in {@code sequence} instead.
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
