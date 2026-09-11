package com.ceview.module2;

import java.util.List;
import java.util.Map;

/**
 * Single source of truth for which foreign markets Module 2 tracks and their
 * catalog facts (display name, city, currency).
 *
 * <p>Collapses the market-id list that was independently declared in
 * {@code ForecastingService}, {@code MarketDataIngestionService},
 * {@code TrendFetchSchedulerService}, the {@code MARKET_NAMES} map in
 * {@code NotificationService} and the {@code CURRENCY_CODE} map in
 * {@code ExternalMarketDataClient} (audit C-16 — one configuration source).
 *
 * <p>Route and carrier facts (airports, fares, flight hours, weekly frequency,
 * peak months) are versioned reference DATA and live in
 * {@code tbl_market_route_reference}, not here. ISO-3166 country codes for the
 * flag glyph live in {@link MarketFlags}.
 */
public final class MarketCatalog {

    /** Lower-case market ids, in the canonical display / iteration order. */
    public static final List<String> IDS = List.of("korea", "japan", "usa");

    private record Entry(String displayName, String city, String currencyCode) {}

    private static final Map<String, Entry> BY_ID = Map.of(
            "korea", new Entry("South Korea",   "Seoul",       "KRW"),
            "japan", new Entry("Japan",          "Osaka",       "JPY"),
            "usa",   new Entry("United States",  "Los Angeles", "USD"));

    private MarketCatalog() {}

    public static boolean isTracked(String id) {
        return BY_ID.containsKey(id);
    }

    /** Display name, or the id itself when unmapped (never null). */
    public static String displayName(String id) {
        Entry e = BY_ID.get(id);
        return e != null ? e.displayName() : id;
    }

    /** City behind the market, or the id itself when unmapped (never null). */
    public static String city(String id) {
        Entry e = BY_ID.get(id);
        return e != null ? e.city() : id;
    }

    /** ISO-4217 currency code; defaults to {@code "USD"} for an unmapped id. */
    public static String currencyCode(String id) {
        Entry e = BY_ID.get(id);
        return e != null ? e.currencyCode() : "USD";
    }
}
