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
    public record AdOptions(@NotBlank String objective, @Min(1) long dailyBudgetMinor,
            @NotNull OffsetDateTime startTime, @NotNull OffsetDateTime endTime,
            @NotEmpty @Size(max=30) List<String> countries, @NotNull UUID attributionLinkId, boolean pinCampaign) {}
    public record PostView(UUID id, String date, String platform, String caption, String status,
            String deliveryStatus, String mediaUrl, String mediaType, OffsetDateTime scheduledFor,
            String permalink, String adsManagerUrl, String errorMessage, boolean metricsAvailable,
            Long reach, Long likes, Long comments, Long shares, Double engagementRate, List<Long> series) {}
}
