package com.ceview.module3.media;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.UUID;

/**
 * Local-dev stand-in for an S3 presigned PUT. Like a presigned URL it carries no
 * JWT: the unguessable media id is the credential, and it only accepts a PENDING
 * asset, so a completed upload cannot be overwritten. Not registered when
 * {@code ceview.media.storage=s3}.
 */
@RestController
@ConditionalOnProperty(name = "ceview.media.storage", havingValue = "local", matchIfMissing = true)
public class LocalMediaUploadController {

    private final MediaAssetRepository repo;
    private final LocalMediaStorage storage;

    public LocalMediaUploadController(MediaAssetRepository repo, LocalMediaStorage storage) {
        this.repo = repo;
        this.storage = storage;
    }

    @PutMapping("/api/media/local/{mediaId}")
    public ResponseEntity<Void> upload(@PathVariable UUID mediaId, HttpServletRequest request)
            throws IOException {
        MediaAsset asset = repo.findById(mediaId)
                .filter(a -> MediaAsset.STATUS_PENDING.equals(a.getStatus()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "no pending upload"));

        String sent = request.getContentType() == null ? "" : request.getContentType().split(";")[0].trim();
        if (!sent.equalsIgnoreCase(asset.getContentType())) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "expected Content-Type " + asset.getContentType());
        }

        long max = MediaPolicy.ruleFor(asset.getContentType()).orElseThrow().maxBytes();
        try {
            storage.write(asset.getStorageKey(), request.getInputStream(), max);
        } catch (LocalMediaStorage.TooLargeException e) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, e.getMessage());
        }
        return ResponseEntity.noContent().build();
    }
}
