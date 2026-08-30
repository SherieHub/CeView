package com.ceview.module2;

import java.util.Map;

/**
 * Market id to ISO-3166 alpha-2, for the flag glyph the radar cards render.
 *
 * <p>Single source of truth for this lookup — {@code ExternalMarketDataClient}'s
 * World Bank country-code map (used to fetch GDP data) delegates here instead of
 * keeping its own copy, since it needs the same ISO-2 codes for the same three
 * markets.
 *
 * <p>Keyed by the lower-case market id used throughout the pipeline
 * ({@code ForecastingService.MARKETS}: "korea", "japan", "usa"), not the
 * display name.
 */
public final class MarketFlags {

    private static final Map<String, String> ISO = Map.of(
            "korea", "KR",
            "japan", "JP",
            "usa", "US");

    private MarketFlags() {}

    /** Empty string for an unmapped market — the UI renders no glyph rather than a wrong one. */
    public static String isoFor(String marketId) {
        return ISO.getOrDefault(marketId, "");
    }
}
