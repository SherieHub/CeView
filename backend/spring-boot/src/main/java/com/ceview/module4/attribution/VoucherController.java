package com.ceview.module4.attribution;

import com.ceview.auth.CurrentBusinessProfile;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/attribution/vouchers")
public class VoucherController {
    private final CurrentBusinessProfile current; private final AttributionCodeRepository codes;
    private final AttributionRedemptionRepository redemptions; private final VoucherRedemptionService service; private final AttributionCodeService codeService;
    public VoucherController(CurrentBusinessProfile current, AttributionCodeRepository codes,
                             AttributionRedemptionRepository redemptions, VoucherRedemptionService service, AttributionCodeService codeService) {
        this.current=current; this.codes=codes; this.redemptions=redemptions; this.service=service; this.codeService=codeService;
    }
    @GetMapping @Transactional(readOnly = true)
    public List<VoucherResponse> list() { UUID profile=current.resolveProfileId(); return codes.findByBusinessProfileIdOrderByWindowStartDesc(profile).stream()
        .filter(c -> c.getDiscountAmount()!=null).map(c -> response(c)).toList(); }
    @PostMapping("/{codeId}/redeem")
    public VoucherRedemptionService.RedemptionResult redeem(@PathVariable UUID codeId, @Valid @RequestBody RedeemRequest request) {
        return service.redeem(current.resolveProfileId(), codeId, request.grossRevenue(), request.eventAt()); }
    @PostMapping("/cvlaunch")
    public VoucherResponse createCvLaunch(@Valid @RequestBody CvLaunchRequest request) {
        var code=codeService.createCvLaunch(current.resolveProfileId(), request.category(), request.targetMarket(), request.windowStart(), request.windowEnd());
        return response(code);
    }
    @PostMapping
    public VoucherResponse createVoucher(@Valid @RequestBody CreateVoucherRequest request) {
        var code = codeService.createVoucher(current.resolveProfileId(), request.code(), request.discountAmount(), request.redemptionLimit(),
                request.category(), request.targetMarket(), request.windowStart(), request.windowEnd());
        return response(code);
    }
    private VoucherResponse response(AttributionCode c) { long used=redemptions.countByAttributionCodeIdAndSource(c.getAttributionCodeId(), AttributionRedemption.SOURCE_MANUAL);
        long remaining=c.getRedemptionLimit()==null ? -1 : Math.max(0,c.getRedemptionLimit()-used);
        String status = OffsetDateTime.now().isAfter(c.getWindowEnd()) ? "EXPIRED" : c.getVoucherStatus();
        return new VoucherResponse(c.getAttributionCodeId(),c.getCode(),c.getDiscountAmount(),c.getRedemptionLimit(),used,remaining,status); }
    public record RedeemRequest(@NotNull BigDecimal grossRevenue, OffsetDateTime eventAt) { }
    public record CvLaunchRequest(@NotNull String category, @NotNull String targetMarket, @NotNull OffsetDateTime windowStart, @NotNull OffsetDateTime windowEnd) { }
    public record CreateVoucherRequest(@NotNull String code, @NotNull BigDecimal discountAmount, @NotNull Long redemptionLimit,
                                      @NotNull String category, @NotNull String targetMarket, @NotNull OffsetDateTime windowStart, @NotNull OffsetDateTime windowEnd) { }
    public record VoucherResponse(UUID attributionCodeId,String code,BigDecimal discountAmount,Long redemptionLimit,long redemptionsUsed,long redemptionsRemaining,String voucherStatus) { }
}
