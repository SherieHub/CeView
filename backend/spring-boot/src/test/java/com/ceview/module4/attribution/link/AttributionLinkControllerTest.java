package com.ceview.module4.attribution.link;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.AttributionRedemption;
import com.ceview.module4.attribution.AttributionRedemptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AttributionLinkControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AttributionLinkRepository linkRepo;
    @Autowired private AttributionClickRepository clickRepo;
    @Autowired private AttributionRedemptionRepository redemptionRepo;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    private String tokenA;
    private String tokenB;
    private UUID profileA;
    private UUID profileB;
    private AttributionLink olderA;
    private AttributionLink newerA;
    private AttributionLink linkB;

    private static final OffsetDateTime NOW =
            OffsetDateTime.of(2026, 9, 20, 12, 0, 0, 0, ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        redemptionRepo.deleteAll();
        clickRepo.deleteAll();
        linkRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorA = UUID.randomUUID();
        UUID operatorB = UUID.randomUUID();
        testOperators.create(operatorA);
        testOperators.create(operatorB);
        tokenA = jwtService.issue(operatorA, "operator-a@example.com");
        tokenB = jwtService.issue(operatorB, "operator-b@example.com");

        profileA = saveProfile(operatorA, "Operator A");
        profileB = saveProfile(operatorB, "Operator B");

        olderA = saveLink(profileA, "olderaaa", NOW.minusDays(14), "https://example.com/old");
        newerA = saveLink(profileA, "neweraaa", NOW, null);
        linkB = saveLink(profileB, "tenantbb", NOW.plusDays(1), "https://example.com/b");
    }

    @Test
    void listsOnlyTheAuthenticatedOperatorsLinksNewestFirst() throws Exception {
        mvc.perform(get("/api/attribution/links").header("Authorization", bearer(tokenA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].linkId").value(newerA.getLinkId().toString()))
                .andExpect(jsonPath("$[1].linkId").value(olderA.getLinkId().toString()))
                .andExpect(jsonPath("$[0].urls.metaAdUrl").value(org.hamcrest.Matchers.containsString("{{ad.id}}")));
    }

    @Test
    void secondOperatorCannotReadTheFirstOperatorsLinks() throws Exception {
        mvc.perform(get("/api/attribution/links").header("Authorization", bearer(tokenB)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].linkId").value(linkB.getLinkId().toString()));
    }

    @Test
    void ownerCanSetAnAbsoluteHttpDestination() throws Exception {
        mvc.perform(patch("/api/attribution/links/{linkId}", newerA.getLinkId())
                        .header("Authorization", bearer(tokenA))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"destinationUrl\":\" https://operator.example/book \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hosted").value(false))
                .andExpect(jsonPath("$.destinationUrl").value("https://operator.example/book"));
    }

    @Test
    void nullOrBlankDestinationSwitchesToTheHostedPage() throws Exception {
        for (String body : new String[]{"{\"destinationUrl\":null}", "{\"destinationUrl\":\"   \"}"}) {
            mvc.perform(patch("/api/attribution/links/{linkId}", olderA.getLinkId())
                            .header("Authorization", bearer(tokenA))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.hosted").value(true))
                    .andExpect(jsonPath("$.destinationUrl").doesNotExist());
        }
    }

    @Test
    void unsafeDestinationsAreRejectedWithoutChangingTheLink() throws Exception {
        for (String unsafe : new String[]{"/relative/path", "javascript:alert(1)"}) {
            mvc.perform(patch("/api/attribution/links/{linkId}", olderA.getLinkId())
                            .header("Authorization", bearer(tokenA))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"destinationUrl\":\"" + unsafe + "\"}"))
                    .andExpect(status().isBadRequest());

            org.junit.jupiter.api.Assertions.assertEquals(
                    "https://example.com/old",
                    linkRepo.findById(olderA.getLinkId()).orElseThrow().getDestinationUrl());
        }
    }

    @Test
    void patchingAnotherOperatorsLinkReturnsNotFound() throws Exception {
        mvc.perform(patch("/api/attribution/links/{linkId}", newerA.getLinkId())
                        .header("Authorization", bearer(tokenB))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"destinationUrl\":\"https://hijack.example\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void unconvertedClicksAreTenantScopedInRangeAndExcludeConvertedClicks() throws Exception {
        AttributionClick tagged = saveClick(profileA, newerA.getLinkId(), "120214", NOW.minusHours(1));
        AttributionClick untagged = saveClick(profileA, newerA.getLinkId(), null, NOW.minusHours(2));
        AttributionClick converted = saveClick(profileA, newerA.getLinkId(), "120215", NOW.minusHours(3));
        saveClick(profileA, newerA.getLinkId(), "too-old", NOW.minusDays(3));
        saveClick(profileB, linkB.getLinkId(), "other-tenant", NOW.minusHours(1));
        saveRedemption(profileA, converted.getClickId());

        mvc.perform(get("/api/attribution/clicks/unconverted")
                        .header("Authorization", bearer(tokenA))
                        .param("from", NOW.minusDays(1).toString())
                        .param("to", NOW.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].clickId").value(tagged.getClickId().toString()))
                .andExpect(jsonPath("$[0].adLabel").value("Ad 120214"))
                .andExpect(jsonPath("$[0].untagged").value(false))
                .andExpect(jsonPath("$[1].clickId").value(untagged.getClickId().toString()))
                .andExpect(jsonPath("$[1].adLabel").doesNotExist())
                .andExpect(jsonPath("$[1].untagged").value(true));
    }

    @Test
    void unconvertedClicksRequireAValidBoundedRange() throws Exception {
        mvc.perform(get("/api/attribution/clicks/unconverted")
                        .header("Authorization", bearer(tokenA)))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/api/attribution/clicks/unconverted")
                        .header("Authorization", bearer(tokenA))
                        .param("from", NOW.minusDays(32).toString())
                        .param("to", NOW.toString()))
                .andExpect(status().isBadRequest());
    }

    private UUID saveProfile(UUID operatorId, String name) {
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName(name);
        return profileRepo.save(profile).getBusinessProfileId();
    }

    private AttributionLink saveLink(UUID profileId, String slug, OffsetDateTime start, String destination) {
        AttributionLink link = new AttributionLink();
        link.setBusinessProfileId(profileId);
        link.setDemandAlertId(UUID.randomUUID());
        link.setCategory("Coastal & Island");
        link.setTargetMarket("korea");
        link.setSlug(slug);
        link.setDestinationUrl(destination);
        link.setWindowStart(start);
        link.setWindowEnd(start.plusDays(14));
        return linkRepo.save(link);
    }

    private AttributionClick saveClick(UUID profileId, UUID linkId, String adId, OffsetDateTime clickedAt) {
        AttributionClick click = new AttributionClick();
        click.setBusinessProfileId(profileId);
        click.setLinkId(linkId);
        click.setExternalAdId(adId);
        click.setPlatform(adId == null ? AttributionClick.PLATFORM_UNKNOWN : AttributionClick.PLATFORM_META);
        click.setClickedAt(clickedAt);
        return clickRepo.save(click);
    }

    private void saveRedemption(UUID profileId, UUID clickId) {
        AttributionRedemption redemption = new AttributionRedemption();
        redemption.setAttributionCodeId(UUID.randomUUID());
        redemption.setBusinessProfileId(profileId);
        redemption.setSource(AttributionRedemption.SOURCE_LINK);
        redemption.setEventAt(NOW.minusMinutes(10));
        redemption.setBookings(1);
        redemption.setRevenue(BigDecimal.TEN);
        redemption.setAttributionClickId(clickId);
        redemptionRepo.save(redemption);
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
