package com.ceview.module2.submodule21;

import com.ceview.module2.MarketCatalog;
import com.ceview.module2.Module2ErrorCodes;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import com.ceview.ai.AiDependencyException;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Fetches GDP and forex data from free public APIs (FR2.3).
 * Uses its own WebClient instances — not the fastapiClient bean.
 *
 * <p>Three-tier policy for every macro input (Step 6, contract; C-06, H-18):
 * (1) live fetch; (2) the last-known-good reading persisted in
 * {@code tbl_market_economic_trend}, tagged {@code "last_known_good"} with the
 * instant it was actually taken; (3) if neither exists, throw
 * {@link AiDependencyException} (code {@code MOD21_MACRO_UNAVAILABLE}) rather
 * than fabricating a number — the static GDP_DEFAULTS/FOREX_DEFAULTS constants
 * this class used to fall back to silently have been deleted.
 */
@Service
public class ExternalMarketDataClient {

    private static final Logger log = LoggerFactory.getLogger(ExternalMarketDataClient.class);
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private static final ParameterizedTypeReference<List<Object>> LIST_TYPE =
            new ParameterizedTypeReference<>() {};

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    /**
     * fawazahmed0/currency-api — free, no API key, CDN-backed, supports PHP as base.
     * URL: https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@{date}/v1/currencies/php.min.json
     * where {date} is "latest" or "YYYY-MM-DD".
     * Response: { "date": "...", "php": { "krw": 23.5, "jpy": 2.1, "usd": 0.018, ... } }
     * Note: all currency codes in the response are lowercase.
     *
     * <p>The response is PHP-based, so it quotes FOREIGN UNITS PER 1 PHP — the inverse of
     * this codebase's canonical unit (contract §1: PHP per 1 foreign unit). Every read of
     * this response must invert through {@link #invertToCanonical(double)} before the
     * value is used anywhere else; nothing downstream of that call is allowed to see the
     * raw CDN direction.
     */
    private static final String CURRENCY_CDN_BASE   = "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@";
    private static final String CURRENCY_CDN_SUFFIX = "/v1/currencies/php.min.json";

    private static final Duration TREND_TIMEOUT = Duration.ofSeconds(30); // for 12 parallel CDN calls

    private final WebClient worldBankClient;
    private final WebClient forexClient;
    private final String    forexBaseUrl;   // stored so we can build absolute URIs that bypass WebClient path-normalisation
    private final MarketEconomicTrendRepository economicTrendRepo;
    private final ObjectMapper objectMapper;

    // Static flight reference data for the three fixed markets
    private static final Map<String, FlightReferenceDto> FLIGHT_REFS = Map.of(
            "korea", new FlightReferenceDto("korea", true,  "3h 45m", 2_640, 14,
                    List.of(Map.of("name", "Korean Air",   "code", "KE", "frequency", "7x / week"),
                            Map.of("name", "Cebu Pacific", "code", "5J", "frequency", "5x / week"),
                            Map.of("name", "Air Busan",    "code", "BX", "frequency", "2x / week"))),
            "japan", new FlightReferenceDto("japan", true,  "2h 50m", 2_186, 8,
                    List.of(Map.of("name", "Philippine Airlines", "code", "PR", "frequency", "5x / week"),
                            Map.of("name", "Cebu Pacific",        "code", "5J", "frequency", "3x / week"))),
            "usa",   new FlightReferenceDto("usa",   false, "16h+ (via MNL)", 11_027, 3,
                    List.of(Map.of("name", "Philippine Airlines", "code", "PR", "frequency", "3x / week (via MNL)")))
    );

    // Market → ISO-2 country code (World Bank). Delegates to MarketFlags — the
    // single source of truth for this lookup — rather than keeping a second copy.
    private static String countryCode(String marketId) {
        String iso = com.ceview.module2.MarketFlags.isoFor(marketId);
        return iso.isBlank() ? "US" : iso;
    }

    public ExternalMarketDataClient(
            @Value("${ceview.external.worldbank.base-url}") String worldBankUrl,
            @Value("${ceview.external.forex.base-url}") String forexUrl,
            MarketEconomicTrendRepository economicTrendRepo,
            ObjectMapper objectMapper) {
        this.worldBankClient   = WebClient.builder().baseUrl(worldBankUrl).build();
        this.forexClient       = WebClient.builder().baseUrl(forexUrl).build();
        this.forexBaseUrl      = forexUrl.replaceAll("/$", ""); // strip trailing slash
        this.economicTrendRepo = economicTrendRepo;
        this.objectMapper      = objectMapper;
    }

    public GdpDataDto fetchGdpGrowth(String marketId) {
        String countryCode = countryCode(marketId);
        try {
            List<Object> response = worldBankClient.get()
                    .uri("/country/{code}/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=5", countryCode)
                    .retrieve()
                    .bodyToMono(LIST_TYPE)
                    .block(TIMEOUT);

            if (response != null && response.size() >= 2) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get(1);
                if (records != null) {
                    for (Map<String, Object> rec : records) {
                        Object val = rec.get("value");
                        if (val != null) {
                            double gdp = ((Number) val).doubleValue();
                            Object dateObj = rec.get("date");
                            int year = dateObj != null ? Integer.parseInt(dateObj.toString()) : 0;
                            return new GdpDataDto(countryCode, gdp, year, "live", OffsetDateTime.now());
                        }
                    }
                }
            }
        } catch (Exception e) {
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("World Bank GDP fetch failed for {} — checking last-known-good: {}", countryCode, e.getMessage());
            MDC.remove("code");
        }

        Optional<MarketEconomicTrend> lastKnown = economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(marketId)
                .filter(t -> t.getGdpLatest() != null);
        if (lastKnown.isPresent()) {
            MarketEconomicTrend t = lastKnown.get();
            OffsetDateTime asOf = t.getGdpFetchedAt() != null ? t.getGdpFetchedAt() : t.getFetchedAt();
            log.warn("GDP live fetch unavailable for {} — reusing last-known-good reading from {}", countryCode, asOf);
            return new GdpDataDto(countryCode, t.getGdpLatest(), 0, "last_known_good", asOf);
        }

        throw macroUnavailable("gdp", marketId, "worldbank",
                "World Bank GDP fetch failed and tbl_market_economic_trend has no prior reading for this market");
    }

    public ForexDataDto fetchForexRate(String marketId) {
        String currencyCode = MarketCatalog.currencyCode(marketId);
        String currencyLower = currencyCode.toLowerCase();
        try {
            // fawazahmed0/currency-api: PHP as base, returns foreign units per 1 PHP —
            // inverted below to this codebase's canonical unit before it is returned.
            java.net.URI uri = java.net.URI.create(CURRENCY_CDN_BASE + "latest" + CURRENCY_CDN_SUFFIX);
            Map<String, Object> response = forexClient.get()
                    .uri(uri)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .block(TIMEOUT);

            if (response != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> phpRates = (Map<String, Object>) response.get("php");
                if (phpRates != null && phpRates.containsKey(currencyLower)) {
                    double foreignUnitsPerPhp = ((Number) phpRates.get(currencyLower)).doubleValue();
                    Double phpPerForeignUnit = invertToCanonical(foreignUnitsPerPhp);
                    if (phpPerForeignUnit != null) {
                        String date = response.getOrDefault("date", "").toString();
                        return new ForexDataDto(currencyCode, phpPerForeignUnit, date, "live", OffsetDateTime.now());
                    }
                }
            }
        } catch (Exception e) {
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("Forex fetch failed for {} — checking last-known-good: {}", currencyCode, e.getMessage());
            MDC.remove("code");
        }

        Optional<MarketEconomicTrend> lastKnown = economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(marketId)
                .filter(t -> t.getForexLatest() != null);
        if (lastKnown.isPresent()) {
            MarketEconomicTrend t = lastKnown.get();
            OffsetDateTime asOf = t.getForexFetchedAt() != null ? t.getForexFetchedAt() : t.getFetchedAt();
            log.warn("Forex live fetch unavailable for {} — reusing last-known-good reading from {}", currencyCode, asOf);
            return new ForexDataDto(currencyCode, t.getForexLatest(), "", "last_known_good", asOf);
        }

        throw macroUnavailable("forex", marketId, "currency-api",
                "Forex fetch failed and tbl_market_economic_trend has no prior reading for this market");
    }

    /**
     * Tier-3 hard failure for any macro input (Step 6, C-06, H-18): neither a
     * live fetch nor a last-known-good DB row exists. Never invents a rate —
     * the caller (ingestion or the forecast pipeline) must decide how to
     * degrade (skip this pair / abort the pipeline), never persist a guess.
     */
    private static AiDependencyException macroUnavailable(String input, String marketId, String dependency, String cause) {
        MDC.put("code", Module2ErrorCodes.MOD21_MACRO_UNAVAILABLE);
        log.error("No {} data available for market={} — live fetch failed and no last-known-good reading exists",
                input, marketId);
        MDC.remove("code");
        return AiDependencyException.fromBody(503, Map.of(
                "code", Module2ErrorCodes.MOD21_MACRO_UNAVAILABLE,
                "message", "No " + input + " data available for " + marketId + ".",
                "dependency", dependency,
                "cause", cause,
                "stage", "spring/external-market-data"),
                "external-market-data/" + input);
    }

    /**
     * Converts a fawazahmed0 CDN quote (foreign units per 1 PHP) to this codebase's
     * canonical unit (contract §1: PHP per 1 unit of foreign currency) — the single point
     * every raw forex read passes through before use. Never fabricates a rate: returns
     * {@code null} for a quote that is zero, negative, or non-finite, so the caller falls
     * through to the last-known-good reading or the (already-canonical) static default
     * rather than dividing by zero or persisting garbage.
     */
    static Double invertToCanonical(double foreignUnitsPerPhp) {
        if (!Double.isFinite(foreignUnitsPerPhp) || foreignUnitsPerPhp <= 0) return null;
        return 1.0 / foreignUnitsPerPhp;
    }

    public FlightReferenceDto getFlightReference(String marketId) {
        return FLIGHT_REFS.getOrDefault(marketId,
                new FlightReferenceDto(marketId, false, "unknown", 0, 0, List.of()));
    }

    // ─── GDP time-series (last 5 annual data points) ─────────────────────────

    /**
     * Fetches up to 5 years of annual GDP growth (World Bank NY.GDP.MKTP.KD.ZG).
     *
     * <p>The existing {@link #fetchGdpGrowth} returns only the most-recent value;
     * this method returns all available years ordered chronologically (oldest → newest)
     * so the frontend can render a trend line on the MarketRadar page.
     *
     * <p>Three-tier policy (Step 6, C-06, H-18): live fetch, then the last-known-good
     * trend persisted in {@code tbl_market_economic_trend}, then a hard failure
     * ({@code MOD21_MACRO_UNAVAILABLE}) — never a synthetic flat series.
     */
    public GdpTrendDto fetchGdpTrend(String marketId) {
        String countryCode = countryCode(marketId);
        try {
            List<Object> response = worldBankClient.get()
                    .uri("/country/{code}/indicator/NY.GDP.MKTP.KD.ZG?format=json&mrv=5", countryCode)
                    .retrieve()
                    .bodyToMono(LIST_TYPE)
                    .block(TIMEOUT);

            if (response != null && response.size() >= 2) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> records = (List<Map<String, Object>>) response.get(1);
                if (records != null) {
                    List<GdpTrendPoint> points = new ArrayList<>();
                    for (Map<String, Object> rec : records) {
                        Object val  = rec.get("value");
                        Object date = rec.get("date");
                        if (val != null && date != null) {
                            points.add(new GdpTrendPoint(
                                    Integer.parseInt(date.toString()),
                                    ((Number) val).doubleValue()));
                        }
                    }
                    if (!points.isEmpty()) {
                        // World Bank returns newest-first → reverse to chronological order
                        points.sort((a, b) -> Integer.compare(a.year(), b.year()));
                        double latest = points.get(points.size() - 1).value();
                        return new GdpTrendDto(countryCode, points, latest, OffsetDateTime.now(), "live");
                    }
                }
            }
        } catch (Exception e) {
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("World Bank GDP trend fetch failed for {} — reusing last-known-good: {}",
                    countryCode, e.getMessage());
            MDC.remove("code");
        }
        // Last-known-good, not a synthetic curve. tbl_market_economic_trend exists
        // precisely so an outage reuses the last real reading (see V11 header).
        GdpTrendDto lastKnown = lastKnownGoodGdp(marketId, countryCode);
        if (lastKnown != null) return lastKnown;

        throw macroUnavailable("gdp-trend", marketId, "worldbank",
                "World Bank GDP trend fetch failed and tbl_market_economic_trend has no prior GDP trend for this market");
    }

    // ─── Forex time-series (12 monthly data points) ──────────────────────────

    /**
     * Fetches 12 months of historical forex rates, PHP per 1 unit of foreign currency
     * (contract §1 canonical unit).
     *
     * <p>Calls the configured forex API's date-range endpoint
     * ({@code /{startDate}..{today}?from=PHP&to={currency}}).
     * The full daily series is sampled to one value per calendar month (first
     * available date in each month) so the frontend receives exactly 12 points.
     *
     * <p>Three-tier policy (Step 6, C-06, H-18): live fetch, then the last-known-good
     * trend persisted in {@code tbl_market_economic_trend}, then a hard failure
     * ({@code MOD21_MACRO_UNAVAILABLE}) — never a synthetic flat series.
     */
    public ForexTrendDto fetchForexTrend(String marketId) {
        String currencyCode  = MarketCatalog.currencyCode(marketId);
        String currencyLower = currencyCode.toLowerCase();
        LocalDate today      = LocalDate.now();
        DateTimeFormatter isoFmt   = DateTimeFormatter.ISO_LOCAL_DATE;
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("yyyy-MM");

        try {
            // Build 12 parallel Mono calls — one per calendar month (first day of each).
            // fawazahmed0/currency-api is CDN-backed so concurrent requests are fast.
            List<Mono<ForexTrendPoint>> monos = new ArrayList<>();
            for (int i = 11; i >= 0; i--) {
                LocalDate firstOfMonth = today.minusMonths(i).withDayOfMonth(1);
                String dateStr  = firstOfMonth.format(isoFmt);
                String monthKey = firstOfMonth.format(monthFmt);

                java.net.URI uri = java.net.URI.create(
                        CURRENCY_CDN_BASE + dateStr + CURRENCY_CDN_SUFFIX);

                Mono<ForexTrendPoint> mono = forexClient.get()
                        .uri(uri)
                        .retrieve()
                        .bodyToMono(MAP_TYPE)
                        .flatMap(resp -> {
                            @SuppressWarnings("unchecked")
                            Map<String, Object> phpRates = (Map<String, Object>) resp.get("php");
                            if (phpRates == null || !phpRates.containsKey(currencyLower)) {
                                return Mono.empty();   // omit the month, never invent a rate for it
                            }
                            double foreignUnitsPerPhp = ((Number) phpRates.get(currencyLower)).doubleValue();
                            Double phpPerForeignUnit = invertToCanonical(foreignUnitsPerPhp);
                            // A zero/negative/non-finite quote is omitted, same as a missing month —
                            // never inverted into a fabricated rate.
                            return phpPerForeignUnit == null
                                    ? Mono.empty()
                                    : Mono.just(new ForexTrendPoint(monthKey, phpPerForeignUnit));
                        })
                        .onErrorResume(e -> Mono.empty());   // a failed month is dropped, not faked
                monos.add(mono);
            }

            // Execute all 12 concurrently, wait up to 30 s total
            List<ForexTrendPoint> points = Flux.merge(monos)
                    .collectList()
                    .block(TREND_TIMEOUT);

            if (points != null && !points.isEmpty()) {
                points.sort(Comparator.comparing(ForexTrendPoint::date));
                double latest = points.get(points.size() - 1).value();
                log.info("Forex trend fetched for {}: {} monthly points", currencyCode, points.size());
                return new ForexTrendDto(currencyCode, points, latest, OffsetDateTime.now(), "live");
            }
        } catch (Exception e) {
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("Forex trend fetch failed for {} — reusing last-known-good: {}",
                    currencyCode, e.getMessage());
            MDC.remove("code");
        }
        // Last-known-good, not a flat synthetic curve.
        ForexTrendDto lastKnown = lastKnownGoodForex(marketId, currencyCode);
        if (lastKnown != null) return lastKnown;

        throw macroUnavailable("forex-trend", marketId, "currency-api",
                "Forex trend fetch failed and tbl_market_economic_trend has no prior forex trend for this market");
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /**
     * The newest persisted GDP trend snapshot for this market, or {@code null}
     * when none has ever been stored. Replaces the old straight-line synthetic
     * curve: a real reading that is simply stale is honest; an invented one is not.
     */
    private GdpTrendDto lastKnownGoodGdp(String marketId, String countryCode) {
        return economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(marketId)
                .filter(t -> t.getGdpTrendJson() != null)
                .map(t -> {
                    try {
                        List<GdpTrendPoint> pts = objectMapper.readValue(
                                t.getGdpTrendJson(), new TypeReference<List<GdpTrendPoint>>() {});
                        if (pts.isEmpty()) return null;
                        double latest = t.getGdpLatest() != null
                                ? t.getGdpLatest() : pts.get(pts.size() - 1).value();
                        OffsetDateTime asOf = t.getGdpFetchedAt() != null ? t.getGdpFetchedAt() : t.getFetchedAt();
                        return new GdpTrendDto(countryCode, pts, latest, asOf, "last_known_good");
                    } catch (Exception e) {
                        log.warn("Stored GDP trend for {} is unreadable: {}", marketId, e.getMessage());
                        return null;
                    }
                })
                .orElse(null);
    }

    /**
     * The newest persisted forex trend snapshot for this market, or {@code null}
     * when none has ever been stored.
     */
    private ForexTrendDto lastKnownGoodForex(String marketId, String currencyCode) {
        return economicTrendRepo.findTopByMarketOrderByFetchedAtDesc(marketId)
                .filter(t -> t.getForexTrendJson() != null)
                .map(t -> {
                    try {
                        List<ForexTrendPoint> pts = objectMapper.readValue(
                                t.getForexTrendJson(), new TypeReference<List<ForexTrendPoint>>() {});
                        if (pts.isEmpty()) return null;
                        double latest = t.getForexLatest() != null
                                ? t.getForexLatest() : pts.get(pts.size() - 1).value();
                        OffsetDateTime asOf = t.getForexFetchedAt() != null ? t.getForexFetchedAt() : t.getFetchedAt();
                        return new ForexTrendDto(currencyCode, pts, latest, asOf, "last_known_good");
                    } catch (Exception e) {
                        log.warn("Stored forex trend for {} is unreadable: {}", marketId, e.getMessage());
                        return null;
                    }
                })
                .orElse(null);
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

    /**
     * @param source "live" (fresh World Bank fetch) or "last_known_good" (Step 6,
     *               C-06, H-18 — reused from tbl_market_economic_trend after a
     *               live-fetch failure). Never a fabricated constant: the tier-3
     *               hard failure is thrown, not encoded as a DTO value.
     * @param asOf   when the reading tagged by {@code source} was actually taken.
     */
    public record GdpDataDto(String countryCode, double gdpGrowth, int year, String source, OffsetDateTime asOf) {
        /** Back-compat for callers/tests that don't care about provenance — tags the reading "live". */
        public GdpDataDto(String countryCode, double gdpGrowth, int year) {
            this(countryCode, gdpGrowth, year, "live", OffsetDateTime.now());
        }
    }

    /**
     * @param rateVsPhp PHP per 1 unit of the foreign currency (contract §1 canonical unit).
     * @param source    see {@link GdpDataDto#source}.
     * @param asOf      see {@link GdpDataDto#asOf}.
     */
    public record ForexDataDto(String currencyCode, double rateVsPhp, String date, String source, OffsetDateTime asOf) {
        /** Back-compat for callers/tests that don't care about provenance — tags the reading "live". */
        public ForexDataDto(String currencyCode, double rateVsPhp, String date) {
            this(currencyCode, rateVsPhp, date, "live", OffsetDateTime.now());
        }
    }

    public record FlightReferenceDto(
            String marketId,
            boolean directFlight,
            String flightHours,
            int distanceKm,
            int flightFrequency,
            List<Map<String, String>> airlines) {}

    // ─── Trend-series DTOs ────────────────────────────────────────────────────

    /** One annual GDP growth data point for a trend chart. */
    public record GdpTrendPoint(int year, double value) {}

    /**
     * One monthly forex rate data point for a trend chart.
     *
     * @param date  ISO month string "YYYY-MM"
     * @param value PHP per 1 unit of the foreign currency (contract §1 canonical unit)
     */
    public record ForexTrendPoint(String date, double value) {}

    /**
     * Multi-year GDP growth time-series for a single market.
     *
     * @param fetchedAt when this reading was taken — {@code now} for a fresh
     *                  World Bank fetch, or the persisted timestamp when this is
     *                  a last-known-good reuse (so callers can age it, Task 16).
     * @param source    "live" or "last_known_good" (Step 6, C-06, H-18).
     */
    public record GdpTrendDto(String countryCode, List<GdpTrendPoint> points, double latest,
                              OffsetDateTime fetchedAt, String source) {
        /** Back-compat for callers/tests that don't care about provenance — tags the reading "live". */
        public GdpTrendDto(String countryCode, List<GdpTrendPoint> points, double latest, OffsetDateTime fetchedAt) {
            this(countryCode, points, latest, fetchedAt, "live");
        }
    }

    /**
     * 12-month forex rate time-series for a single market.
     *
     * @param fetchedAt see {@link GdpTrendDto#fetchedAt()}.
     * @param source    see {@link GdpTrendDto#source()}.
     */
    public record ForexTrendDto(String currencyCode, List<ForexTrendPoint> points, double latest,
                                OffsetDateTime fetchedAt, String source) {
        /** Back-compat for callers/tests that don't care about provenance — tags the reading "live". */
        public ForexTrendDto(String currencyCode, List<ForexTrendPoint> points, double latest, OffsetDateTime fetchedAt) {
            this(currencyCode, points, latest, fetchedAt, "live");
        }
    }
}
