package com.ceview.module2.submodule21;

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

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Fetches GDP and forex data from free public APIs (FR2.3).
 * Uses its own WebClient instances — not the fastapiClient bean.
 * All methods fall back to static defaults on any exception.
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

    // Fallback GDP values (annual % growth, recent estimate)
    private static final Map<String, Double> GDP_DEFAULTS = Map.of(
            "KR", 2.2, "JP", 1.4, "US", 2.5);

    // Fallback forex rates (units of foreign currency per PHP)
    private static final Map<String, Double> FOREX_DEFAULTS = Map.of(
            "KRW", 23.8, "JPY", 2.1, "USD", 0.018);

    // Market → ISO-2 country code (World Bank). Delegates to MarketFlags — the
    // single source of truth for this lookup — rather than keeping a second copy.
    private static String countryCode(String marketId) {
        String iso = com.ceview.module2.MarketFlags.isoFor(marketId);
        return iso.isBlank() ? "US" : iso;
    }

    // Market → currency code
    private static final Map<String, String> CURRENCY_CODE = Map.of(
            "korea", "KRW", "japan", "JPY", "usa", "USD");

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
                            return new GdpDataDto(countryCode, gdp, year);
                        }
                    }
                }
            }
        } catch (Exception e) {
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("World Bank GDP fetch failed for {} — using default: {}", countryCode, e.getMessage());
            MDC.remove("code");
        }
        return new GdpDataDto(countryCode, GDP_DEFAULTS.getOrDefault(countryCode, 2.0), 0);
    }

    public ForexDataDto fetchForexRate(String marketId) {
        String currencyCode = CURRENCY_CODE.getOrDefault(marketId, "USD");
        String currencyLower = currencyCode.toLowerCase();
        try {
            // fawazahmed0/currency-api: PHP as base, returns foreign units per 1 PHP
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
                    double rate = ((Number) phpRates.get(currencyLower)).doubleValue();
                    String date = response.getOrDefault("date", "").toString();
                    return new ForexDataDto(currencyCode, rate, date);
                }
            }
        } catch (Exception e) {
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("Forex fetch failed for {} — using default: {}", currencyCode, e.getMessage());
            MDC.remove("code");
        }
        return new ForexDataDto(currencyCode, FOREX_DEFAULTS.getOrDefault(currencyCode, 1.0), "");
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
     * <p>Falls back to a 5-year flat series at the market default if the API is
     * unavailable, keeping the pipeline non-blocking.
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
                        return new GdpTrendDto(countryCode, points, latest, OffsetDateTime.now());
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
        // null → "never fetched", and the market's economic panel renders empty
        // rather than flat.
        return lastKnownGoodGdp(marketId, countryCode);
    }

    // ─── Forex time-series (12 monthly data points) ──────────────────────────

    /**
     * Fetches 12 months of historical forex rates (foreign-currency units per PHP).
     *
     * <p>Calls the configured forex API's date-range endpoint
     * ({@code /{startDate}..{today}?from=PHP&to={currency}}).
     * The full daily series is sampled to one value per calendar month (first
     * available date in each month) so the frontend receives exactly 12 points.
     *
     * <p>Falls back to a flat 12-month series at the market default when the
     * historical endpoint is not supported or the API is unavailable.
     */
    public ForexTrendDto fetchForexTrend(String marketId) {
        String currencyCode  = CURRENCY_CODE.getOrDefault(marketId, "USD");
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
                            double rate = ((Number) phpRates.get(currencyLower)).doubleValue();
                            return Mono.just(new ForexTrendPoint(monthKey, rate));
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
                return new ForexTrendDto(currencyCode, points, latest, OffsetDateTime.now());
            }
        } catch (Exception e) {
            MDC.put("code", Module2ErrorCodes.MOD21_EXTERNAL_API_ERROR);
            log.warn("Forex trend fetch failed for {} — reusing last-known-good: {}",
                    currencyCode, e.getMessage());
            MDC.remove("code");
        }
        // Last-known-good, not a flat synthetic curve. null → "never fetched".
        return lastKnownGoodForex(marketId, currencyCode);
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
                        return new GdpTrendDto(countryCode, pts, latest, t.getFetchedAt());
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
                        return new ForexTrendDto(currencyCode, pts, latest, t.getFetchedAt());
                    } catch (Exception e) {
                        log.warn("Stored forex trend for {} is unreadable: {}", marketId, e.getMessage());
                        return null;
                    }
                })
                .orElse(null);
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public record GdpDataDto(String countryCode, double gdpGrowth, int year) {}

    public record ForexDataDto(String currencyCode, double rateVsPhp, String date) {}

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
     * @param value foreign-currency units per PHP
     */
    public record ForexTrendPoint(String date, double value) {}

    /**
     * Multi-year GDP growth time-series for a single market.
     *
     * @param fetchedAt when this reading was taken — {@code now} for a fresh
     *                  World Bank fetch, or the persisted timestamp when this is
     *                  a last-known-good reuse (so callers can age it, Task 16).
     */
    public record GdpTrendDto(String countryCode, List<GdpTrendPoint> points, double latest,
                              OffsetDateTime fetchedAt) {}

    /**
     * 12-month forex rate time-series for a single market.
     *
     * @param fetchedAt see {@link GdpTrendDto#fetchedAt()}.
     */
    public record ForexTrendDto(String currencyCode, List<ForexTrendPoint> points, double latest,
                                OffsetDateTime fetchedAt) {}
}
