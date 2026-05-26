package com.ceview.module2.submodule21;

import com.ceview.module2.Module2ErrorCodes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
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

    private final WebClient worldBankClient;
    private final WebClient forexClient;

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

    // Market → ISO-2 country code (World Bank)
    private static final Map<String, String> COUNTRY_CODE = Map.of(
            "korea", "KR", "japan", "JP", "usa", "US");

    // Market → currency code
    private static final Map<String, String> CURRENCY_CODE = Map.of(
            "korea", "KRW", "japan", "JPY", "usa", "USD");

    public ExternalMarketDataClient(
            @Value("${ceview.external.worldbank.base-url}") String worldBankUrl,
            @Value("${ceview.external.forex.base-url}") String forexUrl) {
        this.worldBankClient = WebClient.builder().baseUrl(worldBankUrl).build();
        this.forexClient     = WebClient.builder().baseUrl(forexUrl).build();
    }

    public GdpDataDto fetchGdpGrowth(String marketId) {
        String countryCode = COUNTRY_CODE.getOrDefault(marketId, "US");
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
        try {
            Map<String, Object> response = forexClient.get()
                    .uri("/latest?base=PHP&symbols={code}", currencyCode)
                    .retrieve()
                    .bodyToMono(MAP_TYPE)
                    .block(TIMEOUT);

            if (response != null) {
                @SuppressWarnings("unchecked")
                Map<String, Object> rates = (Map<String, Object>) response.get("rates");
                if (rates != null && rates.containsKey(currencyCode)) {
                    double rate = ((Number) rates.get(currencyCode)).doubleValue();
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
}
