package com.ceview.module3.media;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.util.Optional;
import java.util.OptionalLong;
import java.util.UUID;

/**
 * Stands in when {@code ceview.media.storage=s3} but no bucket is configured, so
 * the app still boots and the media endpoints say why they are off — the same
 * degrade-gracefully posture as the token cipher.
 */
public class UnconfiguredMediaStorage implements MediaStorage {

    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "media storage is not configured (set MEDIA_BUCKET)");
    }

    @Override
    public String uploadUrl(UUID mediaId, String key, String contentType, long sizeBytes) {
        throw unavailable();
    }

    @Override
    public OptionalLong sizeOf(String key) {
        throw unavailable();
    }

    @Override
    public Optional<InputStream> open(String key) {
        throw unavailable();
    }

    @Override
    public void delete(String key) {
        throw unavailable();
    }
}
