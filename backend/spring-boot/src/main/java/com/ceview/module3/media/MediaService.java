package com.ceview.module3.media;

import com.ceview.module3.media.MediaPolicy.Rule;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.UUID;

/** Owns the upload lifecycle: validate, mint a key, verify the stored object. */
@Service
public class MediaService {

    private final MediaAssetRepository repo;
    private final MediaStorage storage;
    private final String publicBaseUrl;

    public MediaService(MediaAssetRepository repo, MediaStorage storage,
                        @Value("${ceview.media.public-base-url:http://localhost:8080}") String publicBaseUrl) {
        this.repo = repo;
        this.storage = storage;
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
    }

    /** Validates the declared type/size and records a PENDING asset with a server-generated key. */
    @Transactional
    public MediaAsset requestUpload(UUID businessProfileId, String contentType, long sizeBytes) {
        Rule rule = MediaPolicy.ruleFor(contentType).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                        "unsupported media type: " + contentType));
        if (sizeBytes <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is empty");
        }
        if (sizeBytes > rule.maxBytes()) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "file exceeds the " + (rule.maxBytes() / (1024 * 1024)) + " MB limit for " + rule.kind() + "s");
        }

        UUID mediaId = UUID.randomUUID();
        String key = "media/" + businessProfileId + "/" + mediaId + "." + rule.extension();

        MediaAsset asset = new MediaAsset();
        asset.setMediaId(mediaId);
        asset.setBusinessProfileId(businessProfileId);
        asset.setKind(rule.kind());
        asset.setContentType(contentType.trim().toLowerCase(Locale.ROOT));
        asset.setSizeBytes(sizeBytes);
        asset.setStorageKey(key);
        asset.setPublicUrl(publicUrlFor(key));
        asset.setStatus(MediaAsset.STATUS_PENDING);
        return repo.save(asset);
    }

    /**
     * Where the outside world (the social platforms, a browser) reads this asset right now. Built
     * from the current base URL rather than the {@code public_url} saved at upload time, so a
     * draft's media keeps publishing after {@code MEDIA_PUBLIC_BASE_URL} changes.
     */
    public String publicUrlOf(MediaAsset asset) {
        return publicUrlFor(asset.getStorageKey());
    }

    private String publicUrlFor(String storageKey) {
        return publicBaseUrl + "/" + storageKey;
    }

    /**
     * Confirms the file really is in storage and within policy, then marks the asset READY.
     * Idempotent for an already-READY asset. {@code noRollbackFor} so that deleting an
     * oversize upload sticks when the 413 is thrown.
     */
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public MediaAsset complete(UUID businessProfileId, UUID mediaId,
                               Integer width, Integer height, Integer durationSeconds) {
        MediaAsset asset = repo.findByMediaIdAndBusinessProfileId(mediaId, businessProfileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "media not found"));
        if (MediaAsset.STATUS_READY.equals(asset.getStatus())) {
            return asset;
        }

        long actual = storage.sizeOf(asset.getStorageKey()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.CONFLICT,
                        "the file has not been uploaded yet — PUT it to the upload URL first"));

        Rule rule = MediaPolicy.ruleFor(asset.getContentType()).orElseThrow();
        if (actual > rule.maxBytes()) {
            storage.delete(asset.getStorageKey());
            repo.delete(asset);
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "the uploaded file exceeds the allowed size and was discarded");
        }

        if (actual != asset.getSizeBytes()) {
            storage.delete(asset.getStorageKey());
            repo.delete(asset);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "the uploaded file's size does not match what was declared and it was discarded");
        }

        asset.setSizeBytes(actual);
        asset.setWidth(width);
        asset.setHeight(height);
        asset.setDurationSeconds(durationSeconds);
        asset.setStatus(MediaAsset.STATUS_READY);
        return repo.save(asset);
    }

    /**
     * The tenant's own finished image, for reading its bytes back through the API. Anyone else's
     * id is "not found". Videos are not streamed through the API server (they can be 250 MB and
     * are served from storage directly), so they are refused rather than silently proxied.
     */
    @Transactional(readOnly = true)
    public MediaAsset readableImage(UUID businessProfileId, UUID mediaId) {
        MediaAsset asset = repo.findByMediaIdAndBusinessProfileId(mediaId, businessProfileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "media not found"));
        if (!MediaAsset.STATUS_READY.equals(asset.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "the upload has not finished");
        }
        if (!"image".equals(asset.getKind())) {
            throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                    "only images can be read back through the API");
        }
        return asset;
    }
}
