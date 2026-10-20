package com.ceview.module3.media;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.nio.file.Path;
import java.time.Duration;

/** Picks exactly one {@link MediaStorage} from {@code ceview.media.storage}. */
@Configuration
public class MediaConfig {

    @Bean
    @ConditionalOnProperty(name = "ceview.media.storage", havingValue = "local", matchIfMissing = true)
    public LocalMediaStorage localMediaStorage(
            @Value("${ceview.media.local-dir:./media-uploads}") String dir) {
        return new LocalMediaStorage(Path.of(dir));
    }

    @Bean
    @ConditionalOnProperty(name = "ceview.media.storage", havingValue = "s3")
    public MediaStorage s3MediaStorage(
            @Value("${ceview.media.s3.bucket:}") String bucket,
            @Value("${ceview.media.s3.region:ap-southeast-1}") String region,
            @Value("${ceview.media.s3.access-key-id:}") String accessKeyId,
            @Value("${ceview.media.s3.secret-access-key:}") String secretAccessKey,
            @Value("${ceview.media.s3.presign-minutes:15}") long presignMinutes) {
        if (bucket == null || bucket.isBlank()) {
            return new UnconfiguredMediaStorage();
        }
        return new S3MediaStorage(bucket, region, accessKeyId, secretAccessKey,
                Duration.ofMinutes(presignMinutes));
    }
}
