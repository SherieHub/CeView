package com.ceview.module4.attribution;

import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.AttributionDtos.CodeSummary;
import com.ceview.module4.attribution.AttributionDtos.LiftResponse;
import com.ceview.module4.attribution.AttributionDtos.LiftStatus;
import com.ceview.module4.attribution.AttributionDtos.LogBookingRequest;
import com.ceview.module4.attribution.link.AttributionClickRepository;
import com.ceview.module4.attribution.link.AttributionEnquiryRepository;
import com.ceview.module4.attribution.link.AttributionLinkRepository;
import com.ceview.module4.dto.AnalyticsDtos.ManualIngestRequest;
import com.ceview.module4.engagement.CampaignRecord;
import com.ceview.module4.engagement.CampaignRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * CVW-42 — statistical lift and the "more tracked than reported" flag, both
 * read against the operator's own weekly CampaignRecords.
 */
@SpringBootTest
class AttributionLiftServiceTest {

    @Autowired private AttributionLiftService liftService;
    @Autowired private AttributionRedemptionService redemptionService;
    @Autowired private AttributionCodeRepository codeRepo;
    @Autowired private AttributionRedemptionRepository redemptionRepo;
    @Autowired private AttributionEnquiryRepository enquiryRepo;
    @Autowired private AttributionClickRepository clickRepo;
    @Autowired private AttributionLinkRepository linkRepo;
    @Autowired private CampaignRecordRepository campaignRepo;
    @Autowired private BusinessProfileRepository profileRepo;

    /** Window: Mar 30 – Apr 13. Baseline: the 28 days before, Mar 2 – Mar 29. */
    private static final OffsetDateTime WINDOW_START = OffsetDateTime.parse("2026-03-30T00:00:00+08:00");

    private UUID profileId;

    @BeforeEach
    void setUp() {
        redemptionRepo.deleteAll();
        enquiryRepo.deleteAll();
        clickRepo.deleteAll();
        linkRepo.deleteAll();
        codeRepo.deleteAll();
        campaignRepo.deleteAll();
        profileRepo.deleteAll();

        BusinessProfile profile = new BusinessProfile();
        profile.setUserId(UUID.randomUUID());
        profile.setBusinessName("Moalboal Divers");
        profileId = profileRepo.save(profile).getBusinessProfileId();
    }

    @Test
    void liftComparesWeeklyRatesInTheWindowWithTheFourWeeksBefore() {
        AttributionCode code = saveCode(WINDOW_START);
        for (String week : new String[]{"2026-03-02", "2026-03-09", "2026-03-16", "2026-03-23"}) {
            saveWeek(week, 10, 1000);
        }
        saveWeek("2026-03-30", 15, 1500);
        saveWeek("2026-04-06", 25, 2500);
        saveWeek("2026-04-13", 99, 9900);   // first day after the window: excluded
        saveWeek("2026-02-23", 99, 9900);   // before the baseline: excluded

        LiftResponse lift = liftService.liftFor(profileId, code.getAttributionCodeId());

        assertEquals(LiftStatus.OK, lift.status());
        assertEquals(2, lift.windowPeriods());
        assertEquals(4, lift.baselinePeriods());
        assertEquals(LocalDate.parse("2026-03-02"), lift.baselineStart());
        assertFalse(lift.shortBaseline());
        assertEquals(0, new BigDecimal("20.00").compareTo(lift.windowBookingsPerWeek()));
        assertEquals(0, new BigDecimal("10.00").compareTo(lift.baselineBookingsPerWeek()));
        assertEquals(0, new BigDecimal("100.0").compareTo(lift.bookingsLiftPct()));
        assertEquals(0, new BigDecimal("100.0").compareTo(lift.revenueLiftPct()));
    }

    @Test
    void aShortBaselineIsUsedButFlaggedNeverPadded() {
        AttributionCode code = saveCode(WINDOW_START);
        saveWeek("2026-03-23", 10, 1000);
        saveWeek("2026-03-30", 5, 500);

        LiftResponse lift = liftService.liftFor(profileId, code.getAttributionCodeId());

        assertEquals(LiftStatus.OK, lift.status());
        assertTrue(lift.shortBaseline());
        assertEquals(0, new BigDecimal("1.0").compareTo(lift.baselineWeeks()));
        assertEquals(0, new BigDecimal("-50.0").compareTo(lift.bookingsLiftPct()));
    }

    @Test
    void missingDataIsReportedAsAStatusWithNoInventedPercentages() {
        AttributionCode noBaseline = saveCode(WINDOW_START);
        saveWeek("2026-03-30", 5, 500);
        LiftResponse lift = liftService.liftFor(profileId, noBaseline.getAttributionCodeId());
        assertEquals(LiftStatus.NO_BASELINE, lift.status());
        assertNull(lift.bookingsLiftPct());
        assertNull(lift.baselineBookingsPerWeek());

        campaignRepo.deleteAll();
        saveWeek("2026-03-16", 5, 500);
        lift = liftService.liftFor(profileId, noBaseline.getAttributionCodeId());
        assertEquals(LiftStatus.NO_WINDOW_DATA, lift.status());
        assertNull(lift.windowBookingsPerWeek());
        assertNull(lift.revenueLiftPct());

        AttributionCode upcoming = saveCode(OffsetDateTime.now().plusDays(3));
        assertEquals(LiftStatus.UPCOMING, liftService.liftFor(profileId, upcoming.getAttributionCodeId()).status());
    }

    @Test
    void anotherOperatorsCodeIsNotFound() {
        AttributionCode code = saveCode(WINDOW_START);
        assertThrows(ResponseStatusException.class,
                () -> liftService.liftFor(UUID.randomUUID(), code.getAttributionCodeId()));
    }

    @Test
    void aCodeIsFlaggedWhenMoreBookingsWereTrackedThanReportedForItsWeeks() {
        OffsetDateTime start = OffsetDateTime.now().minusDays(2);
        AttributionCode code = saveCode(start);

        redemptionService.logBooking(profileId,
                new LogBookingRequest(code.getAttributionCodeId(), null, 3, null, null));
        CodeSummary unreported = redemptionService.codeSummaries(profileId).get(0);
        assertNull(unreported.reportedBookings(), "no week submitted yet is not the same as zero");
        assertFalse(unreported.trackedExceedsReported());

        saveWeek(start.toLocalDate().toString(), 1, 100);
        CodeSummary flagged = redemptionService.codeSummaries(profileId).get(0);
        assertEquals(1L, flagged.reportedBookings());
        assertTrue(flagged.trackedExceedsReported());
    }

    private AttributionCode saveCode(OffsetDateTime start) {
        AttributionCode code = new AttributionCode();
        code.setBusinessProfileId(profileId);
        code.setCategory("Diving");
        code.setTargetMarket("korea");
        code.setCode("KR-DIVI-" + UUID.randomUUID().toString().substring(0, 4));
        code.setWindowStart(start);
        code.setWindowEnd(AttributionWindow.endFor(start));
        return codeRepo.save(code);
    }

    private void saveWeek(String periodStart, int bookings, double revenue) {
        LocalDate start = LocalDate.parse(periodStart);
        CampaignRecord week = CampaignRecord.from(new ManualIngestRequest(
                1000, 50, 100.0, revenue, 20, bookings, 1, periodStart, start.plusDays(6).toString()));
        week.setBusinessProfileId(profileId);
        campaignRepo.save(week);
    }
}
