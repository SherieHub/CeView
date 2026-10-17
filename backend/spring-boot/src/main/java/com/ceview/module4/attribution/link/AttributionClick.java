package com.ceview.module4.attribution.link;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.Data;

/**
 * One non-bot click on a tracked link. {@link #clickId} is the {@code cv=} value appended to the
 * destination, and the key the hosted enquiry form posts back.
 *
 * <p><b>The ad ids come from platform URL macros, not from the click token.</b> {@code fbclid} and
 * {@code ttclid} are opaque and cannot be decoded into an ad id — the only thing that names the
 * creative is the macro string ({@code {{ad.id}}}, {@code __CID__}) that the platform substitutes
 * at click time. {@link #clickToken} is stored purely so a future Conversions-API tier can report
 * the booking back; nothing reads it today.
 *
 * <p>All three external ids null is an ordinary case, not an error: it means an organic click, or a
 * paid one whose operator never pasted the macros. Such clicks are real evidence of reach and get
 * their own bucket in the rollup rather than being dropped.
 */
@Data
@Entity
@Table(name = "tbl_attribution_click")
public class AttributionClick {

  public static final String PLATFORM_META = "META";
  public static final String PLATFORM_TIKTOK = "TIKTOK";
  public static final String PLATFORM_UNKNOWN = "UNKNOWN";

  @Id
  @Column(name = "click_id")
  private UUID clickId;

  @Column(name = "link_id", nullable = false)
  private UUID linkId;

  @Column(name = "business_profile_id", nullable = false)
  private UUID businessProfileId;

  @Column(name = "external_campaign_id", length = 128)
  private String externalCampaignId;

  @Column(name = "external_adset_id", length = 128)
  private String externalAdsetId;

  @Column(name = "external_ad_id", length = 128)
  private String externalAdId;

  @Column(name = "platform", nullable = false, length = 20)
  private String platform = PLATFORM_UNKNOWN;

  /** Raw fbclid / ttclid. Write-only today; kept for a future CAPI tier. */
  @Column(name = "click_token", columnDefinition = "TEXT")
  private String clickToken;

  @Column(name = "referrer", columnDefinition = "TEXT")
  private String referrer;

  @Column(name = "user_agent", columnDefinition = "TEXT")
  private String userAgent;

  /** Salted hash. The raw address is never persisted. */
  @Column(name = "ip_hash", length = 128)
  private String ipHash;

  /**
   * Whether the click fell inside the link's window. A stale ad still redirects — 404ing a real
   * traveller would be worse than recording a late click — so out-of-window clicks are marked here
   * and excluded from campaign totals rather than refused.
   */
  @Column(name = "in_window", nullable = false)
  private boolean inWindow = true;

  @Column(name = "clicked_at", nullable = false)
  private OffsetDateTime clickedAt;

  /** True when no macro resolved, i.e. the click cannot name a creative. */
  @Transient
  public boolean isUntagged() {
    return externalAdId == null || externalAdId.isBlank();
  }

  @PrePersist
  void onCreate() {
    if (clickId == null) clickId = UUID.randomUUID();
    if (clickedAt == null) clickedAt = OffsetDateTime.now();
    if (platform == null) platform = PLATFORM_UNKNOWN;
  }
}
