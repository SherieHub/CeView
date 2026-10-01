package com.ceview.module4.pes;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module4.dto.AnalyticsDtos.*;
import com.ceview.module4.engagement.MetricsCalculationService;
import org.springframework.web.bind.annotation.*;

/**
 * Submodule 4.2 — Promotional Effectiveness Score (PES) Computation.
 *
 * <ul>
 *   <li>{@code GET /pes/{campaignId}} → PesResponse breakdown for the PESComputationBoard;
 *       {@code ?weeks=4|8}</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/analytics")
public class PesComputationController {

    private final MetricsCalculationService metricsSvc;
    private final PESComputationService     pesSvc;
    private final CurrentBusinessProfile    currentBusinessProfile;

    public PesComputationController(
            MetricsCalculationService metricsSvc,
            PESComputationService pesSvc,
            CurrentBusinessProfile currentBusinessProfile) {
        this.metricsSvc = metricsSvc;
        this.pesSvc     = pesSvc;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    // ─── GET /pes/{campaignId} ────────────────────────────────────────────────

    /**
     * Promotional Effectiveness Score breakdown.
     *
     * @param weeks Analysis window — forwarded to default-metrics computation.
     */
    @GetMapping("/pes/{campaignId}")
    public PesResponse pes(
            @PathVariable String campaignId,
            @RequestParam(required = false, defaultValue = "4") int weeks) {
        return pesSvc.compute(metricsSvc.defaultMetrics(
                currentBusinessProfile.resolveProfileId(), weeks).metrics());
    }
}
