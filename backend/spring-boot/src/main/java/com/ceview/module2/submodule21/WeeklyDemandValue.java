package com.ceview.module2.submodule21;

import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_orig_weekly_demand_value")
public class WeeklyDemandValue {

    @Id
    @Column(name = "demand_value_id")
    private UUID demandValueId;

    @Column(name = "week")                private OffsetDateTime week;
    @Column(name = "business_profile_id") private UUID businessProfileId;
    @Column(name = "target_market")       private String targetMarket;
    @Column(name = "beach_category")      private BigDecimal beachCategory;
    @Column(name = "adventure")           private BigDecimal adventure;
    @Column(name = "cultural")            private BigDecimal cultural;
    @Column(name = "theme_parks")         private BigDecimal themeParks;
    @Column(name = "urban")               private BigDecimal urban;
    @Column(name = "culinary")            private BigDecimal culinary;
    @Column(name = "accommodation")       private BigDecimal accommodation;
    @Column(name = "connecting_flights")  private String connectingFlights;
    @Column(name = "market_score")        private BigDecimal marketScore;
    @Column(name = "strategy")            private String strategy;
    @Column(name = "forex")               private BigDecimal forex;
    @Column(name = "gdp")                 private BigDecimal gdp;
    @Column(name = "market_rank")         private Integer marketRank;
    @Column(name = "spike_meaning")       private String spikeMeaning;
    @Column(name = "current_checklist")   private String currentChecklist;
    @Column(name = "seasonality_meaning") private String seasonalityMeaning;

    @PrePersist
    void onCreate() {
        if (demandValueId == null) demandValueId = UUID.randomUUID();
    }
}
