package com.ceview.module3.media;

import jakarta.persistence.*;
import lombok.Data;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One uploaded image or video (V48). */
@Data
@Entity
@Table(name = "tbl_media_asset")
public class MediaAsset {

    /** Match the CHECK constraint in V48. */
    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_READY = "READY";

    @Id
    @Column(name = "media_id")
    private UUID mediaId;

    @Column(name = "business_profile_id", nullable = false) private UUID businessProfileId;
    @Column(name = "kind", nullable = false, length = 10) private String kind;
    @Column(name = "content_type", nullable = false, length = 50) private String contentType;
    @Column(name = "size_bytes", nullable = false) private long sizeBytes;
    @Column(name = "storage_key", nullable = false, length = 255) private String storageKey;
    @Column(name = "public_url", nullable = false, length = 512) private String publicUrl;
    @Column(name = "status", nullable = false, length = 20) private String status;

    @Column(name = "width") private Integer width;
    @Column(name = "height") private Integer height;
    @Column(name = "duration_seconds") private Integer durationSeconds;

    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt;
    @Column(name = "updated_at") private OffsetDateTime updatedAt;

    @PrePersist
    void onCreate() {
        if (mediaId == null) mediaId = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (status == null) status = STATUS_PENDING;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = OffsetDateTime.now();
    }
}
