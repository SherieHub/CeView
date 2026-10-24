package com.ceview.module4.attribution;

import com.ceview.module4.attribution.AttributionDtos.BookingProvenance;
import com.ceview.module4.attribution.AttributionDtos.CaptureKind;
import com.ceview.module4.attribution.AttributionDtos.CodeStatus;
import com.ceview.module4.attribution.AttributionDtos.CodeSummary;
import com.ceview.module4.attribution.AttributionDtos.KindTotal;
import com.ceview.module4.attribution.AttributionDtos.LogBookingRequest;
import com.ceview.module4.attribution.AttributionDtos.RedemptionResponse;
import com.ceview.module4.attribution.AttributionDtos.TrackedPeriodSummary;
import com.ceview.module4.engagement.CampaignRecord;
import com.ceview.module4.attribution.link.AttributionClick;
import com.ceview.module4.attribution.link.AttributionClickRepository;
import com.ceview.module4.attribution.link.AttributionEnquiry;
import com.ceview.module4.attribution.link.AttributionEnquiryRepository;
import com.ceview.module4.attribution.link.AttributionLink;
import com.ceview.module4.attribution.link.AttributionLinkRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Writes and rolls up booking redemptions — the conversion end of attribution
 * (CVW-42, marketing-attribution spec phase 3).
 *
 * <p>Before this, the only thing that could write a redemption was the hosted
 * enquiry form. A booking taken over Messenger, by phone, or at the counter —
 * most of what Cebu MSMEs actually take — had nowhere to go, so the operator's
 * weekly recalled total was the only booking number in the system.
 *
 * <p>Every query here is scoped to the caller's business profile: a code, click
 * or redemption id from another operator resolves as not found, never as forbidden,
 * so ids cannot be probed across tenants.
 */
@Service
public class AttributionRedemptionService {

    /** Clock-skew allowance between a phone's clock and the server's. */
    static final Duration FUTURE_TOLERANCE = Duration.ofMinutes(5);
    static final int RECENT_LIMIT = 50;
    /** Reporting periods are the operator's local calendar weeks. */
    static final ZoneId OPERATOR_ZONE = ZoneId.of("Asia/Manila");

    private final AttributionCodeRepository codes;
    private final AttributionRedemptionRepository redemptions;
    private final AttributionClickRepository clicks;
    private final AttributionLinkRepository links;
    private final AttributionEnquiryRepository enquiries;
    private final ReportedCampaignTotals reported;

    public AttributionRedemptionService(AttributionCodeRepository codes,
                                        AttributionRedemptionRepository redemptions,
                                        AttributionClickRepository clicks,
                                        AttributionLinkRepository links,
                                        AttributionEnquiryRepository enquiries,
                                        ReportedCampaignTotals reported) {
        this.codes = codes;
        this.redemptions = redemptions;
        this.clicks = clicks;
        this.links = links;
        this.enquiries = enquiries;
        this.reported = reported;
    }

    // ─── write ───────────────────────────────────────────────────────────────

    /**
     * Records one booking the moment staff take it.
     *
     * <p>With a {@code clickId} the row is {@code LINK}-sourced and the click
     * carries the ad creative through to the Performance rollup; without one it
     * is a {@code MANUAL} code redemption.
     */
    @Transactional
    public RedemptionResponse logBooking(UUID profileId, LogBookingRequest request) {
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime eventAt = request.eventAt() == null ? now : request.eventAt();
        if (eventAt.isAfter(now.plus(FUTURE_TOLERANCE))) {
            throw badRequest("eventAt must not be in the future");
        }
        long bookings = request.bookings() == null ? 1 : request.bookings();
        BigDecimal revenue = request.revenue() == null ? BigDecimal.ZERO : request.revenue();

        AttributionRedemption redemption = new AttributionRedemption();
        redemption.setBusinessProfileId(profileId);
        redemption.setEventAt(eventAt);
        redemption.setBookings(bookings);
        redemption.setRevenue(revenue);

        AttributionCode code;
        if (request.clickId() != null) {
            code = codeForClick(profileId, request.clickId());
            if (request.attributionCodeId() != null
                    && !request.attributionCodeId().equals(code.getAttributionCodeId())) {
                throw badRequest("the click belongs to a different campaign than the selected code");
            }
            redemption.setSource(AttributionRedemption.SOURCE_LINK);
            redemption.setAttributionClickId(request.clickId());
        } else {
            if (request.attributionCodeId() == null) {
                throw badRequest("attributionCodeId or clickId is required");
            }
            code = codes.findByAttributionCodeIdAndBusinessProfileId(request.attributionCodeId(), profileId)
                    .orElseThrow(() -> notFound("attribution code"));
            redemption.setSource(AttributionRedemption.SOURCE_MANUAL);
        }
        if (code.getDiscountAmount() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Use voucher redemption to apply the discount and enforce the redemption limit");
        }
        redemption.setAttributionCodeId(code.getAttributionCodeId());

        AttributionRedemption saved = redemptions.saveAndFlush(redemption);
        CaptureKind kind = saved.getAttributionClickId() == null ? CaptureKind.CODE_LOGGED : CaptureKind.CLICK_MATCHED;
        return toResponse(saved, code.getCode(), kind);
    }

    /**
     * Undoes a mistaken log. Only rows the operator created can be removed:
     * a traveller's enquiry and a platform sync are evidence the operator
     * did not author, and deleting them would let a total be edited downward.
     */
    @Transactional
    public void delete(UUID profileId, UUID redemptionId) {
        AttributionRedemption redemption = redemptions.findById(redemptionId)
                .filter(r -> profileId.equals(r.getBusinessProfileId()))
                .orElseThrow(() -> notFound("redemption"));
        if (!kindOf(redemption, enquiryClickIds(profileId)).operatorAuthored()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "only bookings logged by the operator can be removed");
        }
        AttributionCode code = codes.findLockedByAttributionCodeIdAndBusinessProfileId(
                redemption.getAttributionCodeId(), profileId).orElseThrow(() -> notFound("attribution code"));
        redemptions.delete(redemption);
        if (code.getDiscountAmount() != null && "EXHAUSTED".equals(code.getVoucherStatus())) {
            code.setVoucherStatus("ACTIVE");
        }
    }

    // ─── read ────────────────────────────────────────────────────────────────

    /** All the operator's codes, newest window first, each with what it has captured. */
    @Transactional(readOnly = true)
    public List<CodeSummary> codeSummaries(UUID profileId) {
        OffsetDateTime now = OffsetDateTime.now();
        Set<UUID> enquiryClicks = enquiryClickIds(profileId);
        Map<UUID, List<AttributionRedemption>> byCode = redemptions.findByBusinessProfileId(profileId).stream()
                .collect(Collectors.groupingBy(AttributionRedemption::getAttributionCodeId));
        List<CampaignRecord> reportedRows = reported.all(profileId);

        return codes.findByBusinessProfileIdOrderByWindowStartDesc(profileId).stream()
                .map(code -> summarize(code, byCode.getOrDefault(code.getAttributionCodeId(), List.of()),
                        enquiryClicks, reportedRows, now))
                .toList();
    }

    /**
     * Bookings tracked in one reporting period ({@code periodStart} to
     * {@code periodEnd}, both inclusive, in the operator's time zone), for the
     * weekly form to show beside its Bookings field.
     */
    @Transactional(readOnly = true)
    public TrackedPeriodSummary tracked(UUID profileId, LocalDate periodStart, LocalDate periodEnd) {
        if (periodEnd.isBefore(periodStart)) {
            throw badRequest("periodEnd must not be before periodStart");
        }
        OffsetDateTime from = periodStart.atStartOfDay(OPERATOR_ZONE).toOffsetDateTime();
        OffsetDateTime to = periodEnd.plusDays(1).atStartOfDay(OPERATOR_ZONE).toOffsetDateTime();
        Set<UUID> enquiryClicks = enquiryClickIds(profileId);

        Map<CaptureKind, Long> counts = new EnumMap<>(CaptureKind.class);
        BigDecimal revenue = BigDecimal.ZERO;
        for (AttributionRedemption r : redemptions.findByBusinessProfileId(profileId)) {
            if (!inPeriod(r, from, to)) continue;
            counts.merge(kindOf(r, enquiryClicks), r.getBookings(), Long::sum);
            if (r.getRevenue() != null) revenue = revenue.add(r.getRevenue());
        }
        long automatic = counts.getOrDefault(CaptureKind.ENQUIRY, 0L)
                + counts.getOrDefault(CaptureKind.BOOKING_PLATFORM, 0L);
        long clickMatched = counts.getOrDefault(CaptureKind.CLICK_MATCHED, 0L);
        long codeLogged = counts.getOrDefault(CaptureKind.CODE_LOGGED, 0L);
        return new TrackedPeriodSummary(periodStart, periodEnd,
                automatic + clickMatched + codeLogged, automatic, clickMatched, codeLogged, revenue);
    }

    /** The most recent bookings across every code, for the operator's undo list. */
    @Transactional(readOnly = true)
    public List<RedemptionResponse> recent(UUID profileId) {
        Set<UUID> enquiryClicks = enquiryClickIds(profileId);
        Map<UUID, String> codeStrings = codes.findByBusinessProfileIdOrderByWindowStartDesc(profileId).stream()
                .collect(Collectors.toMap(AttributionCode::getAttributionCodeId, AttributionCode::getCode));

        return redemptions.findByBusinessProfileId(profileId).stream()
                .sorted(Comparator.comparing(AttributionRedemptionService::occurredAt, Comparator.reverseOrder()))
                .limit(RECENT_LIMIT)
                .map(r -> toResponse(r, codeStrings.get(r.getAttributionCodeId()), kindOf(r, enquiryClicks)))
                .toList();
    }

    /**
     * Splits a period's bookings by how they were captured, against the total the
     * operator reported for the same period.
     *
     * <p>Event rows count when their {@code eventAt} falls in {@code [from, to)};
     * a synced weekly row counts when its week starts inside the period.
     */
    @Transactional(readOnly = true)
    public BookingProvenance provenance(UUID profileId, OffsetDateTime from, OffsetDateTime to,
                                        long reportedBookings) {
        Set<UUID> enquiryClicks = enquiryClickIds(profileId);
        Map<CaptureKind, Long> counts = new EnumMap<>(CaptureKind.class);
        for (AttributionRedemption r : redemptions.findByBusinessProfileId(profileId)) {
            if (!inPeriod(r, from, to)) continue;
            counts.merge(kindOf(r, enquiryClicks), r.getBookings(), Long::sum);
        }
        long automatic = counts.getOrDefault(CaptureKind.ENQUIRY, 0L)
                + counts.getOrDefault(CaptureKind.BOOKING_PLATFORM, 0L);
        long clickMatched = counts.getOrDefault(CaptureKind.CLICK_MATCHED, 0L);
        long codeLogged = counts.getOrDefault(CaptureKind.CODE_LOGGED, 0L);
        long tracked = automatic + clickMatched + codeLogged;
        return new BookingProvenance(
                reportedBookings,
                tracked,
                automatic,
                clickMatched,
                codeLogged,
                Math.max(0, reportedBookings - tracked),
                tracked > reportedBookings);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /**
     * Resolves the code a click belongs to, and refuses a click that already
     * produced a booking — one click, one conversion, matching the enquiry path.
     * Locks the click row so two staff attaching the same click cannot both win.
     */
    private AttributionCode codeForClick(UUID profileId, UUID clickId) {
        AttributionClick click = clicks.findByClickIdForUpdate(clickId)
                .filter(c -> profileId.equals(c.getBusinessProfileId()))
                .orElseThrow(() -> notFound("click"));
        if (redemptions.existsByAttributionClickId(clickId) || enquiries.existsByClickId(clickId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "this click already has a booking attached");
        }
        AttributionLink link = links.findByLinkIdAndBusinessProfileId(click.getLinkId(), profileId)
                .orElseThrow(() -> notFound("click"));
        return codes.findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
                        profileId, link.getCategory(), link.getTargetMarket(), link.getWindowStart())
                .orElseThrow(() -> notFound("attribution code for this click"));
    }

    private CodeSummary summarize(AttributionCode code, List<AttributionRedemption> rows,
                                  Set<UUID> enquiryClicks, List<CampaignRecord> reportedRows,
                                  OffsetDateTime now) {
        Map<CaptureKind, List<AttributionRedemption>> byKind = rows.stream()
                .collect(Collectors.groupingBy(r -> kindOf(r, enquiryClicks),
                        () -> new EnumMap<>(CaptureKind.class), Collectors.toList()));
        List<KindTotal> totals = Arrays.stream(CaptureKind.values())
                .map(kind -> {
                    List<AttributionRedemption> group = byKind.getOrDefault(kind, List.of());
                    return new KindTotal(kind,
                            group.stream().mapToLong(AttributionRedemption::getBookings).sum(),
                            sumRevenue(group));
                })
                .toList();

        // Compare like with like: only bookings tracked inside the window's weeks
        // against what the operator reported for those same weeks.
        ReportedCampaignTotals.Totals window = reported.between(reportedRows,
                code.getWindowStart().toLocalDate(), code.getWindowEnd().toLocalDate());
        Long reportedBookings = window.isEmpty() ? null : window.bookings();
        long trackedInWindow = rows.stream()
                .filter(r -> inPeriod(r, code.getWindowStart(), code.getWindowEnd()))
                .mapToLong(AttributionRedemption::getBookings)
                .sum();

        CodeStatus status = now.isBefore(code.getWindowStart()) ? CodeStatus.UPCOMING
                : now.isAfter(code.getWindowEnd()) ? CodeStatus.ENDED
                : CodeStatus.ACTIVE;

        return new CodeSummary(
                code.getAttributionCodeId(),
                code.getCode(),
                code.getCategory(),
                code.getTargetMarket(),
                code.getWindowStart(),
                code.getWindowEnd(),
                status,
                rows.stream().mapToLong(AttributionRedemption::getBookings).sum(),
                sumRevenue(rows),
                totals,
                reportedBookings,
                reportedBookings != null && trackedInWindow > reportedBookings,
                code.getDiscountAmount() != null);
    }

    private static CaptureKind kindOf(AttributionRedemption r, Set<UUID> enquiryClicks) {
        return switch (r.getSource()) {
            case AttributionRedemption.SOURCE_FAREHARBOR -> CaptureKind.BOOKING_PLATFORM;
            case AttributionRedemption.SOURCE_LINK -> enquiryClicks.contains(r.getAttributionClickId())
                    ? CaptureKind.ENQUIRY : CaptureKind.CLICK_MATCHED;
            default -> CaptureKind.CODE_LOGGED;
        };
    }

    private Set<UUID> enquiryClickIds(UUID profileId) {
        return enquiries.findByBusinessProfileIdOrderByCreatedAtDesc(profileId).stream()
                .map(AttributionEnquiry::getClickId)
                .collect(Collectors.toSet());
    }

    private static boolean inPeriod(AttributionRedemption r, OffsetDateTime from, OffsetDateTime to) {
        if (r.getEventAt() != null) {
            return !r.getEventAt().isBefore(from) && r.getEventAt().isBefore(to);
        }
        if (r.getPeriodStart() != null) {
            OffsetDateTime start = r.getPeriodStart().atStartOfDay().atOffset(ZoneOffset.UTC);
            return !start.isBefore(from) && start.isBefore(to);
        }
        return false;
    }

    /** Synced weekly rows have no event time; their creation time stands in for sorting. */
    private static OffsetDateTime occurredAt(AttributionRedemption r) {
        return r.getEventAt() != null ? r.getEventAt() : r.getCreatedAt();
    }

    private static BigDecimal sumRevenue(List<AttributionRedemption> rows) {
        return rows.stream()
                .map(AttributionRedemption::getRevenue)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static RedemptionResponse toResponse(AttributionRedemption r, String code, CaptureKind kind) {
        return new RedemptionResponse(r.getRedemptionId(), r.getAttributionCodeId(), code, r.getSource(), kind,
                r.getBookings(), r.getRevenue(), r.getEventAt(), r.getAttributionClickId(),
                kind.operatorAuthored());
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException notFound(String what) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, what + " not found");
    }
}
