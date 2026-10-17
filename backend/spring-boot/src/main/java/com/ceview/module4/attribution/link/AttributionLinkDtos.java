package com.ceview.module4.attribution.link;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * The wire shapes shared across the link-attribution feature.
 *
 * <p>These live in one file, defined up front, because the endpoints that use them are built in
 * parallel by different people: the redirect, the operator's link list, the hosted enquiry form and
 * the Performance rollup all have to agree on these without waiting on each other.
 *
 * <p>Nothing here exposes {@code ipHash}, {@code clickToken}, or an enquiry's contact details to a
 * list endpoint. The first two are internal machinery and the third is PII that belongs only in the
 * single-enquiry view.
 */
public final class AttributionLinkDtos {

  private AttributionLinkDtos() {}

  /** The three strings an operator copies out of Content Studio. */
  public record LinkUrls(String linkUrl, String metaAdUrl, String tiktokAdUrl) {}

  /** A link as the operator sees it. */
  public record LinkResponse(
      UUID linkId,
      String slug,
      String category,
      String targetMarket,
      String destinationUrl,
      boolean hosted,
      OffsetDateTime windowStart,
      OffsetDateTime windowEnd,
      LinkUrls urls) {

    public static LinkResponse of(AttributionLink link, LinkUrls urls) {
      return new LinkResponse(
          link.getLinkId(),
          link.getSlug(),
          link.getCategory(),
          link.getTargetMarket(),
          link.getDestinationUrl(),
          link.isHosted(),
          link.getWindowStart(),
          link.getWindowEnd(),
          urls);
    }
  }

  /**
   * Switches a link between tier 1 (operator's own page) and tier 2 (CeView's hosted enquiry page).
   * A null or blank {@code destinationUrl} means hosted.
   */
  public record UpdateDestinationRequest(@Size(max = 2000) String destinationUrl) {}

  /**
   * A click offered to the operator when logging a booking manually.
   *
   * <p>Carries {@code adLabel} rather than a bare id so the picker can say something the operator
   * recognises; an untagged click has no creative to name and says so.
   */
  public record UnconvertedClickResponse(
      UUID clickId,
      UUID linkId,
      String platform,
      String externalAdId,
      String adLabel,
      boolean untagged,
      OffsetDateTime clickedAt) {}

  /**
   * One row of the per-creative rollup.
   *
   * <p>{@code externalAdId} is null for the untagged bucket, which exists on purpose: clicks that
   * arrived without macros are real reach, and dropping them would make the totals disagree with
   * the ad platform's own numbers.
   */
  public record CreativePerformance(
      String externalAdId,
      String adLabel,
      boolean untagged,
      long clicks,
      long conversions,
      BigDecimal revenue) {}

  /** The Performance screen's link panel: one link, its creatives, its totals. */
  public record LinkPerformanceResponse(
      UUID linkId,
      String slug,
      long totalClicks,
      long totalConversions,
      BigDecimal totalRevenue,
      List<CreativePerformance> creatives) {}

  /**
   * A traveller's submission on the hosted enquiry page.
   *
   * <p>{@code clickId} is the {@code cv=} value the redirect appended. It is the only thing tying
   * the submission to an ad — and the only thing stopping this unauthenticated endpoint from being
   * posted to blind, so the service must check it resolves and is in-window, not merely that it is
   * a UUID.
   */
  public record EnquiryRequest(
      @NotNull UUID clickId,
      @NotBlank @Size(max = 200) String contactName,
      @NotBlank @Size(max = 200) String contactValue,
      @Positive @Max(500) Integer partySize,
      LocalDate requestedStart,
      LocalDate requestedEnd,
      @Size(max = 2000) String message) {}

  /**
   * Deliberately thin: this is returned to an unauthenticated browser, so it confirms receipt and
   * nothing else. No enquiry id, no business details, no echo of what was submitted.
   */
  public record EnquiryAck(boolean received) {

    public static EnquiryAck ok() {
      return new EnquiryAck(true);
    }
  }
}
