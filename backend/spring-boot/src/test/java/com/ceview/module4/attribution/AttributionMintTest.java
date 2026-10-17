package com.ceview.module4.attribution;

import static org.junit.jupiter.api.Assertions.*;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.link.AdUrlBuilder;
import com.ceview.module4.attribution.link.AttributionLink;
import com.ceview.module4.attribution.link.AttributionLinkRepository;
import com.ceview.module4.attribution.link.AttributionLinkService;
import com.ceview.module4.attribution.link.SlugGenerator;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * The foundation both attribution paths rest on: every surge window gets exactly one code and one
 * link, and neither changes underneath content that has already been published.
 *
 * <p>That second property is the reason these are keyed on the window tuple rather than on {@code
 * demandAlertId}. {@code ForecastingService.persistDemandAlert} deletes and re-inserts the alert
 * row on every pipeline run, so an alert-keyed mint would hand the operator a new code and a new
 * slug on each run — breaking a caption already posted and, worse, a link already live inside a
 * running paid ad. {@link #aPipelineRerunKeepsTheSameCodeAndSlug} is the regression guard for
 * exactly that.
 */
@SpringBootTest
class AttributionMintTest {

  @Autowired private AttributionCodeService codeService;
  @Autowired private AttributionLinkService linkService;
  @Autowired private AttributionCodeRepository codeRepo;
  @Autowired private AttributionLinkRepository linkRepo;
  @Autowired private BusinessProfileRepository profileRepo;
  @Autowired private SlugGenerator slugGenerator;
  @Autowired private AdUrlBuilder adUrlBuilder;

  private UUID profileId;
  private OffsetDateTime windowOpen;

  @BeforeEach
  void setUp() {
    linkRepo.deleteAll();
    codeRepo.deleteAll();
    profileRepo.deleteAll();

    BusinessProfile profile = new BusinessProfile();
    profile.setUserId(UUID.randomUUID());
    profile.setBusinessName("Kasa Beach Resort");
    profileId = profileRepo.save(profile).getBusinessProfileId();

    windowOpen = OffsetDateTime.parse("2026-10-19T00:00:00+08:00");
  }

  @Test
  void mintingAWindowProducesOneCodeAndOneLink() {
    UUID alertId = UUID.randomUUID();

    AttributionCode code =
        codeService.mintForWindow(profileId, "Resort", "KR", windowOpen, alertId);
    AttributionLink link =
        linkService.mintForWindow(profileId, "Resort", "KR", windowOpen, alertId);

    assertEquals(1, codeRepo.count());
    assertEquals(1, linkRepo.count());

    assertEquals(alertId, code.getDemandAlertId());
    assertEquals(alertId, link.getDemandAlertId());

    // Both cover the same window, or the two evidence paths would disagree
    // about which bookings belong to the campaign.
    assertEquals(code.getWindowStart(), link.getWindowStart());
    assertEquals(code.getWindowEnd(), link.getWindowEnd());
    assertEquals(windowOpen.plusDays(AttributionWindow.WINDOW_DAYS), code.getWindowEnd());
  }

  @Test
  void aNewLinkDefaultsToTheHostedEnquiryPage() {
    AttributionLink link =
        linkService.mintForWindow(profileId, "Resort", "KR", windowOpen, UUID.randomUUID());

    // Null destination = CeView hosts the page. This is the default that
    // works for an operator who has no website to point at.
    assertNull(link.getDestinationUrl());
    assertTrue(link.isHosted());
  }

  @Test
  void aPipelineRerunKeepsTheSameCodeAndSlug() {
    UUID firstAlertId = UUID.randomUUID();
    AttributionCode firstCode =
        codeService.mintForWindow(profileId, "Resort", "KR", windowOpen, firstAlertId);
    AttributionLink firstLink =
        linkService.mintForWindow(profileId, "Resort", "KR", windowOpen, firstAlertId);

    // The pipeline runs again: the alert row is deleted and re-inserted, so
    // the same window arrives carrying a different alert id.
    UUID secondAlertId = UUID.randomUUID();
    AttributionCode secondCode =
        codeService.mintForWindow(profileId, "Resort", "KR", windowOpen, secondAlertId);
    AttributionLink secondLink =
        linkService.mintForWindow(profileId, "Resort", "KR", windowOpen, secondAlertId);

    assertEquals(1, codeRepo.count(), "a rerun must not mint a second code for the same window");
    assertEquals(1, linkRepo.count(), "a rerun must not mint a second link for the same window");

    // The strings an operator has already published are untouched.
    assertEquals(firstCode.getCode(), secondCode.getCode());
    assertEquals(firstLink.getSlug(), secondLink.getSlug());
    assertEquals(firstLink.getLinkId(), secondLink.getLinkId());

    // But both now point at the alert that actually exists.
    assertEquals(
        secondAlertId,
        codeRepo.findById(firstCode.getAttributionCodeId()).orElseThrow().getDemandAlertId());
    assertEquals(
        secondAlertId, linkRepo.findById(firstLink.getLinkId()).orElseThrow().getDemandAlertId());
  }

  @Test
  void differentMarketsInTheSameWindowGetTheirOwnCodeAndLink() {
    codeService.mintForWindow(profileId, "Resort", "KR", windowOpen, UUID.randomUUID());
    codeService.mintForWindow(profileId, "Resort", "JP", windowOpen, UUID.randomUUID());
    linkService.mintForWindow(profileId, "Resort", "KR", windowOpen, UUID.randomUUID());
    linkService.mintForWindow(profileId, "Resort", "JP", windowOpen, UUID.randomUUID());

    assertEquals(2, codeRepo.count());
    assertEquals(2, linkRepo.count());
  }

  @Test
  void theCodeIsDerivedAndSayable() {
    AttributionCode code =
        codeService.mintForWindow(profileId, "Dive Shop", "KR", windowOpen, UUID.randomUUID());

    // Derived on purpose: a customer has to be able to say it out loud.
    assertEquals("KR-DIVE-1019", code.getCode());
  }

  @Test
  void aCodeCollisionIsSuffixedRatherThanThrowing() {
    // Two categories sharing a four-letter prefix in the same market and
    // window. A raw constraint violation here would roll back the entire
    // forecasting transaction, not just this code.
    AttributionCode first =
        codeService.mintForWindow(profileId, "Dive Shop", "KR", windowOpen, UUID.randomUUID());
    AttributionCode second =
        codeService.mintForWindow(profileId, "Dive Resort", "KR", windowOpen, UUID.randomUUID());

    assertEquals("KR-DIVE-1019", first.getCode());
    assertEquals("KR-DIVE-1019-2", second.getCode());
  }

  @Test
  void theSlugIsRandomNotDerived() {
    // Unlike the code: a derived slug would let anyone enumerate other
    // operators' live campaigns, and the redirect cannot be tenant-scoped.
    Set<String> slugs = new HashSet<>();
    for (int i = 0; i < 500; i++) {
      slugs.add(slugGenerator.generate());
    }
    assertEquals(500, slugs.size(), "slugs collided far above the expected rate");

    for (String slug : slugs) {
      assertEquals(8, slug.length());
      // No 0/O or 1/I/l: these get retyped off screens and read aloud.
      assertFalse(slug.matches(".*[01OIl].*"), "ambiguous character in slug: " + slug);
    }
  }

  @Test
  void theAdUrlCarriesTheMacrosThatNameTheCreative() {
    AttributionLink link =
        linkService.mintForWindow(profileId, "Resort", "KR", windowOpen, UUID.randomUUID());

    var urls = linkService.urlsFor(link);

    assertTrue(urls.linkUrl().endsWith("/r/" + link.getSlug()));

    // Without these, a click cannot name a creative at all — fbclid is
    // opaque and ttclid is no better.
    assertTrue(urls.metaAdUrl().contains("ad={{ad.id}}"));
    assertTrue(urls.metaAdUrl().contains("cmp={{campaign.id}}"));
    assertTrue(urls.tiktokAdUrl().contains("ad=__CID__"));
    assertTrue(urls.tiktokAdUrl().contains("cmp=__CAMPAIGN_ID__"));

    assertEquals(adUrlBuilder.linkUrl(link.getSlug()), urls.linkUrl());
  }
}
