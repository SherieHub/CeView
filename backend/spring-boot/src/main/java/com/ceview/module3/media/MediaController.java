package com.ceview.module3.media;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.media.MediaDtos.CompleteRequest;
import com.ceview.module3.media.MediaDtos.MediaResponse;
import com.ceview.module3.media.MediaDtos.UploadRequest;
import com.ceview.module3.media.MediaDtos.UploadResponse;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/** Tenant-scoped media upload API. Every call resolves the profile from the JWT. */
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final CurrentBusinessProfile currentBusinessProfile;
    private final MediaService service;
    private final MediaStorage storage;

    public MediaController(CurrentBusinessProfile currentBusinessProfile,
                           MediaService service, MediaStorage storage) {
        this.currentBusinessProfile = currentBusinessProfile;
        this.service = service;
        this.storage = storage;
    }

    @PostMapping("/uploads")
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse requestUpload(@Valid @RequestBody UploadRequest body) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        MediaAsset asset = service.requestUpload(profileId, body.contentType(), body.sizeBytes());
        return new UploadResponse(asset.getMediaId(),
                storage.uploadUrl(asset.getMediaId(), asset.getStorageKey(), asset.getContentType(), asset.getSizeBytes()),
                asset.getPublicUrl(), asset.getKind());
    }

    @PostMapping("/{mediaId}/complete")
    public MediaResponse complete(@PathVariable UUID mediaId,
                                  @Valid @RequestBody(required = false) CompleteRequest body) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        CompleteRequest dims = body != null ? body : new CompleteRequest(null, null, null);
        return MediaResponse.from(service.complete(profileId, mediaId,
                dims.width(), dims.height(), dims.durationSeconds()));
    }

    /**
     * The image's bytes, for the owner. Content Studio restores a saved draft's picture from here
     * instead of from the asset's public URL, which is for outsiders (the social platforms) and
     * may not be reachable from the browser or from the audit's model at all. Images only.
     */
    @GetMapping("/{mediaId}/content")
    public ResponseEntity<InputStreamResource> content(@PathVariable UUID mediaId) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        MediaAsset asset = service.readableImage(profileId, mediaId);
        InputStream in = storage.open(asset.getStorageKey()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "the file is no longer in storage"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(asset.getContentType()))
                .contentLength(asset.getSizeBytes())
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate())
                .body(new InputStreamResource(in));
    }
}
