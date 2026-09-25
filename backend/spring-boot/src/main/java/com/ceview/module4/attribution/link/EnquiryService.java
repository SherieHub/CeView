package com.ceview.module4.attribution.link;

import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module4.attribution.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

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
                                  String message, OffsetDateTime createdAt) {}

    public static class InvalidEnquiryException extends RuntimeException {}

    @Transactional(readOnly = true)
    public EnquiryContext context(UUID clickId) {
        AttributionClick click = clicks.findByClickId(clickId).orElseThrow(InvalidEnquiryException::new);
        validLink(click, OffsetDateTime.now());
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
        AttributionLink link = validLink(click, now);
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

        AttributionRedemption redemption = new AttributionRedemption();
        redemption.setAttributionCodeId(code.getAttributionCodeId());
        redemption.setBusinessProfileId(click.getBusinessProfileId());
        redemption.setAttributionClickId(click.getClickId());
        redemption.setSource(AttributionRedemption.SOURCE_LINK);
        redemption.setEventAt(now);
        redemption.setBookings(1);
        redemption.setRevenue(BigDecimal.ZERO);
        redemptions.saveAndFlush(redemption);
        return AttributionLinkDtos.EnquiryAck.ok();
    }

    private AttributionLink validLink(AttributionClick click, OffsetDateTime now) {
        AttributionLink link = links.findByLinkIdAndBusinessProfileId(
                click.getLinkId(), click.getBusinessProfileId()).orElseThrow(InvalidEnquiryException::new);
        if (!AttributionWindow.covers(link.getWindowStart(), link.getWindowEnd(), now)
                || enquiries.existsByClickId(click.getClickId())
                || redemptions.existsByAttributionClickId(click.getClickId())) {
            throw new InvalidEnquiryException();
        }
        return link;
    }

    @Transactional(readOnly = true)
    public List<OperatorEnquiry> list(UUID businessProfileId) {
        return enquiries.findByBusinessProfileIdOrderByCreatedAtDesc(businessProfileId).stream()
                .map(e -> new OperatorEnquiry(e.getEnquiryId(), e.getContactName(), e.getContactValue(),
                        e.getPartySize(), e.getRequestedStart(), e.getRequestedEnd(), e.getMessage(), e.getCreatedAt()))
                .toList();
    }
}
