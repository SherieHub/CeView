package com.ceview.module2.submodule22;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "tbl_demand_alert")
public class DemandAlert {

    @Id
    @Column(name = "demand_alert_id")
    private UUID demandAlertId;

    @Column(name = "market_score_id")             private UUID marketScoreId;
    @Column(name = "alert_level")                 private String alertLevel;
    @Column(name = "alert_message", columnDefinition = "TEXT")
    private String alertMessage;
    @Column(name = "window_open_date")            private OffsetDateTime windowOpenDate;
    @Column(name = "alert_date")                  private OffsetDateTime alertDate;

    @PrePersist
    void onCreate() {
        if (demandAlertId == null) demandAlertId = UUID.randomUUID();
        if (alertDate == null) alertDate = OffsetDateTime.now();
    }
}
