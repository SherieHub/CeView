package com.ceview.module2.submodule22;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_market_score")
public class MarketScore {

    @Id
    @Column(name = "market_score_id")
    private UUID marketScoreId;

    @Column(name = "forecast_result_id")     private UUID forecastResultId;
    @Column(name = "market_score")           private Double marketScore;
    @Column(name = "seasonality_score")      private Double seasonalityScore;
    @Column(name = "spike_indicator")        private Boolean spikeIndicator;
    @Column(name = "gdp_per_capita_growth")  private Double gdpPerCapitaGrowth;
    @Column(name = "forex_vs_php")           private Double forexVsPhp;
    @Column(name = "historical_arrivals")    private Integer historicalArrivals;
    @Column(name = "market_rank")            private Integer marketRank;
    @Column(name = "evaluated_at")           private OffsetDateTime evaluatedAt;

    @PrePersist
    void onCreate() {
        if (marketScoreId == null) marketScoreId = UUID.randomUUID();
        if (evaluatedAt == null) evaluatedAt = OffsetDateTime.now();
    }
}
