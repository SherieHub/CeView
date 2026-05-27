package com.ceview.module2.submodule21;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Persists GDP and forex rate time-series for a market so the MarketRadar
 * view can render continuous economic trend charts (FR2.13 extension).
 *
 * <p>Each row captures one fetch snapshot for one market.  The latest row
 * per market (ordered by {@code fetched_at DESC}) is the live dataset.
 *
 * <p>JSON column layout:
 * <pre>
 * gdp_trend_json  — array of annual GDP growth points:
 *     [{"year": 2020, "value": -0.9}, {"year": 2021, "value": 4.1}, ...]
 *
 * forex_trend_json — array of monthly forex rates (foreign-currency units per PHP):
 *     [{"date": "2025-01", "value": 23.5}, {"date": "2025-02", "value": 23.8}, ...]
 * </pre>
 */
@Data
@Entity
@Table(name = "tbl_market_economic_trend",
       indexes = {
           @Index(name = "idx_met_market_fetched", columnList = "market, fetched_at DESC")
       })
public class MarketEconomicTrend {

    @Id
    @Column(name = "trend_id")
    private UUID trendId;

    /** Lower-case market key: "korea" | "japan" | "usa" */
    @Column(name = "market", nullable = false, length = 50)
    private String market;

    /**
     * JSON array — annual GDP growth % for the last N years (World Bank NY.GDP.MKTP.KD.ZG).
     * Each element: {"year": int, "value": double}
     */
    @Column(name = "gdp_trend_json", columnDefinition = "TEXT")
    private String gdpTrendJson;

    /**
     * JSON array — monthly forex rate (foreign-currency units per PHP) for the last 12 months.
     * Each element: {"date": "YYYY-MM", "value": double}
     */
    @Column(name = "forex_trend_json", columnDefinition = "TEXT")
    private String forexTrendJson;

    /** Single latest GDP growth value — used as scalar input to XGBoost. */
    @Column(name = "gdp_latest")
    private Double gdpLatest;

    /** Single latest forex rate (foreign-currency per PHP). */
    @Column(name = "forex_latest")
    private Double forexLatest;

    /** ISO currency code for this market's forex series. */
    @Column(name = "currency_code", length = 10)
    private String currencyCode;

    /** How many GDP data points are in gdp_trend_json. */
    @Column(name = "gdp_points")
    private Integer gdpPoints;

    /** How many forex data points are in forex_trend_json. */
    @Column(name = "forex_points")
    private Integer forexPoints;

    @Column(name = "fetched_at", nullable = false)
    private OffsetDateTime fetchedAt;

    @PrePersist
    void onCreate() {
        if (trendId == null) trendId = UUID.randomUUID();
        if (fetchedAt == null) fetchedAt = OffsetDateTime.now();
    }
}
