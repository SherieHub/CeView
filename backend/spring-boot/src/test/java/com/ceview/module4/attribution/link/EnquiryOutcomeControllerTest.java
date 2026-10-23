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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The operator decides what an enquiry became. The traveller's submit records it as one booking at
 * zero revenue; Booked fills in the real figures and Declined takes the booking back out, so the
 * evidence and analytics reflect what actually happened.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class EnquiryOutcomeControllerTest {
    private static final String PUBLIC = "/api/public/attribution/enquiries";
    private static final String OPERATOR = "/api/attribution/enquiries";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired AttributionClickRepository clicks;
    @Autowired AttributionLinkRepository links;
    @Autowired AttributionEnquiryRepository enquiries;
    @Autowired AttributionCodeRepository codes;
    @Autowired AttributionRedemptionRepository redemptions;
    @Autowired AttributionCodeService codeService;
    @Autowired AttributionLinkService linkService;
    @Autowired BusinessProfileRepository profiles;
    @Autowired JwtService jwt;
    @Autowired TestOperators operators;

    UUID profileId;
    UUID operatorId;
    UUID clickId;
    UUID enquiryId;
    String auth;

    @BeforeEach
    void seed() throws Exception {
        redemptions.deleteAll();
        enquiries.deleteAll();
        clicks.deleteAll();
        links.deleteAll();
        codes.deleteAll();
        operatorId = operators.create(UUID.randomUUID());
        auth = "Bearer " + jwt.issue(operatorId, "owner@example.com");
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName("Kasa Beach Resort");
        profileId = profiles.saveAndFlush(profile).getBusinessProfileId();
        OffsetDateTime start = OffsetDateTime.now().minusDays(1);
        codeService.mintForWindow(profileId, "Resort", "KR", start, UUID.randomUUID());
        AttributionLink link = linkService.mintForWindow(profileId, "Resort", "KR", start, UUID.randomUUID());
        clickId = newClick(link, true);
        submitEnquiry(clickId);
        enquiryId = enquiries.findByClickId(clickId).orElseThrow().getEnquiryId();
    }

    UUID newClick(AttributionLink link, boolean inWindow) {
        AttributionClick click = new AttributionClick();
        click.setLinkId(link.getLinkId());
        click.setBusinessProfileId(profileId);
        click.setInWindow(inWindow);
        return clicks.saveAndFlush(click).getClickId();
    }

    void submitEnquiry(UUID click) throws Exception {
        mvc.perform(post(PUBLIC).contentType("application/json")
                .content(mapper.writeValueAsString(Map.of(
                        "clickId", click, "contactName", "Traveller", "contactValue", "t@example.com")))
                .with(req -> { req.setRemoteAddr(UUID.randomUUID().toString()); return req; }))
                .andExpect(status().isOk());
    }

    ResultActions patchOutcome(UUID id, String token, Map<String, Object> body) throws Exception {
        var request = patch(OPERATOR + "/" + id).contentType("application/json").content(mapper.writeValueAsString(body));
        return mvc.perform(token == null ? request : request.header("Authorization", token));
    }

    List<AttributionRedemption> redemptionsForClick() {
        return redemptions.findByAttributionClickIdIn(List.of(clickId));
    }

    @Test
    void anEnquiryStartsAsNewWithTheAutomaticBooking() throws Exception {
        mvc.perform(get(OPERATOR).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].outcome").value("NEW"))
                .andExpect(jsonPath("$[0].bookings").value(1))
                .andExpect(jsonPath("$[0].revenue").value(0))
                .andExpect(jsonPath("$[0].clickInWindow").value(true));
    }

    @Test
    void theOutcomeEndpointRequiresAJwt() throws Exception {
        patchOutcome(enquiryId, null, Map.of("outcome", "BOOKED")).andExpect(status().isUnauthorized());
        assertEquals("NEW", enquiries.findById(enquiryId).orElseThrow().getOutcome());
    }

    @Test
    void markingBookedRecordsTheRealBookingsAndRevenueOnTheExistingRedemption() throws Exception {
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED", "bookings", 3, "revenue", 7500.50))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("BOOKED"))
                .andExpect(jsonPath("$.bookings").value(3))
                .andExpect(jsonPath("$.revenue").value(7500.50));

        var rows = redemptionsForClick();
        assertEquals(1, rows.size());
        assertEquals("LINK", rows.get(0).getSource());
        assertEquals(3, rows.get(0).getBookings());
        assertEquals(0, new BigDecimal("7500.50").compareTo(rows.get(0).getRevenue()));
        var enquiry = enquiries.findById(enquiryId).orElseThrow();
        assertEquals("BOOKED", enquiry.getOutcome());
        assertNotNull(enquiry.getOutcomeAt());
    }

    @Test
    void markingBookedWithoutFiguresKeepsWhatIsAlreadyRecorded() throws Exception {
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED")).andExpect(status().isOk())
                .andExpect(jsonPath("$.bookings").value(1)).andExpect(jsonPath("$.revenue").value(0));
        assertEquals(1, redemptionsForClick().size());
    }

    @Test
    void decliningTakesTheBookingBackOutButKeepsTheEnquiryAsEvidence() throws Exception {
        patchOutcome(enquiryId, auth, Map.of("outcome", "DECLINED")).andExpect(status().isOk())
                .andExpect(jsonPath("$.outcome").value("DECLINED"))
                .andExpect(jsonPath("$.bookings").value(0))
                .andExpect(jsonPath("$.revenue").value(0));

        assertTrue(redemptionsForClick().isEmpty());
        assertEquals(1, enquiries.count());
        assertEquals("DECLINED", enquiries.findById(enquiryId).orElseThrow().getOutcome());
    }

    @Test
    void aDeclinedEnquiryCanStillBeMarkedBookedAndTheBookingComesBack() throws Exception {
        patchOutcome(enquiryId, auth, Map.of("outcome", "DECLINED")).andExpect(status().isOk());
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED", "bookings", 2, "revenue", 1200))
                .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("BOOKED"));

        var rows = redemptionsForClick();
        assertEquals(1, rows.size());
        assertEquals("LINK", rows.get(0).getSource());
        assertEquals(2, rows.get(0).getBookings());
        assertEquals(0, new BigDecimal("1200").compareTo(rows.get(0).getRevenue()));
        assertEquals(profileId, rows.get(0).getBusinessProfileId());
    }

    @Test
    void repeatingTheSameOutcomeDoesNotDuplicateOrDropTheBooking() throws Exception {
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED", "revenue", 100)).andExpect(status().isOk());
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED", "revenue", 100)).andExpect(status().isOk());
        assertEquals(1, redemptionsForClick().size());
        patchOutcome(enquiryId, auth, Map.of("outcome", "DECLINED")).andExpect(status().isOk());
        patchOutcome(enquiryId, auth, Map.of("outcome", "DECLINED")).andExpect(status().isOk());
        assertTrue(redemptionsForClick().isEmpty());
    }

    @Test
    void anotherOperatorCannotChangeTheOutcomeAndSeesNoSuchEnquiry() throws Exception {
        UUID otherUser = operators.create(UUID.randomUUID());
        BusinessProfile other = new BusinessProfile();
        other.setUserId(otherUser);
        other.setBusinessName("Other resort");
        profiles.saveAndFlush(other);
        String otherAuth = "Bearer " + jwt.issue(otherUser, "other@example.com");

        patchOutcome(enquiryId, otherAuth, Map.of("outcome", "DECLINED", "revenue", 1)).andExpect(status().isNotFound());

        assertEquals("NEW", enquiries.findById(enquiryId).orElseThrow().getOutcome());
        assertEquals(1, redemptionsForClick().size());
    }

    @Test
    void anUnknownEnquiryIs404() throws Exception {
        patchOutcome(UUID.randomUUID(), auth, Map.of("outcome", "BOOKED")).andExpect(status().isNotFound());
    }

    @Test
    void rejectsOutcomesAndFiguresItCannotRecord() throws Exception {
        patchOutcome(enquiryId, auth, Map.of("outcome", "NEW")).andExpect(status().isBadRequest());
        patchOutcome(enquiryId, auth, Map.of("outcome", "MAYBE")).andExpect(status().isBadRequest());
        patchOutcome(enquiryId, auth, Map.of("revenue", 10)).andExpect(status().isBadRequest());
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED", "bookings", 0)).andExpect(status().isBadRequest());
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED", "bookings", 501)).andExpect(status().isBadRequest());
        patchOutcome(enquiryId, auth, Map.of("outcome", "BOOKED", "revenue", -1)).andExpect(status().isBadRequest());
        assertEquals("NEW", enquiries.findById(enquiryId).orElseThrow().getOutcome());
        assertEquals(1, redemptionsForClick().size());
    }

    @Test
    void theListShowsWhetherALeadCameInAfterTheCampaignWindow() throws Exception {
        AttributionLink link = links.findAll().get(0);
        UUID late = newClick(link, false);
        submitEnquiry(late);

        mvc.perform(get(OPERATOR).header("Authorization", auth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.message == null)].clickInWindow").value(org.hamcrest.Matchers.containsInAnyOrder(true, false)));
    }
}
