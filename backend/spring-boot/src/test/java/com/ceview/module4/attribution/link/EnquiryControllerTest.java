package com.ceview.module4.attribution.link;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.*;
import com.ceview.testsupport.TestOperators;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class EnquiryControllerTest {
    private static final String PUBLIC = "/api/public/attribution/enquiries";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AttributionClickRepository clicks;
    @Autowired AttributionLinkRepository links;
    @Autowired AttributionEnquiryRepository enquiries;
    @Autowired AttributionCodeRepository codes;
    @SpyBean AttributionRedemptionRepository redemptions;
    @Autowired AttributionCodeService codeService;
    @Autowired AttributionLinkService linkService;
    @Autowired BusinessProfileRepository profiles;
    @Autowired JwtService jwt;
    @Autowired TestOperators operators;
    @Autowired EnquiryService service;
    UUID clickId;
    UUID profileId;
    UUID operatorId;
    AttributionLink link;
    String address;

    @BeforeEach
    void seed() {
        redemptions.deleteAll();
        enquiries.deleteAll();
        clicks.deleteAll();
        links.deleteAll();
        codes.deleteAll();
        operatorId = operators.create(UUID.randomUUID());
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Kasa Beach Resort");
        profile.setBusinessDescription("Private operator details");
        profileId = profiles.saveAndFlush(profile).getBusinessProfileId();
        OffsetDateTime start = OffsetDateTime.now().minusDays(1);
        codeService.mintForWindow(profileId, "Resort", "KR", start, UUID.randomUUID());
        link = linkService.mintForWindow(profileId, "Resort", "KR", start, UUID.randomUUID());
        AttributionClick click = new AttributionClick();
        click.setLinkId(link.getLinkId());
        click.setBusinessProfileId(profileId);
        clickId = clicks.saveAndFlush(click).getClickId();
        address = UUID.randomUUID().toString();
    }

    Map<String, Object> body(UUID id) {
        Map<String, Object> body = new HashMap<>();
        body.put("clickId", id);
        body.put("contactName", "Traveller");
        body.put("contactValue", "traveller@example.com");
        return body;
    }

    MockHttpServletRequestBuilder request(Map<String, Object> body) throws Exception {
        return post(PUBLIC).contentType("application/json").content(mapper.writeValueAsString(body))
                .with(req -> { req.setRemoteAddr(address); return req; });
    }

    @Test
    void publicSubmissionPersistsOneEnquiryAndZeroRevenueConversion() throws Exception {
        mvc.perform(request(body(clickId))).andExpect(status().isOk())
                .andExpect(content().json("{\"received\":true}", true));
        assertEquals(1, enquiries.count());
        assertEquals(profileId, enquiries.findAll().get(0).getBusinessProfileId());
        var redemption = redemptions.findAll().get(0);
        assertEquals(1, redemptions.count());
        assertEquals(clickId, redemption.getAttributionClickId());
        assertEquals(profileId, redemption.getBusinessProfileId());
        assertEquals("LINK", redemption.getSource());
        assertEquals(1, redemption.getBookings());
        assertEquals(0, BigDecimal.ZERO.compareTo(redemption.getRevenue()));
        assertNotNull(redemption.getEventAt());
        assertEquals(codes.findAll().get(0).getAttributionCodeId(), redemption.getAttributionCodeId());
    }

    @Test
    void unknownExpiredAndAlreadyUsedHaveIdenticalResponses() throws Exception {
        String unknown = mvc.perform(request(body(UUID.randomUUID()))).andExpect(status().isBadRequest())
                .andReturn().getResponse().getContentAsString();
        link.setWindowEnd(OffsetDateTime.now().minusMinutes(1));
        links.saveAndFlush(link);
        mvc.perform(request(body(clickId))).andExpect(status().isBadRequest()).andExpect(content().string(unknown));
        assertEquals(0, enquiries.count());
        assertEquals(0, redemptions.count());
        link.setWindowEnd(OffsetDateTime.now().plusDays(1));
        links.saveAndFlush(link);
        mvc.perform(request(body(clickId))).andExpect(status().isOk());
        mvc.perform(request(body(clickId))).andExpect(status().isBadRequest()).andExpect(content().string(unknown));
        assertEquals(1, enquiries.count());
        assertEquals(1, redemptions.count());
    }

    @Test
    void aPreviouslyRedeemedClickCannotSubmit() throws Exception {
        AttributionRedemption redemption = new AttributionRedemption();
        redemption.setAttributionCodeId(codes.findAll().get(0).getAttributionCodeId());
        redemption.setBusinessProfileId(profileId);
        redemption.setSource("LINK");
        redemption.setAttributionClickId(clickId);
        redemption.setBookings(1);
        redemptions.saveAndFlush(redemption);
        mvc.perform(request(body(clickId))).andExpect(status().isBadRequest())
                .andExpect(content().json("{\"error\":\"Unable to process this enquiry.\"}", true));
        assertEquals(0, enquiries.count());
        assertEquals(1, redemptions.count());
    }

    @Test
    void validatesRequiredFieldsSizesAndPartyLimits() throws Exception {
        for (String field : new String[]{"clickId", "contactName", "contactValue"}) {
            var input = body(clickId);
            input.remove(field);
            mvc.perform(request(input)).andExpect(status().isBadRequest());
        }
        for (int size : new int[]{0, 501}) {
            var input = body(clickId);
            input.put("partySize", size);
            mvc.perform(request(input)).andExpect(status().isBadRequest());
        }
        for (String field : new String[]{"contactName", "contactValue", "message"}) {
            var input = body(clickId);
            input.put(field, "x".repeat(field.equals("message") ? 2001 : 201));
            mvc.perform(request(input)).andExpect(status().isBadRequest());
        }
        assertEquals(0, enquiries.count());
        assertEquals(0, redemptions.count());
    }

    @Test
    void contextExposesOnlyBusinessNameAndRejectsUsedOrUnknownClicks() throws Exception {
        mvc.perform(get(PUBLIC + "/context").param("cv", clickId.toString()))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(content().json("{\"businessName\":\"Kasa Beach Resort\"}", true));
        String unknown = mvc.perform(get(PUBLIC + "/context").param("cv", UUID.randomUUID().toString()))
                .andExpect(status().isBadRequest()).andReturn().getResponse().getContentAsString();
        mvc.perform(request(body(clickId))).andExpect(status().isOk());
        mvc.perform(get(PUBLIC + "/context").param("cv", clickId.toString()))
                .andExpect(status().isBadRequest()).andExpect(content().string(unknown));
    }

    @Test
    void operatorReadRequiresJwtAndDoesNotLeakAcrossTenants() throws Exception {
        mvc.perform(request(body(clickId))).andExpect(status().isOk());
        mvc.perform(get("/api/attribution/enquiries")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/attribution/enquiries").header("Authorization", "Bearer " + jwt.issue(operatorId, "a@example.com")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].contactValue").value("traveller@example.com"))
                .andExpect(jsonPath("$[0].clickId").doesNotExist())
                .andExpect(jsonPath("$[0].businessProfileId").doesNotExist());
        UUID otherOperator = operators.create(UUID.randomUUID());
        BusinessProfile other = new BusinessProfile();
        other.setUserId(otherOperator);
        other.setBusinessName("Other resort");
        profiles.saveAndFlush(other);
        mvc.perform(get("/api/attribution/enquiries").param("profileId", profileId.toString())
                        .header("Authorization", "Bearer " + jwt.issue(otherOperator, "b@example.com")))
                .andExpect(status().isOk()).andExpect(content().json("[]", true));
    }

    @Test
    void redemptionFailureRollsBackTheAlreadyFlushedEnquiry() {
        doThrow(new IllegalStateException("forced write failure")).when(redemptions).saveAndFlush(any());
        var input = new AttributionLinkDtos.EnquiryRequest(clickId, "Traveller", "contact", null, null, null, null);
        assertThrows(IllegalStateException.class, () -> service.submit(input));
        assertEquals(0, enquiries.count());
        assertEquals(0, redemptions.count());
    }

    @Test
    void simultaneousSubmissionsProduceOneConversion() throws Exception {
        var input = new AttributionLinkDtos.EnquiryRequest(clickId, "Traveller", "contact", null, null, null, null);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            java.util.concurrent.Callable<Boolean> submit = () -> {
                start.await();
                try { service.submit(input); return true; }
                catch (EnquiryService.InvalidEnquiryException e) { return false; }
            };
            var first = executor.submit(submit);
            var second = executor.submit(submit);
            start.countDown();
            assertNotEquals(first.get(10, TimeUnit.SECONDS), second.get(10, TimeUnit.SECONDS));
        } finally {
            executor.shutdownNow();
        }
        assertEquals(1, enquiries.count());
        assertEquals(1, redemptions.count());
    }

    @Test
    void publicContextAndPostShareRateBudgetEvenForInvalidBodies() throws Exception {
        for (int i = 0; i < AttributionRateLimiter.REQUESTS_PER_MINUTE; i++) {
            mvc.perform(post(PUBLIC).contentType("application/json").content("{")
                    .with(req -> { req.setRemoteAddr(address); return req; })).andExpect(status().isBadRequest());
        }
        mvc.perform(request(body(clickId))).andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"));
        mvc.perform(get(PUBLIC + "/context").param("cv", clickId.toString())
                .with(req -> { req.setRemoteAddr(address); return req; })).andExpect(status().isTooManyRequests());
        address = UUID.randomUUID().toString();
        mvc.perform(request(body(clickId))).andExpect(status().isOk());
    }
}
