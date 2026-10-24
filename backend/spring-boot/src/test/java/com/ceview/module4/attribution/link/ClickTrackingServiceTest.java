package com.ceview.module4.attribution.link;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
        "ceview.attribution.ip-hash-salt=test-click-salt",
        "ceview.attribution.base-url=https://api.example.com",
        "ceview.attribution.enquiry-base-url=https://app.example.com/"
})
@Transactional
class ClickTrackingServiceTest {

    @Autowired private ClickTrackingService service;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AttributionLinkRepository linkRepo;
    @Autowired private AttributionClickRepository clickRepo;

    private UUID profileId;
    private AttributionLink link;

    @BeforeEach
    void setUp() {
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Redirect test profile");
        profileId = profileRepo.save(profile).getBusinessProfileId();
        link = saveLink("svc" + UUID.randomUUID().toString().replace("-", "").substring(0, 8),
                "https://example.com/book", OffsetDateTime.now().minusDays(1), OffsetDateTime.now().plusDays(13));
    }

    @Test
    void metaMacrosPresentAreStoredAndInferMeta() {
        service.capture(link.getSlug(), request(Map.of(
                "cmp", "120210",
                "set", "120211",
                "ad", "120214"), "203.0.113.10", "Mozilla/5.0"));

        AttributionClick click = onlyClick(link);
        assertThat(click.getExternalCampaignId()).isEqualTo("120210");
        assertThat(click.getExternalAdsetId()).isEqualTo("120211");
        assertThat(click.getExternalAdId()).isEqualTo("120214");
        assertThat(click.getPlatform()).isEqualTo(AttributionClick.PLATFORM_META);
    }

    @Test
    void tiktokMacrosPresentAreStoredAndInferTiktok() {
        service.capture(link.getSlug(), request(Map.of(
                "cmp", "__991__",
                "set", "__881__",
                "ad", "__771__"), "203.0.113.11", "Mozilla/5.0"));

        AttributionClick click = onlyClick(link);
        assertThat(click.getExternalCampaignId()).isEqualTo("991");
        assertThat(click.getExternalAdsetId()).isEqualTo("881");
        assertThat(click.getExternalAdId()).isEqualTo("771");
        assertThat(click.getPlatform()).isEqualTo(AttributionClick.PLATFORM_TIKTOK);
    }

    @Test
    void noMacroParamsAreUntaggedAndUnknown() {
        service.capture(link.getSlug(), request(Map.of(), "203.0.113.12", "Mozilla/5.0"));

        AttributionClick click = onlyClick(link);
        assertThat(click.getExternalCampaignId()).isNull();
        assertThat(click.getExternalAdsetId()).isNull();
        assertThat(click.getExternalAdId()).isNull();
        assertThat(click.getPlatform()).isEqualTo(AttributionClick.PLATFORM_UNKNOWN);
        assertThat(click.isUntagged()).isTrue();
    }

    @Test
    void unsubstitutedMacrosAreAbsentNotLiteralIds() {
        service.capture(link.getSlug(), request(Map.of(
                "cmp", "{{campaign.id}}",
                "set", "__AID__",
                "ad", "{{ad.id}}"), "203.0.113.13", "Mozilla/5.0"));

        AttributionClick click = onlyClick(link);
        assertThat(click.getExternalCampaignId()).isNull();
        assertThat(click.getExternalAdsetId()).isNull();
        assertThat(click.getExternalAdId()).isNull();
        assertThat(click.getPlatform()).isEqualTo(AttributionClick.PLATFORM_UNKNOWN);
        assertThat(click.isUntagged()).isTrue();
    }

    @Test
    void fbclidIsCapturedAsClickToken() {
        service.capture(link.getSlug(), request(Map.of("fbclid", "IwAR2xQtest"), "203.0.113.14", "Mozilla/5.0"));

        assertThat(onlyClick(link).getClickToken()).isEqualTo("IwAR2xQtest");
    }

    @Test
    void ipIsHashedAndRawAddressIsNeverStored() {
        service.capture(link.getSlug(), request(Map.of(), "203.0.113.15", "Mozilla/5.0"));

        AttributionClick click = onlyClick(link);
        assertThat(click.getIpHash()).isNotBlank();
        assertThat(click.getIpHash()).isNotEqualTo("203.0.113.15");
    }

    @Test
    void sameIpAndLinkInsideDebounceWindowWritesNoSecondRow() {
        service.capture(link.getSlug(), request(Map.of("ad", "120214"), "203.0.113.16", "Mozilla/5.0"));
        service.capture(link.getSlug(), request(Map.of("ad", "120215"), "203.0.113.16", "Mozilla/5.0"));

        assertThat(clickRepo.findByLinkIdOrderByClickedAtDesc(link.getLinkId())).hasSize(1);
    }

    @Test
    void repeatClickInsideDebounceWindowReusesTheFirstClickIdSoTheFormStillLoads() {
        ClickTrackingService.RedirectDecision first = service.capture(link.getSlug(),
                request(Map.of("ad", "120214"), "203.0.113.20", "Mozilla/5.0")).orElseThrow();
        ClickTrackingService.RedirectDecision repeat = service.capture(link.getSlug(),
                request(Map.of("ad", "120214"), "203.0.113.20", "Mozilla/5.0")).orElseThrow();

        assertThat(first.clickRecorded()).isTrue();
        assertThat(repeat.clickRecorded()).isFalse();
        assertThat(repeat.clickId()).isEqualTo(first.clickId());
        assertThat(repeat.location()).isEqualTo(first.location()).contains("cv=" + first.clickId());
        assertThat(clickRepo.findByLinkIdOrderByClickedAtDesc(link.getLinkId())).hasSize(1);
    }

    @Test
    void repeatClickOnAHostedLinkStillReachesTheEnquiryForm() {
        AttributionLink hosted = saveLink("rep" + UUID.randomUUID().toString().replace("-", "").substring(0, 8),
                null, OffsetDateTime.now().minusDays(4), OffsetDateTime.now().plusDays(13));

        ClickTrackingService.RedirectDecision first = service.capture(hosted.getSlug(),
                request(Map.of(), "203.0.113.21", "Mozilla/5.0")).orElseThrow();
        ClickTrackingService.RedirectDecision repeat = service.capture(hosted.getSlug(),
                request(Map.of(), "203.0.113.21", "Mozilla/5.0")).orElseThrow();

        assertThat(repeat.location()).startsWith("https://app.example.com/enquiry?cv=" + first.clickId());
    }

    @Test
    void botUserAgentGetsTheDestinationWithoutAClickId() {
        ClickTrackingService.RedirectDecision decision = service.capture(link.getSlug(),
                request(Map.of(), "203.0.113.22", "facebookexternalhit/1.1")).orElseThrow();

        assertThat(decision.clickRecorded()).isFalse();
        assertThat(decision.clickId()).isNull();
        assertThat(decision.location()).doesNotContain("cv=");
    }

    @Test
    void botUserAgentWritesNoRow() {
        service.capture(link.getSlug(), request(Map.of("ad", "120214"), "203.0.113.17", "facebookexternalhit/1.1"));

        assertThat(clickRepo.findByLinkIdOrderByClickedAtDesc(link.getLinkId())).isEmpty();
    }

    @Test
    void clickAfterWindowEndIsStillRecordedOutOfWindow() {
        AttributionLink closed = saveLink("old" + UUID.randomUUID().toString().replace("-", "").substring(0, 8),
                "https://example.com/closed", OffsetDateTime.now().minusDays(20), OffsetDateTime.now().minusDays(1));

        ClickTrackingService.RedirectDecision decision = service.capture(closed.getSlug(),
                request(Map.of("ad", "120214"), "203.0.113.18", "Mozilla/5.0")).orElseThrow();

        AttributionClick click = onlyClick(closed);
        assertThat(decision.location()).contains("cv=" + click.getClickId());
        assertThat(click.isInWindow()).isFalse();
    }

    @Test
    void hostedLinkRedirectsToTheFrontendEnquiryPageNotTheApiOrigin() {
        AttributionLink hosted = saveLink("host" + UUID.randomUUID().toString().replace("-", "").substring(0, 8),
                null, OffsetDateTime.now().minusDays(3), OffsetDateTime.now().plusDays(13));

        ClickTrackingService.RedirectDecision decision = service.capture(hosted.getSlug(),
                request(Map.of(), "203.0.113.19", "Mozilla/5.0")).orElseThrow();

        AttributionClick click = onlyClick(hosted);
        assertThat(decision.location()).isEqualTo("https://app.example.com/enquiry?cv=" + click.getClickId());
    }

    private ClickTrackingService.ClickRequest request(Map<String, String> params, String ip, String userAgent) {
        return new ClickTrackingService.ClickRequest(params, userAgent, "https://referrer.example", ip);
    }

    private AttributionClick onlyClick(AttributionLink target) {
        java.util.List<AttributionClick> clicks = clickRepo.findByLinkIdOrderByClickedAtDesc(target.getLinkId());
        assertThat(clicks).hasSize(1);
        return clicks.get(0);
    }

    private AttributionLink saveLink(String slug, String destination, OffsetDateTime start, OffsetDateTime end) {
        AttributionLink newLink = new AttributionLink();
        newLink.setBusinessProfileId(profileId);
        newLink.setDemandAlertId(UUID.randomUUID());
        newLink.setCategory("Coastal & Island");
        newLink.setTargetMarket("KR");
        newLink.setSlug(slug);
        newLink.setDestinationUrl(destination);
        newLink.setWindowStart(start);
        newLink.setWindowEnd(end);
        return linkRepo.save(newLink);
    }
}

