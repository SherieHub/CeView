package com.ceview.module4.postmetrics;

import jakarta.persistence.*;
import lombok.Data;
import java.time.OffsetDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name="tbl_post_metric", uniqueConstraints=@UniqueConstraint(columnNames="post_id"))
public class PostMetric {
    @Id private UUID id;
    @Column(nullable=false) private UUID postId;
    @Column(nullable=false) private UUID businessProfileId;
    private Long reach;
    private Long likes;
    private Long comments;
    private Long shares;
    private Double engagementRate;
    @Column(columnDefinition="TEXT") private String reachSeriesJson;
    private OffsetDateTime lastSyncedAt;
    @PrePersist void created() { if (id==null) id=UUID.randomUUID(); }
}
