package com.ceview.module4.attribution.link;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.AttributionRedemptionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class RedirectControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AttributionLinkRepository linkRepo;
    @Autowired private AttributionClickRepository clickRepo;
    @Autowired private AttributionEnquiryRepository enquiryRepo;
    @Autowired private AttributionRedemptionRepository redemptionRepo;

    private UUID profileId;

    @BeforeEach
    void setUp() {
        redemptionRepo.deleteAll();
        enquiryRepo.deleteAll();
        clickRepo.deleteAll();
        linkRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Redirect controller profile");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void knownSlugRedirectsAndAppendsClickIdWithoutJwt() throws Exception {
        saveLink("knownabc", "https://example.com/book", OffsetDateTime.now().minusDays(1), OffsetDateTime.now().plusDays(13));

        mvc.perform(get("/r/knownabc"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location", org.hamcrest.Matchers.containsString("https://example.com/book?cv=")));

        assertThat(clickRepo.findAll()).hasSize(1);
    }

    @Test
    void existingQueryStringGetsAmpersandAndOnlyOneQuestionMark() throws Exception {
        saveLink("queryabc", "https://example.com/book?ref=ig", OffsetDateTime.now().minusDays(1), OffsetDateTime.now().plusDays(13));

        MvcResult result = mvc.perform(get("/r/queryabc"))
                .andExpect(status().isFound())
                .andReturn();

        String location = result.getResponse().getHeader("Location");
        assertThat(location).contains("https://example.com/book?ref=ig&cv=");
        assertThat(location.chars().filter(ch -> ch == '?').count()).isEqualTo(1);
    }

    @Test
    void fragmentStaysAfterClickId() throws Exception {
        saveLink("fragabc", "https://example.com/book#deals", OffsetDateTime.now().minusDays(1), OffsetDateTime.now().plusDays(13));

        MvcResult result = mvc.perform(get("/r/fragabc"))
                .andExpect(status().isFound())
                .andReturn();

        String location = result.getResponse().getHeader("Location");
        assertThat(location).contains("https://example.com/book?cv=");
        assertThat(location).endsWith("#deals");
        assertThat(location.indexOf("cv=")).isLessThan(location.indexOf("#deals"));
    }

    @Test
    void unknownSlugReturnsNotFound() throws Exception {
        mvc.perform(get("/r/missing"))
                .andExpect(status().isNotFound());
    }

    @Test
    void closedWindowSlugStillRedirectsAndRecordsOutOfWindow() throws Exception {
        AttributionLink link = saveLink("closedab", "https://example.com/closed",
                OffsetDateTime.now().minusDays(20), OffsetDateTime.now().minusDays(1));

        mvc.perform(get("/r/closedab"))
                .andExpect(status().isFound());

        AttributionClick click = clickRepo.findByLinkIdOrderByClickedAtDesc(link.getLinkId()).get(0);
        assertThat(click.isInWindow()).isFalse();
    }

    @Test
    void noAuthorizationHeaderIsNotUnauthorized() throws Exception {
        saveLink("nojwtabc", "https://example.com/book", OffsetDateTime.now().minusDays(1), OffsetDateTime.now().plusDays(13));

        mvc.perform(get("/r/nojwtabc"))
                .andExpect(status().isFound());
    }

    @Test
    void overTheRateLimitStillRedirectsTheTravellerButRecordsNoClick() throws Exception {
        AttributionLink link = saveLink("limitabc", "https://example.com/book",
                OffsetDateTime.now().minusDays(1), OffsetDateTime.now().plusDays(13));
        String address = UUID.randomUUID().toString();

        for (int i = 0; i < AttributionRateLimiter.REQUESTS_PER_MINUTE; i++) {
            mvc.perform(get("/r/limitabc").with(req -> { req.setRemoteAddr(address); return req; }))
                    .andExpect(status().isFound());
        }
        MvcResult over = mvc.perform(get("/r/limitabc").with(req -> { req.setRemoteAddr(address); return req; }))
                .andExpect(status().isFound())
                .andReturn();

        // Repeats inside the limit reuse the first click's id; past it nothing is looked up or written.
        assertThat(over.getResponse().getHeader("Location")).isEqualTo("https://example.com/book");
        assertThat(clickRepo.findByLinkIdOrderByClickedAtDesc(link.getLinkId())).hasSize(1);
    }

    private AttributionLink saveLink(String slug, String destination, OffsetDateTime start, OffsetDateTime end) {
        AttributionLink link = new AttributionLink();
        link.setBusinessProfileId(profileId);
        link.setDemandAlertId(UUID.randomUUID());
        link.setCategory("Coastal & Island");
        link.setTargetMarket("KR");
        link.setSlug(slug);
        link.setDestinationUrl(destination);
        link.setWindowStart(start);
        link.setWindowEnd(end);
        return linkRepo.save(link);
    }
}
