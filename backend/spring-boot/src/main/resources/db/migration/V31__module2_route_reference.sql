-- V31 — Module 2 E2E, Step 2 (docs/module-2/MODULE_2_E2E_STATUS_AND_DATA_MAPPING.md H-17,
-- audit recommendation C-16 — keep flight/route data static, but make it DATA, not code).
--
-- New table: one row per tracked market, holding exactly the facts today hardcoded in
-- ExternalMarketDataClient.FLIGHT_REFS and ForecastingService.MARKET_META/avgFlightPrice
-- (nearest/destination airport, direct-flight flag, flight hours, distance, weekly
-- frequency, fare range, carrier list). This migration only creates the table and
-- seeds it with the CURRENT constant values; no service code reads from it yet — that
-- wiring is a later, dedicated step. Existing behavior is therefore unchanged by this
-- migration alone.
--
-- airlines_json stores the carrier list as TEXT (Jackson-serialized JSON), matching
-- this codebase's existing convention for JSON-shaped columns
-- (tbl_market_economic_trend.gdp_trend_json / forex_trend_json), rather than a native
-- JSONB column, so the same ObjectMapper + TypeReference pattern already used
-- elsewhere in this module can read it without a new column-mapping strategy.
--
-- ROLLBACK NOTE:
--   Unused table — safe to drop outright, no data-loss caveat:
--     DROP TABLE IF EXISTS tbl_market_route_reference;
--
-- VERIFICATION (see the bottom of this file for the exact SELECT).

CREATE TABLE tbl_market_route_reference (
    market               VARCHAR(60) PRIMARY KEY,
    nearest_airport      VARCHAR(120) NOT NULL,
    destination_airport  VARCHAR(120) NOT NULL,
    direct_flight        BOOLEAN      NOT NULL,
    flight_hours         VARCHAR(64)  NOT NULL,
    distance_km          INTEGER      NOT NULL,
    weekly_frequency     INTEGER      NOT NULL,
    avg_fare_min_php     INTEGER      NOT NULL,
    avg_fare_max_php     INTEGER      NOT NULL,
    airlines_json        TEXT         NOT NULL,
    source               VARCHAR(120) NOT NULL,
    valid_from           DATE         NOT NULL,
    CONSTRAINT chk_mrr_market CHECK (market IN ('korea', 'japan', 'usa'))
);

-- Seeded verbatim from ExternalMarketDataClient.FLIGHT_REFS, ForecastingService.MARKET_META
-- (nearest/destination airport) and ForecastingService.buildMarketDto's avgFlightPrice
-- literals ("₱8,000 – ₱15,000" direct, "₱25,000 – ₱40,000" via Manila), as they stood
-- immediately before this migration.
INSERT INTO tbl_market_route_reference (
    market, nearest_airport, destination_airport, direct_flight, flight_hours,
    distance_km, weekly_frequency, avg_fare_min_php, avg_fare_max_php, airlines_json,
    source, valid_from
) VALUES
    ('korea', 'ICN — Incheon Int''l', 'CEB — Mactan-Cebu Int''l', TRUE, '3h 45m',
     2640, 14, 8000, 15000,
     '[{"name":"Korean Air","code":"KE","frequency":"7x / week"},'
     || '{"name":"Cebu Pacific","code":"5J","frequency":"5x / week"},'
     || '{"name":"Air Busan","code":"BX","frequency":"2x / week"}]',
     'static_reference_v1', CURRENT_DATE),
    ('japan', 'KIX — Kansai Int''l', 'CEB — Mactan-Cebu Int''l', TRUE, '2h 50m',
     2186, 8, 8000, 15000,
     '[{"name":"Philippine Airlines","code":"PR","frequency":"5x / week"},'
     || '{"name":"Cebu Pacific","code":"5J","frequency":"3x / week"}]',
     'static_reference_v1', CURRENT_DATE),
    ('usa', 'LAX — Los Angeles Int''l', 'MNL — Ninoy Aquino Int''l', FALSE, '16h+ (via MNL)',
     11027, 3, 25000, 40000,
     '[{"name":"Philippine Airlines (via Manila)","code":"PR","frequency":"3x / week (via MNL)"}]',
     'static_reference_v1', CURRENT_DATE)
ON CONFLICT (market) DO NOTHING;

-- ── Verification (run manually after deploy; not executed by Flyway) ────────
--      SELECT market, direct_flight, distance_km, weekly_frequency,
--             avg_fare_min_php, avg_fare_max_php, airlines_json
--        FROM tbl_market_route_reference
--       ORDER BY market;
--      -- expect exactly 3 rows (japan, korea, usa) matching the literals above
