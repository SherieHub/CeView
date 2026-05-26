package com.ceview.module2.submodule21;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_market_signal_record")
public class MarketSignalRecord {

    @Id
    @Column(name = "signal_record_id")
    private UUID signalRecordId;

    @Column(name = "business_profile_id")  private UUID businessProfileId;
    @Column(name = "target_market")        private String targetMarket;
    @Column(name = "trend_index")          private Double trendIndex;
    @Column(name = "forex_rate")           private Double forexRate;
    @Column(name = "gdp_growth")           private Double gdpGrowth;
    @Column(name = "seasonality_score")    private Double seasonalityScore;
    @Column(name = "rolling_average")      private Double rollingAverage;
    @Column(name = "rolling_std_dev")      private Double rollingStdDev;
    @Column(name = "spike_indicator")      private Boolean spikeIndicator;
    @Column(name = "aggregated_at")        private OffsetDateTime aggregatedAt;

    @PrePersist
    void onCreate() {
        if (signalRecordId == null) signalRecordId = UUID.randomUUID();
        if (aggregatedAt == null) aggregatedAt = OffsetDateTime.now();
    }
}
