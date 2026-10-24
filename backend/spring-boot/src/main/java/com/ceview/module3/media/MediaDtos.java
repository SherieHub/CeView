package com.ceview.module3.media;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.util.UUID;

public final class MediaDtos {

    private MediaDtos() {}

    public record UploadRequest(@NotBlank String contentType, @Positive long sizeBytes) {}

    /**
     * {@code uploadUrl} may be relative to the API origin (local dev); the browser
     * must PUT the file to it with the same Content-Type it declared.
     */
    public record UploadResponse(UUID mediaId, String uploadUrl, String publicUrl, String kind) {}

    public record CompleteRequest(@Min(1) Integer width, @Min(1) Integer height,
                                  @Min(0) Integer durationSeconds) {}

    public record MediaResponse(UUID mediaId, String kind, String contentType, long sizeBytes,
                                String publicUrl, String status,
                                Integer width, Integer height, Integer durationSeconds) {

        static MediaResponse from(MediaAsset a) {
            return new MediaResponse(a.getMediaId(), a.getKind(), a.getContentType(), a.getSizeBytes(),
                    a.getPublicUrl(), a.getStatus(), a.getWidth(), a.getHeight(), a.getDurationSeconds());
        }
    }
}
