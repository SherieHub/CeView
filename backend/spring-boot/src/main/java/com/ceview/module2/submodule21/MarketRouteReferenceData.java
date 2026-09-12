package com.ceview.module2.submodule21;

import com.ceview.module2.submodule21.ExternalMarketDataClient.CarrierDto;
import com.ceview.module2.submodule21.ExternalMarketDataClient.FlightReferenceDto;

import java.util.List;
import java.util.Map;

/**
 * Canonical route &amp; carrier reference data (audit C-16 / H-16 / H-19 / H-21) —
 * the single Java copy of what {@code db/migration/V31} (route facts, fares,
 * carriers) and {@code V37} (reference peak months) seed into
 * {@code tbl_market_route_reference}.
 *
 * <p>Used only as the fallback for
 * {@link ExternalMarketDataClient#getFlightReference} when the DB row is absent —
 * chiefly under H2 tests, where Flyway (and therefore the V31/V37 seed) is
 * disabled. Production always reads the DB row, whose {@code source} and
 * {@code valid_from} columns carry the provenance the radar drawer displays.
 * Keep these values in lock-step with V31/V37.
 */
public final class MarketRouteReferenceData {

    /** Matches {@code tbl_market_route_reference.source} seeded by V31. */
    public static final String SOURCE = "static_reference_v1";
    /** Matches the {@code valid_from} V31 seeds (CURRENT_DATE at migration authoring). */
    public static final String VALID_FROM = "2026-09-11";

    private static final Map<String, FlightReferenceDto> BY_ID = Map.of(
            "korea", new FlightReferenceDto(
                    "korea", true, "3h 45m", 2_640, 14,
                    "ICN — Incheon Int'l", "CEB — Mactan-Cebu Int'l",
                    8_000, 15_000, SOURCE, VALID_FROM,
                    List.of("Jul", "Aug", "Dec", "Jan"),
                    List.of(
                            new CarrierDto("Korean Air",   "KE", "7x / week", true),
                            new CarrierDto("Cebu Pacific", "5J", "5x / week", true),
                            new CarrierDto("Air Busan",    "BX", "2x / week", true))),
            "japan", new FlightReferenceDto(
                    "japan", true, "2h 50m", 2_186, 8,
                    "KIX — Kansai Int'l", "CEB — Mactan-Cebu Int'l",
                    8_000, 15_000, SOURCE, VALID_FROM,
                    List.of("Apr", "May", "Aug", "Mar"),
                    List.of(
                            new CarrierDto("Philippine Airlines", "PR", "5x / week", true),
                            new CarrierDto("Cebu Pacific",         "5J", "3x / week", true))),
            "usa", new FlightReferenceDto(
                    "usa", false, "16h+ (via MNL)", 11_027, 3,
                    "LAX — Los Angeles Int'l", "MNL — Ninoy Aquino Int'l",
                    25_000, 40_000, SOURCE, VALID_FROM,
                    List.of("Jun", "Jul", "Aug", "Dec"),
                    List.of(
                            new CarrierDto("Philippine Airlines (via Manila)", "PR", "3x / week (via MNL)", false))));

    private MarketRouteReferenceData() {}

    /**
     * Canonical reference for a market, or a clearly-empty placeholder for an
     * unknown id (never a fabricated route).
     */
    public static FlightReferenceDto flightReference(String marketId) {
        return BY_ID.getOrDefault(marketId, new FlightReferenceDto(
                marketId, false, "unknown", 0, 0, "—", "—",
                0, 0, "unknown", null, List.of(), List.of()));
    }
}
