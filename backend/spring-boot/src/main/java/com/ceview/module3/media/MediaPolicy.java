package com.ceview.module3.media;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * What CeView accepts for upload.
 *
 * <p>The 8 MB image cap is Instagram's limit, the strictest of the three
 * platforms. The 250 MB video cap keeps a single presigned PUT workable and fits
 * short-form video on all three platforms.
 */
public final class MediaPolicy {

    public static final String KIND_IMAGE = "image";
    public static final String KIND_VIDEO = "video";

    public static final long MAX_IMAGE_BYTES = 8L * 1024 * 1024;
    public static final long MAX_VIDEO_BYTES = 250L * 1024 * 1024;

    /** What to do with one accepted content type. */
    public record Rule(String kind, String extension, long maxBytes) {}

    private static final Map<String, Rule> RULES = Map.of(
            "image/jpeg", new Rule(KIND_IMAGE, "jpg", MAX_IMAGE_BYTES),
            "image/png", new Rule(KIND_IMAGE, "png", MAX_IMAGE_BYTES),
            "image/webp", new Rule(KIND_IMAGE, "webp", MAX_IMAGE_BYTES),
            "video/mp4", new Rule(KIND_VIDEO, "mp4", MAX_VIDEO_BYTES),
            "video/quicktime", new Rule(KIND_VIDEO, "mov", MAX_VIDEO_BYTES));

    private MediaPolicy() {}

    public static Optional<Rule> ruleFor(String contentType) {
        if (contentType == null) return Optional.empty();
        return Optional.ofNullable(RULES.get(contentType.trim().toLowerCase(Locale.ROOT)));
    }
}
