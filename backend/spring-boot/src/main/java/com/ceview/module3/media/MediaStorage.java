package com.ceview.module3.media;

import java.util.OptionalLong;
import java.util.UUID;

/** Where uploaded media bytes live. Keys are server-generated, never client input. */
public interface MediaStorage {

    /**
     * The URL the browser PUTs the file to, with the given Content-Type header.
     * Implementations that can (S3) pin the PUT to {@code sizeBytes}.
     * May be absolute (S3 presigned) or relative to the API origin (local dev).
     */
    String uploadUrl(UUID mediaId, String key, String contentType, long sizeBytes);

    /** Stored size in bytes, or empty if nothing has been uploaded under this key. */
    OptionalLong sizeOf(String key);

    void delete(String key);
}
