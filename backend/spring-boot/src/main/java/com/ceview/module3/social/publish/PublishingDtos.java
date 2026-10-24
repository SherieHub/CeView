package com.ceview.module3.social.publish;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.*;

public final class PublishingDtos {
    private PublishingDtos() {}
    public record PublishRequest(@NotNull UUID requestId, @NotEmpty @Size(max=4) List<String> platforms,
            @NotEmpty Map<String,String> captionsByPlatform, @NotNull UUID mediaId, UUID contentId,
            @Size(max=255) String market, @NotNull String visibility, OffsetDateTime scheduledFor,
            @AssertTrue boolean approved, @Valid AdOptions ad) {}
    /**
     * What the operator chooses for a paid ad. The country and language are not here on purpose: the
     * server derives them from the forecast market, and the end time from {@code startTime} plus
     * {@code durationDays}, so a client cannot aim an ad somewhere the forecast did not point.
     */
    public record AdOptions(@NotBlank String objective, @Min(1) long dailyBudgetMinor,
            @NotNull OffsetDateTime startTime, @Min(1) int durationDays,
            @Valid @Size(max=10) List<AdInterest> interests, boolean advantageAudience,
            @NotNull UUID attributionLinkId, boolean pinCampaign) {}
    /** A Meta interest picked from Meta's own search; the id is what targeting uses. */
    public record AdInterest(@NotBlank @Pattern(regexp="\\d{1,20}") String id, @NotBlank @Size(max=100) String name) {}
    public record PostView(UUID id, String date, String platform, String caption, String status,
            String deliveryStatus, String mediaUrl, String mediaType, OffsetDateTime scheduledFor,
            String permalink, String adsManagerUrl, String errorMessage, boolean metricsAvailable,
            Long reach, Long likes, Long comments, Long shares, Double engagementRate, List<Long> series) {}
}
