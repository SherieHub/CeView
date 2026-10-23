package com.ceview.module4.attribution;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Wire shapes for code-redemption capture (CVW-42).
 *
 * <p>Research: {@code docs/module-4/CONVERSION_CAPTURE_RESEARCH.md}.
 * Spec: {@code docs/superpowers/specs/2026-09-14-marketing-attribution-design.md}, phase 3.
 */
public final class AttributionDtos {

    private AttributionDtos() {}

    /**
     * How a booking reached CeView, from most to least trustworthy. This is what
     * the Performance screen and the AI report use to say how much of a total
     * was captured automatically rather than recalled.
     */
    public enum CaptureKind {
        /** Traveller submitted CeView's hosted enquiry form — no operator input at all. */
        ENQUIRY,
        /** Synced from a booking platform (FareHarbor). */
        BOOKING_PLATFORM,
        /** Operator attached the booking to a click CeView recorded automatically. */
        CLICK_MATCHED,
        /** Operator logged that a customer quoted the code. */
        CODE_LOGGED;

        public boolean automatic() {
            return this == ENQUIRY || this == BOOKING_PLATFORM;
        }

        /** Rows the operator created themselves — the only ones they may delete. */
        public boolean operatorAuthored() {
            return !automatic();
        }
    }

    public enum CodeStatus { UPCOMING, ACTIVE, ENDED }

    /**
     * Logs one booking at the moment it happens.
     *
     * <p>Exactly one of {@code attributionCodeId} / {@code clickId} is needed:
     * a click already determines its code through its link's window, so when
     * both are sent they must agree.
     *
     * @param eventAt defaults to now; backdatable, never in the future
     */
    public record LogBookingRequest(
            UUID attributionCodeId,
            UUID clickId,
            @Min(1) @Max(500) Integer bookings,
            @DecimalMin("0.00") BigDecimal revenue,
            OffsetDateTime eventAt) {}

    public record RedemptionResponse(
            UUID redemptionId,
            UUID attributionCodeId,
            String code,
            String source,
            CaptureKind kind,
            long bookings,
            BigDecimal revenue,
            OffsetDateTime eventAt,
            UUID clickId,
            /** False for traveller-submitted and synced rows: the operator did not create them. */
            boolean deletable) {}

    /** Bookings and revenue for one capture kind. */
    public record KindTotal(CaptureKind kind, long bookings, BigDecimal revenue) {}

    /**
     * A code as the operator sees it: what to quote, when, and what it has captured.
     *
     * @param reportedBookings the operator's own CampaignRecord bookings for weeks
     *        starting inside the window; null when no week in the window has been
     *        submitted yet, so "nothing reported" is not mistaken for "zero"
     * @param trackedExceedsReported more bookings were tracked against this code
     *        than the operator reported for the same weeks — a data-quality flag
     *        shown on the Performance screen, never a rejection
     */
    public record CodeSummary(
            UUID attributionCodeId,
            String code,
            String category,
            String targetMarket,
            OffsetDateTime windowStart,
            OffsetDateTime windowEnd,
            CodeStatus status,
            long totalBookings,
            BigDecimal totalRevenue,
            List<KindTotal> byKind,
            Long reportedBookings,
            boolean trackedExceedsReported,
            /** A walk-in voucher (carries a discount). Bookings against it go through voucher redemption, not "Log a booking". */
            boolean voucher) {}

    /**
     * Bookings CeView tracked in one reporting period, shown beside the weekly
     * form's Bookings field so the operator types a total that includes them.
     */
    public record TrackedPeriodSummary(
            LocalDate periodStart,
            LocalDate periodEnd,
            long trackedBookings,
            long automaticBookings,
            long clickMatchedBookings,
            long codeLoggedBookings,
            BigDecimal trackedRevenue) {}

    public enum LiftStatus {
        /** Window and baseline both have reported weeks; lift is computed. */
        OK,
        /** The window has not opened yet. */
        UPCOMING,
        /** No week inside the window has been reported yet. */
        NO_WINDOW_DATA,
        /** Nothing reported in the four weeks before the window. */
        NO_BASELINE
    }

    /**
     * Window vs. pre-window comparison for one code, as per-week rates.
     *
     * @param shortBaseline fewer than four weeks of history before the window;
     *        the comparison still runs but the UI says how short it was
     * @param bookingsLiftPct null unless {@code status} is OK and the baseline is non-zero
     */
    public record LiftResponse(
            UUID attributionCodeId,
            String code,
            OffsetDateTime windowStart,
            OffsetDateTime windowEnd,
            LocalDate baselineStart,
            LiftStatus status,
            int windowPeriods,
            int baselinePeriods,
            BigDecimal baselineWeeks,
            boolean shortBaseline,
            BigDecimal windowBookingsPerWeek,
            BigDecimal baselineBookingsPerWeek,
            BigDecimal bookingsLiftPct,
            BigDecimal windowRevenuePerWeek,
            BigDecimal baselineRevenuePerWeek,
            BigDecimal revenueLiftPct) {}

    /**
     * Where a period's bookings came from — sent to the AI report so it can
     * qualify its confidence instead of treating a recalled total as measured.
     *
     * @param reportedBookings the period's operator-entered CampaignRecord total
     * @param untrackedBookings reported minus tracked, floored at zero
     * @param trackedExceedsReported tracked bookings outnumber the reported total —
     *        a data-quality flag, not an error (the spec's "flag, don't block")
     */
    public record BookingProvenance(
            long reportedBookings,
            long trackedBookings,
            long automaticBookings,
            long clickMatchedBookings,
            long codeLoggedBookings,
            long untrackedBookings,
            boolean trackedExceedsReported) {}
}
