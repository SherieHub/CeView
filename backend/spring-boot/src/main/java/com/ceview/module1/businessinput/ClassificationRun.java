package com.ceview.module1.businessinput;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.time.OffsetDateTime;
import java.util.*;

@Getter
@Setter
@Entity
@Table(name = "tbl_classification_run")
public class ClassificationRun {
    @Id private UUID runId;
    @Column(nullable = false) private UUID operatorId;
    private UUID businessProfileId;
    @Column(nullable = false) private OffsetDateTime createdAt;
    @Column(nullable = false) private String runPurpose;
    @Column(nullable = false, columnDefinition = "text") private String inputDescription;
    @Column(nullable = false, columnDefinition = "text") private String inputUvp;
    @JdbcTypeCode(SqlTypes.JSON) private List<String> inputServices;
    private String topCategory;
    private Double topConfidence;
    @JdbcTypeCode(SqlTypes.JSON) private Map<String, Double> predictedCategories;
    @JdbcTypeCode(SqlTypes.JSON) private Map<String, Double> categoryScores;
    @JdbcTypeCode(SqlTypes.JSON) private List<String> recommendedCategories;
    private String modelVersion;
    private Double inferenceLatencyMs;
    @JdbcTypeCode(SqlTypes.JSON) private List<String> finalCategories;
    private OffsetDateTime confirmedAt;
    private Boolean isOverridden;
}
