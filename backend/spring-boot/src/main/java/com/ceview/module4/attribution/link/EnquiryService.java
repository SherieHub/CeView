package com.ceview.module4.attribution.link;

import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EnquiryService {
    private final AttributionClickRepository clicks;
    private final AttributionLinkRepository links;
    private final AttributionCodeRepository codes;
    private final AttributionEnquiryRepository enquiries;
    private final AttributionRedemptionRepository redemptions;
    private final BusinessProfileRepository profiles;

    public EnquiryService(AttributionClickRepository clicks, AttributionLinkRepository links,
                          AttributionCodeRepository codes, AttributionEnquiryRepository enquiries,
                          AttributionRedemptionRepository redemptions, BusinessProfileRepository profiles) {
        this.clicks = clicks;
        this.links = links;
        this.codes = codes;
        this.enquiries = enquiries;
        this.redemptions = redemptions;
        this.profiles = profiles;
    }

    public record EnquiryContext(String businessName) {}
    public record OperatorEnquiry(UUID enquiryId, String contactName, String contactValue,
                                  Integer partySize, LocalDate requestedStart, LocalDate requestedEnd,
                                  String message, OffsetDateTime createdAt,
                                  String outcome, long bookings, BigDecimal revenue, boolean clickInWindow) {}

    public static class InvalidEnquiryException extends RuntimeException {}
    public static class EnquiryNotFoundException extends RuntimeException {}

    @Transactional(readOnly = true)
    public EnquiryContext context(UUID clickId) {
        AttributionClick click = clicks.findByClickId(clickId).orElseThrow(InvalidEnquiryException::new);
        validLink(click);
        return profiles.findById(click.getBusinessProfileId())
                .map(profile -> new EnquiryContext(profile.getBusinessName()))
                .orElseThrow(InvalidEnquiryException::new);
    }

    @Transactional
    public AttributionLinkDtos.EnquiryAck submit(AttributionLinkDtos.EnquiryRequest request) {
        // Serialize submissions for this click before checking either conversion guard.
        AttributionClick click = clicks.findByClickIdForUpdate(request.clickId())
                .orElseThrow(InvalidEnquiryException::new);
        OffsetDateTime now = OffsetDateTime.now();
        AttributionLink link = validLink(click);
        AttributionCode code = codes.findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
                click.getBusinessProfileId(), link.getCategory(), link.getTargetMarket(), link.getWindowStart())
                .orElseThrow(InvalidEnquiryException::new);
        if (request.requestedStart() != null && request.requestedEnd() != null
                && request.requestedEnd().isBefore(request.requestedStart())) {
            throw new InvalidEnquiryException();
        }

        AttributionEnquiry enquiry = new AttributionEnquiry();
        enquiry.setClickId(click.getClickId());
        enquiry.setBusinessProfileId(click.getBusinessProfileId());
        enquiry.setContactName(request.contactName().trim());
        enquiry.setContactValue(request.contactValue().trim());
        enquiry.setPartySize(request.partySize());
        enquiry.setRequestedStart(request.requestedStart());
        enquiry.setRequestedEnd(request.requestedEnd());
        enquiry.setMessage(request.message());
        enquiry.setCreatedAt(now);
        try {
            enquiries.saveAndFlush(enquiry);
        } catch (org.springframework.dao.DataIntegrityViolationException e) {
            // The existing unique constraint also protects against writers not taking the click lock.
            throw new InvalidEnquiryException();
        }

        redemptions.saveAndFlush(linkRedemption(click, code, now, 1, BigDecimal.ZERO));
        return AttributionLinkDtos.EnquiryAck.ok();
    }

    private static AttributionRedemption linkRedemption(AttributionClick click, AttributionCode code,
                                                        OffsetDateTime at, long bookings, BigDecimal revenue) {
        AttributionRedemption redemption = new AttributionRedemption();
        redemption.setAttributionCodeId(code.getAttributionCodeId());
        redemption.setBusinessProfileId(click.getBusinessProfileId());
        redemption.setAttributionClickId(click.getClickId());
        redemption.setSource(AttributionRedemption.SOURCE_LINK);
        redemption.setEventAt(at);
        redemption.setBookings(bookings);
        redemption.setRevenue(revenue);
        return redemption;
    }

    /**
     * A click is usable until it has produced an enquiry or a booking. The campaign window is
     * deliberately not checked: ads and posts outlive it, and the click already carries
     * {@code inWindow} so analytics can tell a late lead from an in-window one.
     */
    private AttributionLink validLink(AttributionClick click) {
        AttributionLink link = links.findByLinkIdAndBusinessProfileId(
                click.getLinkId(), click.getBusinessProfileId()).orElseThrow(InvalidEnquiryException::new);
        if (enquiries.existsByClickId(click.getClickId())
                || redemptions.existsByAttributionClickId(click.getClickId())) {
            throw new InvalidEnquiryException();
        }
        return link;
    }

    @Transactional(readOnly = true)
    public List<OperatorEnquiry> list(UUID businessProfileId) {
        List<AttributionEnquiry> rows = enquiries.findByBusinessProfileIdOrderByCreatedAtDesc(businessProfileId);
        List<UUID> clickIds = rows.stream().map(AttributionEnquiry::getClickId).toList();
        Map<UUID, List<AttributionRedemption>> byClick = redemptions.findByAttributionClickIdIn(clickIds).stream()
                .collect(Collectors.groupingBy(AttributionRedemption::getAttributionClickId));
        Map<UUID, AttributionClick> clickById = clicks.findAllById(clickIds).stream()
                .collect(Collectors.toMap(AttributionClick::getClickId, Function.identity()));
        return rows.stream().map(e -> toOperator(e, byClick.getOrDefault(e.getClickId(), List.of()),
                clickById.get(e.getClickId()))).toList();
    }

    /**
     * Records what the operator decided. {@code BOOKED} sets the real bookings and revenue on the
     * enquiry's redemption (re-creating it if an earlier decline removed it); {@code DECLINED} removes
     * that redemption so it stops counting, while the enquiry stays as the record of the lead.
     *
     * <p>Scoped to {@code businessProfileId}: another operator's enquiry id is indistinguishable from an
     * unknown one.
     */
    @Transactional
    public OperatorEnquiry decide(UUID businessProfileId, UUID enquiryId,
                                  AttributionLinkDtos.EnquiryOutcomeRequest request) {
        AttributionEnquiry enquiry = enquiries.findById(enquiryId)
                .filter(e -> businessProfileId.equals(e.getBusinessProfileId()))
                .orElseThrow(EnquiryNotFoundException::new);
        // Same lock submit() takes, so a decision cannot interleave with another one on this click.
        AttributionClick click = clicks.findByClickIdForUpdate(enquiry.getClickId())
                .orElseThrow(EnquiryNotFoundException::new);
        List<AttributionRedemption> existing = redemptions.findByAttributionClickIdIn(List.of(click.getClickId()));

        if (request.outcome() == AttributionLinkDtos.EnquiryDecision.DECLINED) {
            redemptions.deleteAll(existing);
            existing = List.of();
            enquiry.setOutcome(AttributionEnquiry.OUTCOME_DECLINED);
        } else {
            AttributionRedemption redemption = existing.isEmpty()
                    ? rebook(click, enquiry)
                    : existing.get(0);
            if (request.bookings() != null) redemption.setBookings(request.bookings());
            if (request.revenue() != null) redemption.setRevenue(request.revenue());
            existing = List.of(redemptions.saveAndFlush(redemption));
            enquiry.setOutcome(AttributionEnquiry.OUTCOME_BOOKED);
        }
        enquiry.setOutcomeAt(OffsetDateTime.now());
        enquiries.saveAndFlush(enquiry);
        return toOperator(enquiry, existing, click);
    }

    private AttributionRedemption rebook(AttributionClick click, AttributionEnquiry enquiry) {
        AttributionLink link = links.findByLinkIdAndBusinessProfileId(click.getLinkId(), enquiry.getBusinessProfileId())
                .orElseThrow(EnquiryNotFoundException::new);
        AttributionCode code = codes.findByBusinessProfileIdAndCategoryAndTargetMarketAndWindowStart(
                        enquiry.getBusinessProfileId(), link.getCategory(), link.getTargetMarket(), link.getWindowStart())
                .orElseThrow(EnquiryNotFoundException::new);
        return linkRedemption(click, code, OffsetDateTime.now(), 1, BigDecimal.ZERO);
    }

    private static OperatorEnquiry toOperator(AttributionEnquiry e, List<AttributionRedemption> redemptionRows,
                                              AttributionClick click) {
        long bookings = redemptionRows.stream().mapToLong(AttributionRedemption::getBookings).sum();
        BigDecimal revenue = redemptionRows.stream().map(AttributionRedemption::getRevenue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new OperatorEnquiry(e.getEnquiryId(), e.getContactName(), e.getContactValue(),
                e.getPartySize(), e.getRequestedStart(), e.getRequestedEnd(), e.getMessage(), e.getCreatedAt(),
                e.getOutcome(), bookings, revenue, click == null || click.isInWindow());
    }
}
