package com.ceview.module3.media;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MediaConfigTest {

    @Test
    void s3WithoutABucketStillBootsButRefusesToWork() {
        MediaStorage storage = new MediaConfig()
                .s3MediaStorage("", "ap-southeast-1", "", "", 15);

        assertThat(storage).isInstanceOf(UnconfiguredMediaStorage.class);
        assertThatThrownBy(() -> storage.uploadUrl(UUID.randomUUID(), "media/x.jpg", "image/jpeg", 10))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("not configured");
    }

    @Test
    void s3WithABucketBuildsTheRealStorage() {
        MediaStorage storage = new MediaConfig()
                .s3MediaStorage("some-bucket", "ap-southeast-1", "AKIATESTKEY", "secret", 15);

        assertThat(storage).isInstanceOf(S3MediaStorage.class);
        ((S3MediaStorage) storage).close();
    }
}
