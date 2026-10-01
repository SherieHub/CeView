package com.ceview.module2.submodule22;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Persisted weekly keyword-trend notification for one profile category. */
@Data
@Entity
@Table(
        name = "tbl_keyword_trend_alert",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_keyword_trend_alert_profile_category_week",
                columnNames = {"business_profile_id", "category", "iso_year", "iso_week"}))
public class KeywordTrendAlert {

    @Id
    @Column(name = "keyword_trend_alert_id")
    private UUID keywordTrendAlertId;

    @Column(name = "business_profile_id", nullable = false)
    private UUID businessProfileId;

    @Column(name = "category", nullable = false, length = 100)
    private String category;

    @Column(name = "target_market", nullable = false, length = 60)
    private String targetMarket;

    @Column(name = "top_keyword", nullable = false, length = 255)
    private String topKeyword;

    @Column(name = "alert_message", nullable = false, columnDefinition = "TEXT")
    private String alertMessage;

    @Column(name = "alert_level", nullable = false, length = 40)
    private String alertLevel;

    @Column(name = "iso_year", nullable = false)
    private Short isoYear;

    @Column(name = "iso_week", nullable = false)
    private Short isoWeek;

    @Column(name = "is_read", nullable = false)
    private Boolean isRead;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void onCreate() {
        if (keywordTrendAlertId == null) keywordTrendAlertId = UUID.randomUUID();
        if (isRead == null) isRead = false;
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }
}
