package com.ceview.module3.media;

import java.io.InputStream;
import java.util.Optional;
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

    /**
     * The stored bytes, or empty if nothing is stored under this key. The caller closes the stream.
     * This is how the API itself reads a file back: the public URL is for outsiders (the social
     * platforms) and may not be reachable from the browser or from this server at all.
     */
    Optional<InputStream> open(String key);

    void delete(String key);
}
