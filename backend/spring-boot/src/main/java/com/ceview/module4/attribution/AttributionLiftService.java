package com.ceview.module4.attribution;

import com.ceview.module4.attribution.AttributionDtos.LiftResponse;
import com.ceview.module4.attribution.AttributionDtos.LiftStatus;
import com.ceview.module4.attribution.ReportedCampaignTotals.Totals;
import com.ceview.module4.engagement.CampaignRecord;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Statistical lift for a campaign code (marketing-attribution spec, phase 4).
 *
 * <p>Compares the operator's reported bookings and revenue during the code's
 * surge window with the {@value #BASELINE_DAYS}-day period immediately before
 * it. It is evidence of a different kind from code redemptions: it needs no
 * customer to quote anything, but it also cannot tell the campaign apart from
 * anything else that changed that fortnight — which is why the Performance
 * screen shows it beside the direct evidence rather than merged into it.
 *
 * <p>Both sides are normalised to a per-week rate, because a 14-day window and
 * a 28-day baseline (or a shorter one, for a new operator) are otherwise not
 * comparable. A baseline shorter than four weeks is used but flagged, never
 * padded with invented history.
 */
@Service
public class AttributionLiftService {

    /** Four complete weeks before the window, fixed by the spec. */
    static final int BASELINE_DAYS = 28;

    private final AttributionCodeRepository codes;
    private final ReportedCampaignTotals reported;

    public AttributionLiftService(AttributionCodeRepository codes, ReportedCampaignTotals reported) {
        this.codes = codes;
        this.reported = reported;
    }

    @Transactional(readOnly = true)
    public LiftResponse liftFor(UUID profileId, UUID attributionCodeId) {
        AttributionCode code = codes.findByAttributionCodeIdAndBusinessProfileId(attributionCodeId, profileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "attribution code not found"));

        LocalDate windowFrom = code.getWindowStart().toLocalDate();
        LocalDate windowTo = code.getWindowEnd().toLocalDate();
        LocalDate baselineFrom = windowFrom.minusDays(BASELINE_DAYS);

        List<CampaignRecord> rows = reported.all(profileId);
        Totals window = reported.between(rows, windowFrom, windowTo);
        Totals baseline = reported.between(rows, baselineFrom, windowFrom);

        BigDecimal windowBookings = perWeek(window.bookings(), window.days());
        BigDecimal baselineBookings = perWeek(baseline.bookings(), baseline.days());
        BigDecimal windowRevenue = perWeek(window.revenue(), window.days());
        BigDecimal baselineRevenue = perWeek(baseline.revenue(), baseline.days());

        LiftStatus status;
        if (OffsetDateTime.now().isBefore(code.getWindowStart())) status = LiftStatus.UPCOMING;
        else if (window.isEmpty()) status = LiftStatus.NO_WINDOW_DATA;
        else if (baseline.isEmpty()) status = LiftStatus.NO_BASELINE;
        else status = LiftStatus.OK;

        boolean comparable = status == LiftStatus.OK;
        return new LiftResponse(
                code.getAttributionCodeId(),
                code.getCode(),
                code.getWindowStart(),
                code.getWindowEnd(),
                baselineFrom,
                status,
                window.periods(),
                baseline.periods(),
                weeks(baseline.days()),
                !baseline.isEmpty() && baseline.days() < BASELINE_DAYS,
                window.isEmpty() ? null : windowBookings,
                baseline.isEmpty() ? null : baselineBookings,
                comparable ? liftPct(windowBookings, baselineBookings) : null,
                window.isEmpty() ? null : windowRevenue,
                baseline.isEmpty() ? null : baselineRevenue,
                comparable ? liftPct(windowRevenue, baselineRevenue) : null);
    }

    private static BigDecimal perWeek(double amount, long days) {
        if (days <= 0) return BigDecimal.ZERO;
        return BigDecimal.valueOf(amount * 7.0 / days).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal weeks(long days) {
        return BigDecimal.valueOf(days / 7.0).setScale(1, RoundingMode.HALF_UP);
    }

    /** Null when the baseline is zero: a percentage change from nothing is not a number. */
    private static BigDecimal liftPct(BigDecimal window, BigDecimal baseline) {
        if (baseline.signum() == 0) return null;
        return window.subtract(baseline)
                .multiply(BigDecimal.valueOf(100))
                .divide(baseline, 1, RoundingMode.HALF_UP);
    }
}
