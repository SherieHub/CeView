package com.ceview.module4.attribution;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class VoucherRedemptionService {
    private final AttributionCodeRepository codes;
    private final AttributionRedemptionRepository redemptions;

    public VoucherRedemptionService(AttributionCodeRepository codes, AttributionRedemptionRepository redemptions) {
        this.codes = codes;
        this.redemptions = redemptions;
    }

    @Transactional
    public RedemptionResult redeem(UUID profileId, UUID codeId, BigDecimal grossRevenue, OffsetDateTime eventAt) {
        if (grossRevenue == null || grossRevenue.signum() < 0) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "grossRevenue must be non-negative");
        }
        AttributionCode code = codes.findLockedByAttributionCodeIdAndBusinessProfileId(codeId, profileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "voucher not found"));
        OffsetDateTime at = eventAt == null ? OffsetDateTime.now() : eventAt;
        if (code.getDiscountAmount() == null || !"ACTIVE".equals(code.getVoucherStatus())
                || at.isBefore(code.getWindowStart()) || at.isAfter(code.getWindowEnd())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "voucher is not active for this booking");
        }
        long used = redemptions.countByAttributionCodeIdAndSource(codeId, AttributionRedemption.SOURCE_MANUAL);
        if (code.getRedemptionLimit() != null && used >= code.getRedemptionLimit()) {
            code.setVoucherStatus("EXHAUSTED");
            throw new ResponseStatusException(HttpStatus.CONFLICT, "voucher_redemption_limit_reached");
        }
        BigDecimal net = grossRevenue.subtract(code.getDiscountAmount()).max(BigDecimal.ZERO);
        AttributionRedemption row = new AttributionRedemption();
        row.setAttributionCodeId(codeId); row.setBusinessProfileId(profileId);
        row.setSource(AttributionRedemption.SOURCE_MANUAL); row.setEventAt(at); row.setBookings(1);
        row.setGrossRevenue(grossRevenue); row.setRevenue(net);
        redemptions.save(row);
        long remaining = code.getRedemptionLimit() == null ? -1 : code.getRedemptionLimit() - used - 1;
        if (remaining == 0) code.setVoucherStatus("EXHAUSTED");
        return new RedemptionResult(code.getCode(), grossRevenue, code.getDiscountAmount(), net, remaining);
    }

    public record RedemptionResult(String code, BigDecimal grossRevenue, BigDecimal discountAmount,
                                   BigDecimal netRevenue, long redemptionsRemaining) { }
}
