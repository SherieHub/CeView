-- V11 — Module 2: Market Economic Trend time-series table
--
-- Stores per-market GDP and forex rate history so the MarketRadar view
-- can render continuous economic trend charts instead of single-point values.
--
-- gdp_trend_json  : JSON array of annual GDP growth points
--                   [{"year": 2020, "value": -0.9}, ...]
-- forex_trend_json: JSON array of monthly forex rates (foreign-currency units per PHP)
--                   [{"date": "2025-01", "value": 23.5}, ...]
--
-- Query pattern: SELECT * FROM tbl_market_economic_trend
--                WHERE market = 'korea'
--                ORDER BY fetched_at DESC LIMIT 1;

CREATE TABLE tbl_market_economic_trend (
    trend_id         UUID            NOT NULL DEFAULT gen_random_uuid(),
    market           VARCHAR(50)     NOT NULL,
    gdp_trend_json   TEXT,
    forex_trend_json TEXT,
    gdp_latest       DOUBLE PRECISION,
    forex_latest     DOUBLE PRECISION,
    currency_code    VARCHAR(10),
    gdp_points       INT,
    forex_points     INT,
    fetched_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_market_economic_trend PRIMARY KEY (trend_id),
    CONSTRAINT chk_met_market CHECK (market IN ('korea', 'japan', 'usa'))
);

CREATE INDEX idx_met_market_fetched
    ON tbl_market_economic_trend (market, fetched_at DESC);
