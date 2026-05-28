package com.ceview.module2.submodule22;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_forecast_result")
public class ForecastResult {

    @Id
    @Column(name = "forecast_result_id")
    private UUID forecastResultId;

    @Column(name = "business_profile_id")      private UUID businessProfileId;
    @Column(name = "target_market")            private String targetMarket;
    @Column(name = "predicted_demand")         private Double predictedDemand;
    @Column(name = "forecast_confidence")      private Double forecastConfidence;
    @Column(name = "mape_score")               private Double mapeScore;
    @Column(name = "mae")                      private Double mae;
    @Column(name = "rmse")                     private Double rmse;
    @Column(name = "forecast_horizon_weeks")   private Integer forecastHorizonWeeks;
    @Column(name = "generated_at")             private OffsetDateTime generatedAt;
    @Column(name = "weekly_forecasts_json", columnDefinition = "TEXT")
    private String weeklyForecastsJson;

    @PrePersist
    void onCreate() {
        if (forecastResultId == null) forecastResultId = UUID.randomUUID();
        if (generatedAt == null) generatedAt = OffsetDateTime.now();
    }
}
