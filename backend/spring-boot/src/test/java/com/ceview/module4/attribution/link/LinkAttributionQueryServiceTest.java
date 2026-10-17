package com.ceview.module4.attribution.link;

import static org.assertj.core.api.Assertions.assertThat;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.AttributionCode;
import com.ceview.module4.attribution.AttributionCodeService;
import com.ceview.module4.attribution.AttributionRedemption;
import com.ceview.module4.attribution.AttributionRedemptionRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class LinkAttributionQueryServiceTest {

  @Autowired private LinkAttributionQueryService queryService;
  @Autowired private AttributionCodeService codeService;
  @Autowired private AttributionLinkService linkService;
  @Autowired private AttributionClickRepository clicks;
  @Autowired private AttributionRedemptionRepository redemptions;
  @Autowired private BusinessProfileRepository profiles;

  private UUID profileId;
  private UUID codeId;
  private UUID linkId;
  private OffsetDateTime windowOpen;

  @BeforeEach
  void setUp() {
    BusinessProfile profile = new BusinessProfile();
    profile.setUserId(UUID.randomUUID());
    profile.setBusinessName("Test profile");
    profileId = profiles.save(profile).getBusinessProfileId();

    windowOpen = OffsetDateTime.parse("2026-10-19T00:00:00+08:00");
    UUID alertId = UUID.randomUUID();

    AttributionCode code =
        codeService.mintForWindow(profileId, "Resort", "KR", windowOpen, alertId);
    AttributionLink link =
        linkService.mintForWindow(profileId, "Resort", "KR", windowOpen, alertId);
    codeId = code.getAttributionCodeId();
    linkId = link.getLinkId();
  }

  private UUID seedClick(UUID targetLinkId, UUID targetProfileId, String adId, boolean inWindow) {
    AttributionClick click = new AttributionClick();
    click.setBusinessProfileId(targetProfileId);
    click.setLinkId(targetLinkId);
    click.setExternalAdId(adId);
    click.setInWindow(inWindow);
    click.setClickedAt(windowOpen.plusDays(1));
    return clicks.save(click).getClickId();
  }

  private void seedRedemption(
      UUID clickId,
      UUID targetProfileId,
      UUID targetCodeId,
      long bookings,
      double revenue,
      String source) {
    AttributionRedemption r = new AttributionRedemption();
    r.setAttributionCodeId(targetCodeId);
    r.setBusinessProfileId(targetProfileId);
    r.setAttributionClickId(clickId);
    r.setBookings(bookings);
    r.setRevenue(new BigDecimal(String.valueOf(revenue)));
    r.setSource(source);
    if (AttributionRedemption.SOURCE_MANUAL.equals(source)) {
      r.setEventAt(windowOpen.plusDays(2));
    }
    redemptions.save(r);
  }

  @Test
  void canonicalDatasetProvidesAccurateTotalsAndCorrectOrder() {
    // ad-A: 3 clicks, 2 bookings, 1500.50 revenue
    UUID a1 = seedClick(linkId, profileId, "ad-A", true);
    UUID a2 = seedClick(linkId, profileId, "ad-A", true);
    UUID a3 = seedClick(linkId, profileId, "ad-A", true);
    seedRedemption(a1, profileId, codeId, 1, 1000.00, AttributionRedemption.SOURCE_LINK);
    seedRedemption(a2, profileId, codeId, 1, 500.50, AttributionRedemption.SOURCE_LINK);

    // ad-B: 2 clicks, 1 booking, 0.00
    UUID b1 = seedClick(linkId, profileId, "ad-B", true);
    UUID b2 = seedClick(linkId, profileId, "ad-B", true);
    seedRedemption(b1, profileId, codeId, 1, 0.00, AttributionRedemption.SOURCE_LINK);

    // ad-C: 1 click, 0 bookings
    seedClick(linkId, profileId, "ad-C", true);

    // untagged: 2 clicks, 1 booking, 250.00
    UUID u1 = seedClick(linkId, profileId, null, true);
    UUID u2 = seedClick(linkId, profileId, "", true);
    seedRedemption(u1, profileId, codeId, 1, 250.00, AttributionRedemption.SOURCE_LINK);

    // Noise rows
    // Out-of-window ad-A click with 999.00 redemption
    UUID outOfWindow = seedClick(linkId, profileId, "ad-A", false);
    seedRedemption(outOfWindow, profileId, codeId, 1, 999.00, AttributionRedemption.SOURCE_LINK);

    // MANUAL row without clickId
    seedRedemption(null, profileId, codeId, 1, 100.00, AttributionRedemption.SOURCE_MANUAL);

    // Second operator's link/click/redemption
    BusinessProfile otherProfile = new BusinessProfile();
    otherProfile.setUserId(UUID.randomUUID());
    otherProfile.setBusinessName("Other profile");
    UUID otherProfileId = profiles.save(otherProfile).getBusinessProfileId();
    AttributionCode otherCode =
        codeService.mintForWindow(otherProfileId, "Resort", "KR", windowOpen, UUID.randomUUID());
    AttributionLink otherLink =
        linkService.mintForWindow(otherProfileId, "Resort", "KR", windowOpen, UUID.randomUUID());
    UUID otherClick = seedClick(otherLink.getLinkId(), otherProfileId, "ad-A", true);
    seedRedemption(
        otherClick,
        otherProfileId,
        otherCode.getAttributionCodeId(),
        1,
        500.00,
        AttributionRedemption.SOURCE_LINK);

    // Another same-tenant link
    AttributionLink sameTenantOtherLink =
        linkService.mintForWindow(profileId, "Resort", "JP", windowOpen, UUID.randomUUID());
    seedClick(sameTenantOtherLink.getLinkId(), profileId, "ad-A", true);

    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);

    assertThat(res.totalClicks()).isEqualTo(8);
    assertThat(res.totalConversions()).isEqualTo(4);
    assertThat(res.totalRevenue()).isEqualByComparingTo(new BigDecimal("1750.50"));

    assertThat(res.creatives()).hasSize(4);

    // Expected row order: ad-A, ad-B, untagged, ad-C
    assertThat(res.creatives().get(0).externalAdId()).isEqualTo("ad-A");
    assertThat(res.creatives().get(0).clicks()).isEqualTo(3);
    assertThat(res.creatives().get(0).conversions()).isEqualTo(2);
    assertThat(res.creatives().get(0).revenue()).isEqualByComparingTo(new BigDecimal("1500.50"));

    assertThat(res.creatives().get(1).externalAdId()).isEqualTo("ad-B");
    assertThat(res.creatives().get(1).clicks()).isEqualTo(2);
    assertThat(res.creatives().get(1).conversions()).isEqualTo(1);
    assertThat(res.creatives().get(1).revenue()).isEqualByComparingTo(new BigDecimal("0.00"));

    assertThat(res.creatives().get(2).externalAdId()).isNull();
    assertThat(res.creatives().get(2).clicks()).isEqualTo(2);
    assertThat(res.creatives().get(2).conversions()).isEqualTo(1);
    assertThat(res.creatives().get(2).revenue()).isEqualByComparingTo(new BigDecimal("250.00"));
    assertThat(res.creatives().get(2).untagged()).isTrue();
    assertThat(res.creatives().get(2).adLabel()).isEqualTo("Organic / untagged");

    assertThat(res.creatives().get(3).externalAdId()).isEqualTo("ad-C");
    assertThat(res.creatives().get(3).clicks()).isEqualTo(1);
    assertThat(res.creatives().get(3).conversions()).isEqualTo(0);
    assertThat(res.creatives().get(3).revenue()).isEqualByComparingTo(new BigDecimal("0.00"));
  }

  @Test
  void untaggedOnly() {
    seedClick(linkId, profileId, null, true);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.creatives()).hasSize(1);
    assertThat(res.creatives().get(0).externalAdId()).isNull();
  }

  @Test
  void emptyLink() {
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalClicks()).isEqualTo(0);
    assertThat(res.totalConversions()).isEqualTo(0);
    assertThat(res.creatives()).isEmpty();
  }

  @Test
  void noConversionCreative() {
    seedClick(linkId, profileId, "ad-X", true);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalConversions()).isEqualTo(0);
    assertThat(res.creatives().get(0).conversions()).isEqualTo(0);
  }

  @Test
  void zeroRevenueConversion() {
    UUID c = seedClick(linkId, profileId, "ad-X", true);
    seedRedemption(c, profileId, codeId, 1, 0.00, AttributionRedemption.SOURCE_LINK);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalConversions()).isEqualTo(1);
    assertThat(res.totalRevenue()).isEqualByComparingTo(BigDecimal.ZERO);
  }

  @Test
  void outOfWindowExclusion() {
    seedClick(linkId, profileId, "ad-X", false);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalClicks())
        .isEqualTo(0); // Note: countClicksByCreative already filters by inWindow=true
    assertThat(res.creatives()).isEmpty();
  }

  @Test
  void manualFareharborExclusion() {
    UUID c = seedClick(linkId, profileId, "ad-X", true);
    seedRedemption(c, profileId, codeId, 1, 100.0, AttributionRedemption.SOURCE_MANUAL);
    seedRedemption(c, profileId, codeId, 1, 200.0, AttributionRedemption.SOURCE_FAREHARBOR);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalConversions()).isEqualTo(0);
    assertThat(res.totalRevenue()).isEqualByComparingTo(BigDecimal.ZERO);
  }

  @Test
  void otherLinkProfileExclusion() {
    BusinessProfile otherProfile = new BusinessProfile();
    otherProfile.setUserId(UUID.randomUUID());
    otherProfile.setBusinessName("Other profile");
    UUID otherProfileId = profiles.save(otherProfile).getBusinessProfileId();
    AttributionLink otherLink =
        linkService.mintForWindow(otherProfileId, "Resort", "KR", windowOpen, UUID.randomUUID());
    seedClick(otherLink.getLinkId(), otherProfileId, "ad-A", true);

    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalClicks()).isEqualTo(0);
  }

  @Test
  void blankCreativeIdNormalization() {
    seedClick(linkId, profileId, "", true);
    seedClick(linkId, profileId, "   ", true);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.creatives()).hasSize(1);
    assertThat(res.creatives().get(0).externalAdId()).isNull();
    assertThat(res.creatives().get(0).clicks()).isEqualTo(2);
  }

  @Test
  void bookingsAggregation() {
    UUID c = seedClick(linkId, profileId, "ad-X", true);
    seedRedemption(c, profileId, codeId, 5, 0.0, AttributionRedemption.SOURCE_LINK);
    seedRedemption(c, profileId, codeId, 3, 0.0, AttributionRedemption.SOURCE_LINK);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalConversions()).isEqualTo(8);
  }

  @Test
  void decimalArithmetic() {
    UUID c = seedClick(linkId, profileId, "ad-X", true);
    seedRedemption(c, profileId, codeId, 1, 10.10, AttributionRedemption.SOURCE_LINK);
    seedRedemption(c, profileId, codeId, 1, 20.20, AttributionRedemption.SOURCE_LINK);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.totalRevenue()).isEqualByComparingTo(new BigDecimal("30.30"));
  }

  @Test
  void deterministicTies() {
    seedClick(linkId, profileId, "ad-B", true);
    seedClick(linkId, profileId, "ad-A", true);
    AttributionLinkDtos.LinkPerformanceResponse res = queryService.performance(profileId, linkId);
    assertThat(res.creatives()).hasSize(2);
    // conversions are equal, so sorts by adId ascending
    assertThat(res.creatives().get(0).externalAdId()).isEqualTo("ad-A");
    assertThat(res.creatives().get(1).externalAdId()).isEqualTo("ad-B");
  }
}
