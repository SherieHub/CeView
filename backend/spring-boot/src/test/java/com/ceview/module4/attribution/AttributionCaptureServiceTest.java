package com.ceview.module4.attribution;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.AttributionDtos.BookingProvenance;
import com.ceview.module4.attribution.AttributionDtos.LogBookingRequest;
import com.ceview.module4.attribution.link.AttributionClickRepository;
import com.ceview.module4.attribution.link.AttributionEnquiryRepository;
import com.ceview.module4.attribution.link.AttributionLinkRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * CVW-42 — which code a caption carries, and how a period's bookings split by
 * the way they were captured.
 */
@SpringBootTest
class AttributionCaptureServiceTest {

    @Autowired private AttributionCodeService codeService;
    @Autowired private VoucherRedemptionService voucherService;
    @Autowired private AttributionRedemptionService redemptionService;
    @Autowired private AttributionCodeRepository codeRepo;
    @Autowired private AttributionRedemptionRepository redemptionRepo;
    @Autowired private AttributionEnquiryRepository enquiryRepo;
    @Autowired private AttributionClickRepository clickRepo;
    @Autowired private AttributionLinkRepository linkRepo;
    @Autowired private BusinessProfileRepository profileRepo;

    @Test
    void vouchersCannotBypassLimitsThroughGenericBookingCapture() {
        var voucher = codeService.createCvLaunch(profileId, "Diving", "korea", now.minusDays(1), now.plusDays(1));
        var error = org.junit.jupiter.api.Assertions.assertThrows(
                org.springframework.web.server.ResponseStatusException.class,
                () -> redemptionService.logBooking(profileId, new LogBookingRequest(
                        voucher.getAttributionCodeId(), null, 1, java.math.BigDecimal.TEN, null)));
        assertEquals(409, error.getStatusCode().value());
        assertEquals(0, redemptionRepo.count());
    }

    @Test
    void undoingTheLastVoucherRedemptionRestoresCapacity() {
        var voucher = codeService.createVoucher(profileId, "ONE", java.math.BigDecimal.TEN,
                1L, "Diving", "korea", now.minusDays(1), now.plusDays(1));
        voucherService.redeem(profileId, voucher.getAttributionCodeId(), java.math.BigDecimal.TEN, null);
        assertEquals("EXHAUSTED", codeRepo.findById(voucher.getAttributionCodeId()).orElseThrow().getVoucherStatus());
        redemptionService.delete(profileId, redemptionService.recent(profileId).get(0).redemptionId());
        assertEquals("ACTIVE", codeRepo.findById(voucher.getAttributionCodeId()).orElseThrow().getVoucherStatus());
        assertEquals(0, voucherService.redeem(profileId, voucher.getAttributionCodeId(), java.math.BigDecimal.TEN, null).redemptionsRemaining());
    }

    @Test
    void voucherDoesNotReplaceTheSurgeTrackingCodeInGeneratedCaptions() {
        codeService.createCvLaunch(profileId, "Diving", "korea", now.minusDays(1), now.plusDays(1));
        assertTrue(codeService.findForContent(profileId, "korea", "Diving", null).isEmpty());
    }

    private UUID profileId;
    private final OffsetDateTime now = OffsetDateTime.now();

    @BeforeEach
    void setUp() {
        redemptionRepo.deleteAll();
        enquiryRepo.deleteAll();
        clickRepo.deleteAll();
        linkRepo.deleteAll();
        codeRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Moalboal Divers");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    // ─── findForContent ──────────────────────────────────────────────────────

    @Test
    void anActiveWindowForTheMarketIsUsedWhenNoAlertIsGiven() {
        AttributionCode active = saveCode("korea", "Diving", now.minusDays(1), "KR-DIVI-A");
        saveCode("japan", "Diving", now.minusDays(1), "JP-DIVI-A");

        assertEquals(active.getAttributionCodeId(),
                codeService.findForContent(profileId, "korea", "Diving", null).orElseThrow().getAttributionCodeId());
    }

    @Test
    void anUpcomingWindowCountsBecauseCaptionsArePostedBeforeTheSurge() {
        saveCode("korea", "Diving", now.minusDays(30), "KR-DIVI-OLD");
        AttributionCode upcoming = saveCode("korea", "Diving", now.plusDays(5), "KR-DIVI-NEXT");

        assertEquals("KR-DIVI-NEXT", codeService.findForContent(profileId, "korea", "Diving", null)
                .orElseThrow().getCode());
        assertEquals(upcoming.getAttributionCodeId(),
                codeService.findForContent(profileId, "KOREA", null, null).orElseThrow().getAttributionCodeId());
    }

    @Test
    void categoryMatchBreaksTiesAndAnExplicitAlertWins() {
        saveCode("korea", "Food", now.minusDays(1), "KR-FOOD-A");
        saveCode("korea", "Diving", now.plusDays(2), "KR-DIVI-A");
        UUID alertId = UUID.randomUUID();
        AttributionCode pinned = saveCode("korea", "Stay", now.plusDays(9), "KR-STAY-A");
        pinned.setDemandAlertId(alertId);
        codeRepo.save(pinned);

        assertEquals("KR-DIVI-A", codeService.findForContent(profileId, "korea", "Diving", null).orElseThrow().getCode());
        assertEquals("KR-STAY-A", codeService.findForContent(profileId, "korea", "Diving", alertId).orElseThrow().getCode());
    }

    @Test
    void anAlertForAnotherMarketDoesNotPinTheCode() {
        // Content Studio lets the operator pick Japan off a Korea alert.
        UUID koreaAlert = UUID.randomUUID();
        AttributionCode korea = saveCode("korea", "Diving", now.minusDays(1), "KR-DIVI-A");
        korea.setDemandAlertId(koreaAlert);
        codeRepo.save(korea);
        saveCode("japan", "Diving", now.minusDays(1), "JP-DIVI-A");

        assertEquals("JP-DIVI-A",
                codeService.findForContent(profileId, "japan", "Diving", koreaAlert).orElseThrow().getCode());
    }

    @Test
    void noLiveWindowOrAnotherOperatorsAlertMeansNoCode() {
        AttributionCode ended = saveCode("korea", "Diving", now.minusDays(30), "KR-DIVI-OLD");
        ended.setDemandAlertId(UUID.randomUUID());
        codeRepo.save(ended);

        assertTrue(codeService.findForContent(profileId, "korea", "Diving", null).isEmpty());
        assertTrue(codeService.findForContent(UUID.randomUUID(), "korea", "Diving", ended.getDemandAlertId()).isEmpty());
    }

    // ─── provenance ──────────────────────────────────────────────────────────

    @Test
    void provenanceSplitsTrackedBookingsAgainstTheReportedTotal() {
        AttributionCode code = saveCode("korea", "Diving", now.minusDays(3), "KR-DIVI-P");
        redemptionService.logBooking(profileId,
                new LogBookingRequest(code.getAttributionCodeId(), null, 3, null, now.minusDays(1)));
        // Outside the period: ignored.
        redemptionService.logBooking(profileId,
                new LogBookingRequest(code.getAttributionCodeId(), null, 5, null, now.minusDays(40)));
        // A synced weekly row inside the period counts as automatic.
        AttributionRedemption synced = new AttributionRedemption();
        synced.setAttributionCodeId(code.getAttributionCodeId());
        synced.setBusinessProfileId(profileId);
        synced.setSource(AttributionRedemption.SOURCE_FAREHARBOR);
        synced.setPeriodStart(LocalDate.now().minusDays(7));
        synced.setPeriodEnd(LocalDate.now().minusDays(1));
        synced.setBookings(2);
        redemptionRepo.save(synced);

        BookingProvenance p = redemptionService.provenance(profileId, now.minusWeeks(4), now.plusMinutes(1), 10);

        assertEquals(10, p.reportedBookings());
        assertEquals(5, p.trackedBookings());
        assertEquals(2, p.automaticBookings());
        assertEquals(3, p.codeLoggedBookings());
        assertEquals(0, p.clickMatchedBookings());
        assertEquals(5, p.untrackedBookings());
        assertFalse(p.trackedExceedsReported());

        BookingProvenance over = redemptionService.provenance(profileId, now.minusWeeks(4), now.plusMinutes(1), 1);
        assertEquals(0, over.untrackedBookings());
        assertTrue(over.trackedExceedsReported());
    }

    private AttributionCode saveCode(String market, String category, OffsetDateTime start, String value) {
        AttributionCode code = new AttributionCode();
        code.setBusinessProfileId(profileId);
        code.setCategory(category);
        code.setTargetMarket(market);
        code.setCode(value);
        code.setWindowStart(start);
        code.setWindowEnd(AttributionWindow.endFor(start));
        return codeRepo.save(code);
    }
}
