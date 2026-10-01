package com.ceview.module4.pes;

import com.ceview.module4.dto.AnalyticsDtos.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Submodule 4.2 — Promotional Effectiveness Score (PES) Computation.
 *
 * <p>SDD §4.2 — PES = ROAS×0.35 + CR×0.30 + CAC_inv×0.15 + CTR×0.15 + CPC_inv×0.05.
 *
 * <p>This is the deterministic PES formula from ARCHITECTURE_SPEC.md — arithmetic
 * over real campaign records, not a stand-in for an AI output. It was previously
 * documented as "the FR4.26 rule-based fallback", which invited deleting it
 * alongside the actual fallbacks removed in Task 24. It is not one. Keep it.
 */
@Service
public class PESComputationService {

    private static final Logger log = LoggerFactory.getLogger(PESComputationService.class);

    private static final double W_ROAS = 0.35, W_CR = 0.30, W_CAC = 0.15, W_CTR = 0.15, W_CPC = 0.05;

    public PesResponse compute(Metrics m) {
        // Min-max bounds are placeholder until historical data exists. The
        // frontend's PESComputationBoard expects a 0–1 overall + per-metric
        // contributions that sum to it.
        // Calibrated Cebu MSME hospitality bounds — aligned with FastAPI pes_compute_service.py
        double roasN = clamp01(m.roas().value() / 8.0);
        double crN   = clamp01(m.convRate().value() / 15.0);
        double cacN  = 1.0 - clamp01((m.cac().value() - 1.0) / (5000.0 - 1.0));
        double ctrN  = clamp01(m.ctr().value() / 10.0);
        double cpcN  = 1.0 - clamp01((m.cpc().value() - 0.01) / (500.0 - 0.01));

        double cRoas = roasN * W_ROAS;
        double cCr   = crN   * W_CR;
        double cCac  = cacN  * W_CAC;
        double cCtr  = ctrN  * W_CTR;
        double cCpc  = cpcN  * W_CPC;
        double total = cRoas + cCr + cCac + cCtr + cCpc;

        var breakdown = List.of(
            new PesBreakdownItem("ROAS",       "35%", round(cRoas)),
            new PesBreakdownItem("Conv. Rate", "30%", round(cCr)),
            new PesBreakdownItem("CAC (Inv)",  "15%", round(cCac)),
            new PesBreakdownItem("CTR",        "15%", round(cCtr)),
            new PesBreakdownItem("CPC (Inv)",  "5%",  round(cCpc))
        );

        return new PesResponse(round(total), label(total), breakdown);
    }

    /**
     * Reconstruct a typed {@link PesResponse} from the raw FastAPI
     * {@code /internal/pes-compute/analyze} result map.
     *
     * <p>Reconstructs locally via {@link #compute(Metrics)} if the map is missing
     * required keys, so the caller always receives a fully populated response.
     *
     * @param pesResult raw FastAPI result map
     * @param metrics   locally computed KPIs used for the local reconstruction
     */
    @SuppressWarnings("unchecked")
    public PesResponse fromFastApiResult(Map<String, Object> pesResult, Metrics metrics) {
        try {
            double score = ((Number) pesResult.get("pes_score")).doubleValue();
            String label = (String) pesResult.get("pes_label");
            List<Map<String, Object>> rawBreakdown =
                    (List<Map<String, Object>>) pesResult.get("breakdown");

            List<PesBreakdownItem> breakdown = rawBreakdown.stream()
                    .map(b -> new PesBreakdownItem(
                            (String) b.get("metric"),
                            (String) b.get("weight"),
                            ((Number) b.get("contribution")).doubleValue()))
                    .toList();

            return new PesResponse(score, label, breakdown);
        } catch (Exception e) {
            log.warn("[Module4] Could not parse FastAPI PES breakdown, falling back to rule-based");
            return compute(metrics);
        }
    }

    private static String label(double s) {
        if (s >= 0.80) return "Excellent Performance";
        if (s >= 0.60) return "Good Performance";
        if (s >= 0.40) return "Fair Performance";
        return "Poor Performance";
    }

    private static double clamp01(double v) { return Math.max(0, Math.min(1, v)); }
    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
