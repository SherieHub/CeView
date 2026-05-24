package com.ceview.module4;

import com.ceview.module4.dto.AnalyticsDtos.*;
import org.springframework.stereotype.Service;

import java.util.List;

/** SDD §4.2 — PES = ROAS×0.35 + CR×0.30 + CAC_inv×0.15 + CTR×0.15 + CPC_inv×0.05. */
@Service
public class PESComputationService {

    private static final double W_ROAS = 0.35, W_CR = 0.30, W_CAC = 0.15, W_CTR = 0.15, W_CPC = 0.05;

    public PesResponse compute(Metrics m) {
        // Min-max bounds are placeholder until historical data exists. The
        // frontend's PESComputationBoard expects a 0–1 overall + per-metric
        // contributions that sum to it.
        double roasN = clamp01(m.roas().value() / 5.0);             // 5x ROAS = ceiling
        double crN   = clamp01(m.convRate().value() / 10.0);        // 10% CR = ceiling
        double cacN  = 1.0 - clamp01(m.cac().value() / 5000.0);     // lower CAC = better
        double ctrN  = clamp01(m.ctr().value() / 10.0);             // 10% CTR = ceiling
        double cpcN  = 1.0 - clamp01(m.cpc().value() / 100.0);      // lower CPC = better

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

    private static String label(double s) {
        if (s >= 0.80) return "Excellent Performance";
        if (s >= 0.60) return "Good Performance";
        if (s >= 0.40) return "Fair Performance";
        return "Poor Performance";
    }

    private static double clamp01(double v) { return Math.max(0, Math.min(1, v)); }
    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
