package com.ceview.module4.attribution;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module4.attribution.AttributionDtos.CodeSummary;
import com.ceview.module4.attribution.AttributionDtos.LiftResponse;
import com.ceview.module4.attribution.AttributionDtos.LogBookingRequest;
import com.ceview.module4.attribution.AttributionDtos.RedemptionResponse;
import com.ceview.module4.attribution.AttributionDtos.TrackedPeriodSummary;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Authenticated, tenant-scoped code-redemption capture (CVW-42).
 *
 * <p>Sibling of {@code AttributionLinkController} under the same
 * {@code /api/attribution} prefix: links answer "which creative", codes and
 * logged bookings cover the Messenger, phone and walk-in bookings a link never sees.
 */
@RestController
@RequestMapping("/api/attribution")
public class AttributionController {

    private final CurrentBusinessProfile currentBusinessProfile;
    private final AttributionRedemptionService redemptionService;
    private final AttributionLiftService liftService;

    public AttributionController(CurrentBusinessProfile currentBusinessProfile,
                                 AttributionRedemptionService redemptionService,
                                 AttributionLiftService liftService) {
        this.currentBusinessProfile = currentBusinessProfile;
        this.redemptionService = redemptionService;
        this.liftService = liftService;
    }

    /** The operator's codes with what each has captured, newest window first. */
    @GetMapping("/codes")
    public List<CodeSummary> codes() {
        return redemptionService.codeSummaries(currentBusinessProfile.resolveProfileId());
    }

    /** Logs one booking at the moment it is taken. */
    @PostMapping("/redemptions")
    @ResponseStatus(HttpStatus.CREATED)
    public RedemptionResponse logBooking(@Valid @RequestBody LogBookingRequest request) {
        return redemptionService.logBooking(currentBusinessProfile.resolveProfileId(), request);
    }

    /** Most recent bookings across all codes, so a mistaken log can be found and undone. */
    @GetMapping("/redemptions")
    public List<RedemptionResponse> recent() {
        return redemptionService.recent(currentBusinessProfile.resolveProfileId());
    }

    @DeleteMapping("/redemptions/{redemptionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID redemptionId) {
        redemptionService.delete(currentBusinessProfile.resolveProfileId(), redemptionId);
    }

    /** Bookings tracked in one reporting period, for the weekly form's Bookings field. */
    @GetMapping("/tracked")
    public TrackedPeriodSummary tracked(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodStart,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodEnd) {
        return redemptionService.tracked(currentBusinessProfile.resolveProfileId(), periodStart, periodEnd);
    }

    /** Window vs. pre-window comparison of the operator's reported results for one code. */
    @GetMapping("/lift/{attributionCodeId}")
    public LiftResponse lift(@PathVariable UUID attributionCodeId) {
        return liftService.liftFor(currentBusinessProfile.resolveProfileId(), attributionCodeId);
    }
}
