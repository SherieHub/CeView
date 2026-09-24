package com.ceview.module4.attribution.link;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module4.attribution.AttributionRedemptionRepository;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import static com.ceview.module4.attribution.link.AttributionLinkDtos.LinkResponse;
import static com.ceview.module4.attribution.link.AttributionLinkDtos.UnconvertedClickResponse;
import static com.ceview.module4.attribution.link.AttributionLinkDtos.UpdateDestinationRequest;

/** Authenticated, tenant-scoped operator controls for link attribution. */
@RestController
@RequestMapping("/api/attribution")
public class AttributionLinkController {

    static final Duration MAX_CLICK_RANGE = Duration.ofDays(31);
    static final int MAX_UNCONVERTED_RESULTS = 100;

    private final CurrentBusinessProfile currentBusinessProfile;
    private final AttributionLinkRepository linkRepo;
    private final AttributionClickRepository clickRepo;
    private final AttributionRedemptionRepository redemptionRepo;
    private final AttributionLinkService linkService;

    public AttributionLinkController(CurrentBusinessProfile currentBusinessProfile,
                                     AttributionLinkRepository linkRepo,
                                     AttributionClickRepository clickRepo,
                                     AttributionRedemptionRepository redemptionRepo,
                                     AttributionLinkService linkService) {
        this.currentBusinessProfile = currentBusinessProfile;
        this.linkRepo = linkRepo;
        this.clickRepo = clickRepo;
        this.redemptionRepo = redemptionRepo;
        this.linkService = linkService;
    }

    @GetMapping("/links")
    @Transactional(readOnly = true)
    public List<LinkResponse> list() {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        return linkRepo.findByBusinessProfileIdOrderByWindowStartDesc(profileId).stream()
                .map(this::responseFor)
                .toList();
    }

    @PatchMapping("/links/{linkId}")
    @Transactional
    public LinkResponse setDestination(@PathVariable UUID linkId,
                                       @Valid @RequestBody UpdateDestinationRequest request) {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        AttributionLink link = linkRepo.findByLinkIdAndBusinessProfileId(linkId, profileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "attribution link not found"));

        link.setDestinationUrl(normalizeDestination(request.destinationUrl()));
        return responseFor(linkRepo.save(link));
    }

    @GetMapping("/clicks/unconverted")
    @Transactional(readOnly = true)
    public List<UnconvertedClickResponse> unconvertedClicks(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to) {
        validateRange(from, to);
        UUID profileId = currentBusinessProfile.resolveProfileId();
        List<AttributionClick> clicks = clickRepo
                .findByBusinessProfileIdAndClickedAtBetweenOrderByClickedAtDesc(profileId, from, to);
        if (clicks.isEmpty()) return List.of();

        List<UUID> clickIds = clicks.stream().map(AttributionClick::getClickId).toList();
        Set<UUID> converted = new HashSet<>(redemptionRepo.findByAttributionClickIdIn(clickIds).stream()
                .map(redemption -> redemption.getAttributionClickId())
                .toList());

        return clicks.stream()
                .filter(click -> !converted.contains(click.getClickId()))
                .limit(MAX_UNCONVERTED_RESULTS)
                .map(AttributionLinkController::unconvertedResponse)
                .toList();
    }

    private LinkResponse responseFor(AttributionLink link) {
        return LinkResponse.of(link, linkService.urlsFor(link));
    }

    private static String normalizeDestination(String value) {
        if (value == null || value.isBlank()) return null;
        String destination = value.trim();
        try {
            URI uri = new URI(destination);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
            if (!(scheme.equals("http") || scheme.equals("https")) || !uri.isAbsolute() || uri.getHost() == null) {
                throw invalidDestination();
            }
            return destination;
        } catch (URISyntaxException e) {
            throw invalidDestination();
        }
    }

    private static ResponseStatusException invalidDestination() {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST, "destinationUrl must be an absolute http or https URL");
    }

    private static void validateRange(OffsetDateTime from, OffsetDateTime to) {
        if (to.isBefore(from)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "to must not be before from");
        }
        if (Duration.between(from, to).compareTo(MAX_CLICK_RANGE) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "click range must not exceed 31 days");
        }
    }

    private static UnconvertedClickResponse unconvertedResponse(AttributionClick click) {
        boolean untagged = click.isUntagged();
        // The Ads APIs are not queried in this feature, so the honest label is
        // derived from the id. A real creative name needs a separate Ads API lookup.
        String adLabel = untagged ? null : "Ad " + click.getExternalAdId();
        return new UnconvertedClickResponse(
                click.getClickId(),
                click.getLinkId(),
                click.getPlatform(),
                click.getExternalAdId(),
                adLabel,
                untagged,
                click.getClickedAt());
    }
}
