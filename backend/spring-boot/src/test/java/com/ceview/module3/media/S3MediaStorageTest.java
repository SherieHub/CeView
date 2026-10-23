package com.ceview.module3.media;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class S3MediaStorageTest {

    @Test
    void presignsAPutForTheKeyWithTheContentTypeSigned() {
        S3MediaStorage storage = new S3MediaStorage(
                "test-bucket", "ap-southeast-1", "AKIATESTKEY", "test-secret", Duration.ofMinutes(10));

        String url = storage.uploadUrl(UUID.randomUUID(), "media/p1/a.jpg", "image/jpeg", 12345);

        assertThat(url)
                .startsWith("https://test-bucket.s3.ap-southeast-1.amazonaws.com/media/p1/a.jpg?")
                .contains("X-Amz-Signature=")
                .contains("X-Amz-Expires=600")
                // content-type is a signed header, so the browser must send exactly the type we asked for
                .contains("content-type")
                // content-length is signed too, so the PUT is pinned to the declared size
                .contains("content-length");
        storage.close();
    }
}
