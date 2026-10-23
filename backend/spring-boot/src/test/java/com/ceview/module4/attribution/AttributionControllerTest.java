package com.ceview.module4.attribution;

import com.ceview.auth.JwtService;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.link.AttributionClick;
import com.ceview.module4.attribution.link.AttributionClickRepository;
import com.ceview.module4.attribution.link.AttributionEnquiry;
import com.ceview.module4.attribution.link.AttributionEnquiryRepository;
import com.ceview.module4.attribution.link.AttributionLink;
import com.ceview.module4.attribution.link.AttributionLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * CVW-42 — the conversion end of attribution: logging a booking against a code
 * or a recorded click, undoing it, and reading back what each code captured.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@AutoConfigureMockMvc
class AttributionControllerTest {

    @Autowired private MockMvc mvc;
    @Autowired private JwtService jwtService;
    @Autowired private BusinessProfileRepository profileRepo;
    @Autowired private AttributionCodeRepository codeRepo;
    @Autowired private AttributionLinkRepository linkRepo;
    @Autowired private AttributionClickRepository clickRepo;
    @Autowired private AttributionEnquiryRepository enquiryRepo;
    @Autowired private AttributionRedemptionRepository redemptionRepo;
    @Autowired private com.ceview.testsupport.TestOperators testOperators;

    private String tokenA;
    private String tokenB;
    private UUID profileA;
    private UUID profileB;
    private AttributionCode codeA;
    private AttributionCode codeB;
    private AttributionLink linkA;

    private final OffsetDateTime windowStart = OffsetDateTime.now().minusDays(2);

    @BeforeEach
    void setUp() {
        redemptionRepo.deleteAll();
        enquiryRepo.deleteAll();
        clickRepo.deleteAll();
        linkRepo.deleteAll();
        codeRepo.deleteAll();
        profileRepo.deleteAll();

        UUID operatorA = UUID.randomUUID();
        UUID operatorB = UUID.randomUUID();
        testOperators.create(operatorA);
        testOperators.create(operatorB);
        tokenA = jwtService.issue(operatorA, "a@example.com");
        tokenB = jwtService.issue(operatorB, "b@example.com");
        profileA = saveProfile(operatorA, "Operator A");
        profileB = saveProfile(operatorB, "Operator B");

        codeA = saveCode(profileA, "KR-COAS-1017");
        codeB = saveCode(profileB, "KR-COAS-1017");
        linkA = saveLink(profileA, "linkaaaa");
    }

    @Test
    void logsAManualBookingAgainstACode() throws Exception {
        logBooking(tokenA, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId()
                + "\",\"revenue\":4500.00}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("KR-COAS-1017"))
                .andExpect(jsonPath("$.source").value("MANUAL"))
                .andExpect(jsonPath("$.kind").value("CODE_LOGGED"))
                .andExpect(jsonPath("$.bookings").value(1))
                .andExpect(jsonPath("$.deletable").value(true));

        AttributionRedemption saved = redemptionRepo.findAll().get(0);
        assertEquals(profileA, saved.getBusinessProfileId());
        assertEquals(0, new BigDecimal("4500.00").compareTo(saved.getRevenue()));
        assertTrue(saved.getEventAt() != null, "eventAt defaults to now");
    }

    @Test
    void attachingAClickWritesALinkRowForThatClicksCode() throws Exception {
        AttributionClick click = saveClick(profileA, linkA.getLinkId());

        logBooking(tokenA, "{\"clickId\":\"" + click.getClickId() + "\"}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.source").value("LINK"))
                .andExpect(jsonPath("$.kind").value("CLICK_MATCHED"))
                .andExpect(jsonPath("$.attributionCodeId").value(codeA.getAttributionCodeId().toString()))
                .andExpect(jsonPath("$.clickId").value(click.getClickId().toString()));
    }

    @Test
    void aClickCanOnlyBeConvertedOnce() throws Exception {
        AttributionClick click = saveClick(profileA, linkA.getLinkId());
        String body = "{\"clickId\":\"" + click.getClickId() + "\"}";

        logBooking(tokenA, body).andExpect(status().isCreated());
        logBooking(tokenA, body).andExpect(status().isConflict());
        assertEquals(1, redemptionRepo.count());
    }

    @Test
    void anotherOperatorsCodeOrClickResolvesAsNotFound() throws Exception {
        AttributionClick click = saveClick(profileA, linkA.getLinkId());

        logBooking(tokenB, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId() + "\"}")
                .andExpect(status().isNotFound());
        logBooking(tokenB, "{\"clickId\":\"" + click.getClickId() + "\"}")
                .andExpect(status().isNotFound());
        assertEquals(0, redemptionRepo.count());
    }

    @Test
    void rejectsMissingTargetFutureEventsAndBadCounts() throws Exception {
        logBooking(tokenA, "{}").andExpect(status().isBadRequest());
        logBooking(tokenA, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId()
                + "\",\"eventAt\":\"" + OffsetDateTime.now().plusDays(1) + "\"}")
                .andExpect(status().isBadRequest());
        logBooking(tokenA, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId() + "\",\"bookings\":0}")
                .andExpect(status().isBadRequest());
        logBooking(tokenA, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId() + "\",\"revenue\":-1}")
                .andExpect(status().isBadRequest());
        assertEquals(0, redemptionRepo.count());
    }

    @Test
    void codeSummariesSplitBookingsByHowTheyWereCapturedAndAreTenantScoped() throws Exception {
        logBooking(tokenA, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId()
                + "\",\"bookings\":2,\"revenue\":3000}").andExpect(status().isCreated());
        saveEnquiryConversion(profileA, saveClick(profileA, linkA.getLinkId()));

        mvc.perform(get("/api/attribution/codes").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].code").value("KR-COAS-1017"))
                .andExpect(jsonPath("$[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$[0].totalBookings").value(3))
                .andExpect(jsonPath("$[0].byKind[?(@.kind=='ENQUIRY')].bookings").value(1))
                .andExpect(jsonPath("$[0].byKind[?(@.kind=='CODE_LOGGED')].bookings").value(2));

        mvc.perform(get("/api/attribution/codes").header("Authorization", "Bearer " + tokenB))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].attributionCodeId").value(codeB.getAttributionCodeId().toString()))
                .andExpect(jsonPath("$[0].totalBookings").value(0));
    }

    @Test
    void codeSummariesFlagWalkInVouchersSoTheLogBookingPickerCanLeaveThemOut() throws Exception {
        codeA.setDiscountAmount(new java.math.BigDecimal("50"));
        codeRepo.saveAndFlush(codeA);

        mvc.perform(get("/api/attribution/codes").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].voucher").value(true));
        mvc.perform(get("/api/attribution/codes").header("Authorization", "Bearer " + tokenB))
                .andExpect(jsonPath("$[0].voucher").value(false));
    }

    @Test
    void operatorCanUndoTheirOwnLogButNotATravellersEnquiry() throws Exception {
        logBooking(tokenA, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId() + "\"}")
                .andExpect(status().isCreated());
        UUID manualId = redemptionRepo.findAll().get(0).getRedemptionId();
        AttributionRedemption enquiryRow = saveEnquiryConversion(profileA, saveClick(profileA, linkA.getLinkId()));

        mvc.perform(get("/api/attribution/redemptions").header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));

        mvc.perform(delete("/api/attribution/redemptions/{id}", manualId)
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/attribution/redemptions/{id}", enquiryRow.getRedemptionId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/attribution/redemptions/{id}", manualId)
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isNoContent());

        assertEquals(1, redemptionRepo.count());
    }

    @Test
    void trackedSummarisesAReportingPeriodForTheWeeklyForm() throws Exception {
        logBooking(tokenA, "{\"attributionCodeId\":\"" + codeA.getAttributionCodeId()
                + "\",\"bookings\":2,\"revenue\":3000}").andExpect(status().isCreated());
        saveEnquiryConversion(profileA, saveClick(profileA, linkA.getLinkId()));
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Manila"));

        mvc.perform(get("/api/attribution/tracked")
                        .header("Authorization", "Bearer " + tokenA)
                        .param("periodStart", today.minusDays(1).toString())
                        .param("periodEnd", today.plusDays(1).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.trackedBookings").value(3))
                .andExpect(jsonPath("$.automaticBookings").value(1))
                .andExpect(jsonPath("$.codeLoggedBookings").value(2))
                .andExpect(jsonPath("$.trackedRevenue").value(3000.0));

        // Another operator's period is empty, and a backwards period is rejected.
        mvc.perform(get("/api/attribution/tracked")
                        .header("Authorization", "Bearer " + tokenB)
                        .param("periodStart", today.minusDays(1).toString())
                        .param("periodEnd", today.plusDays(1).toString()))
                .andExpect(jsonPath("$.trackedBookings").value(0));
        mvc.perform(get("/api/attribution/tracked")
                        .header("Authorization", "Bearer " + tokenA)
                        .param("periodStart", today.toString())
                        .param("periodEnd", today.minusDays(3).toString()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void liftIsTenantScoped() throws Exception {
        mvc.perform(get("/api/attribution/lift/{id}", codeA.getAttributionCodeId())
                        .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("KR-COAS-1017"))
                .andExpect(jsonPath("$.status").value("NO_WINDOW_DATA"));
        mvc.perform(get("/api/attribution/lift/{id}", codeA.getAttributionCodeId())
                        .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());
    }

    // ─── fixtures ────────────────────────────────────────────────────────────

    private ResultActions logBooking(String token, String body) throws Exception {
        return mvc.perform(post("/api/attribution/redemptions")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body));
    }

    private UUID saveProfile(UUID operatorId, String name) {
        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(operatorId);
        profile.setBusinessName(name);
        return profileRepo.save(profile).getBusinessProfileId();
    }

    private AttributionCode saveCode(UUID profileId, String value) {
        AttributionCode code = new AttributionCode();
        code.setBusinessProfileId(profileId);
        code.setCategory("Coastal & Island");
        code.setTargetMarket("korea");
        code.setCode(value);
        code.setWindowStart(windowStart);
        code.setWindowEnd(AttributionWindow.endFor(windowStart));
        return codeRepo.save(code);
    }

    private AttributionLink saveLink(UUID profileId, String slug) {
        AttributionLink link = new AttributionLink();
        link.setBusinessProfileId(profileId);
        link.setCategory("Coastal & Island");
        link.setTargetMarket("korea");
        link.setSlug(slug);
        link.setWindowStart(windowStart);
        link.setWindowEnd(AttributionWindow.endFor(windowStart));
        return linkRepo.save(link);
    }

    private AttributionClick saveClick(UUID profileId, UUID linkId) {
        AttributionClick click = new AttributionClick();
        click.setBusinessProfileId(profileId);
        click.setLinkId(linkId);
        click.setExternalAdId("120214");
        click.setPlatform(AttributionClick.PLATFORM_META);
        click.setClickedAt(OffsetDateTime.now().minusHours(1));
        return clickRepo.save(click);
    }

    /** What EnquiryService writes when a traveller submits the hosted form. */
    private AttributionRedemption saveEnquiryConversion(UUID profileId, AttributionClick click) {
        AttributionEnquiry enquiry = new AttributionEnquiry();
        enquiry.setClickId(click.getClickId());
        enquiry.setBusinessProfileId(profileId);
        enquiry.setContactName("Ji-woo");
        enquiry.setContactValue("jiwoo@example.com");
        enquiry.setCreatedAt(OffsetDateTime.now());
        enquiryRepo.save(enquiry);

        AttributionRedemption redemption = new AttributionRedemption();
        redemption.setAttributionCodeId(codeA.getAttributionCodeId());
        redemption.setBusinessProfileId(profileId);
        redemption.setAttributionClickId(click.getClickId());
        redemption.setSource(AttributionRedemption.SOURCE_LINK);
        redemption.setEventAt(OffsetDateTime.now());
        redemption.setBookings(1);
        return redemptionRepo.save(redemption);
    }
}
