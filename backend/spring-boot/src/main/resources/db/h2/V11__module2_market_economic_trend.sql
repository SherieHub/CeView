-- V11 — Module 2: Market Economic Trend time-series table (H2 dialect)
--
-- H2 differences vs Postgres:
--   gen_random_uuid() → RANDOM_UUID()
--   DOUBLE PRECISION  → DOUBLE
--   TIMESTAMPTZ       → TIMESTAMP WITH TIME ZONE

CREATE TABLE tbl_market_economic_trend (
    trend_id         UUID            NOT NULL DEFAULT RANDOM_UUID(),
    market           VARCHAR(50)     NOT NULL,
    gdp_trend_json   TEXT,
    forex_trend_json TEXT,
    gdp_latest       DOUBLE,
    forex_latest     DOUBLE,
    currency_code    VARCHAR(10),
    gdp_points       INT,
    forex_points     INT,
    fetched_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_market_economic_trend PRIMARY KEY (trend_id),
    CONSTRAINT chk_met_market CHECK (market IN ('korea', 'japan', 'usa'))
);

CREATE INDEX idx_met_market_fetched
    ON tbl_market_economic_trend (market, fetched_at DESC);
