package com.ceview.module4.postmetrics;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface PostMetricRepository extends JpaRepository<PostMetric, UUID> {
    Optional<PostMetric> findByPostIdAndBusinessProfileId(UUID postId, UUID businessProfileId);
}
