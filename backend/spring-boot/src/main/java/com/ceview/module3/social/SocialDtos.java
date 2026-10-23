package com.ceview.module3.social;

import jakarta.validation.constraints.NotBlank;

import java.time.OffsetDateTime;

/** Request/response shapes for /api/social-connections. Nothing here carries a token. */
public final class SocialDtos {

    private SocialDtos() {}

    public static final String STATUS_DISCONNECTED = "DISCONNECTED";
    public static final String STATUS_NEEDS_RECONNECT = "NEEDS_RECONNECT";
    public static final String STATUS_NEEDS_PAGE = "NEEDS_PAGE";
    public static final String STATUS_NO_LINKED_INSTAGRAM = "NO_LINKED_INSTAGRAM";
    public static final String STATUS_ACTIVE = "ACTIVE";

    /**
     * One row of GET /api/social-connections.
     *
     * @param configured whether THIS SERVER has credentials for the platform's app
     * @param handle     the Page name, "@instagram_username", or TikTok display name
     */
    public record SocialConnectionView(String platform, boolean configured, String status,
                                       String handle, OffsetDateTime connectedAt) {}

    /** One selectable Facebook Page. */
    public record PageOption(String id, String name, String instagramUsername) {}

    public record SelectPageRequest(@NotBlank String pageId) {}

    /** Body of POST /tiktok/complete: the code and state TikTok redirected back with. */
    public record TikTokCompleteRequest(@NotBlank String code, @NotBlank String state) {}
}
