package com.ceview.module4.engagement;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module4.dto.AnalyticsDtos.*;
import com.ceview.module4.pes.PESComputationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Submodule 4.1 — Campaign Engagement Metrics.
 *
 * <ul>
 *   <li>{@code GET  /metrics}  → MetricsResponse (KPIs + funnel); {@code ?weeks=4|8}</li>
 *   <li>{@code POST /manual}   → same shape, computed from operator-entered values;
 *                                also persists to PostgreSQL and enriches PES via FastAPI</li>
 *   <li>{@code GET  /history}  → CampaignHistoryResponse (weekly PES trend); {@code ?weeks=4|8}</li>
 * </ul>
 *
 * <h3>FR4.26 — Fallback Mechanism</h3>
 * The {@code /manual} pipeline delegates PES enrichment to FastAPI inside a
 * {@code try-catch}.  If the AI microservice is unavailable, Spring Boot falls
 * back to {@link PESComputationService} (submodule 4.2) and the REST response is
 * still fully populated — the UI never crashes.
 */
@RestController
@RequestMapping("/api/analytics")
public class EngagementMetricsController {

    private static final Logger log = LoggerFactory.getLogger(EngagementMetricsController.class);

    private final MetricsCalculationService metricsSvc;
    private final PESComputationService     pesSvc;
    private final AIInferenceGatewayService ai;
    private final CampaignRecordRepository  campaignRepo;
    private final CurrentBusinessProfile    currentBusinessProfile;

    public EngagementMetricsController(
            MetricsCalculationService metricsSvc,
            PESComputationService pesSvc,
            AIInferenceGatewayService ai,
            CampaignRecordRepository campaignRepo,
            CurrentBusinessProfile currentBusinessProfile) {
        this.metricsSvc   = metricsSvc;
        this.pesSvc       = pesSvc;
        this.ai           = ai;
        this.campaignRepo = campaignRepo;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    // ─── GET /metrics ─────────────────────────────────────────────────────────

    /**
     * Default campaign metrics for the EngagementMetricsBoard, aggregated from
     * the authenticated operator's own {@code tbl_campaign_records} (Task 13).
     *
     * @param weeks Analysis window — 4 (default) or 8.
     */
    @GetMapping("/metrics")
    public MetricsResponse metrics(
            @RequestParam(required = false, defaultValue = "4") int weeks) {
        return metricsSvc.defaultMetrics(currentBusinessProfile.resolveProfileId(), weeks);
    }

    // ─── POST /manual ─────────────────────────────────────────────────────────

    /**
     * Compute metrics from operator-entered raw campaign values.
     *
     * <h4>Full pipeline (SDD §4.1):</h4>
     * <ol>
     *   <li>Compute KPIs locally via {@link MetricsCalculationService} (fast, synchronous).</li>
     *   <li>Persist raw data + KPIs to {@code tbl_campaign_records} via JPA.</li>
     *   <li>Forward the raw inputs to FastAPI {@code /internal/pes-compute/analyze}
     *       which applies Min-Max normalization, inversion, PES formula, and AI insights.</li>
     *   <li>Update the saved record with the FastAPI PES score.</li>
     *   <li><b>FR4.26 Fallback:</b> if FastAPI is unreachable, the PES is computed
     *       locally by {@link PESComputationService} and the record is still saved.</li>
     * </ol>
     *
     * @return {@link ManualIngestResponse} — metrics, funnel, and the computed PES score
     *         so the frontend can display an accurate score without a second round-trip.
     */
    @PostMapping("/manual")
    public ManualIngestResponse manualIngest(@RequestBody ManualIngestRequest in) {

        // ── 1. Local KPI computation ─────────────────────────────────────────
        MetricsResponse mr = metricsSvc.compute(in);

        // ── 2. Persist raw inputs + derived KPIs ─────────────────────────────
        CampaignRecord record = CampaignRecord.from(in);
        record.setBusinessProfileId(currentBusinessProfile.resolveProfileId());
        record.enrichWithKpis(
                mr.metrics().ctr().value(),
                mr.metrics().cpc().value(),
                mr.metrics().convRate().value(),
                mr.metrics().roas().value(),
                mr.metrics().cac().value()
        );
        campaignRepo.save(record);
        log.info("[Module4] campaign record saved id={}", record.getId());

        // ── 3. Forward to FastAPI PES compute + 4. Enrich DB record ──────────
        PesResponse pes;
        try {
            Map<String, Object> pesResult = ai.computePesFromRaw(buildRawPayload(in));

            double pesScore = ((Number) pesResult.getOrDefault("pes_score", 0.0)).doubleValue();
            String pesLabel = (String)  pesResult.getOrDefault("pes_label",  "");
            record.enrichWithPes(pesScore, pesLabel);
            campaignRepo.save(record);
            log.info("[Module4] FastAPI PES ok  id={}  score={}  label={}",
                     record.getId(), pesScore, pesLabel);

            pes = pesSvc.fromFastApiResult(pesResult, mr.metrics());

        } catch (Exception e) {
            // ── FR4.26 Fallback ────────────────────────────────────────────────
            log.warn("[Module4 FR4.26] FastAPI PES compute unavailable ({}); " +
                     "using Spring Boot rule-based PES fallback", e.getMessage());

            pes = pesSvc.compute(mr.metrics());
            record.enrichWithPes(pes.overallScore(), pes.label());
            campaignRepo.save(record);
            log.info("[Module4 FR4.26] fallback PES saved  id={}  score={}",
                     record.getId(), pes.overallScore());
        }

        return new ManualIngestResponse(mr.metrics(), mr.funnel(), pes);
    }

    // ─── GET /history ─────────────────────────────────────────────────────────

    /**
     * Weekly PES trend for the line chart.
     *
     * Returns the {@code weeks} most recent campaign records in chronological order
     * so the frontend can plot a left-to-right trend line.
     *
     * @param weeks 4 (default) or 8 — controls how many data points are returned.
     */
    @GetMapping("/history")
    public CampaignHistoryResponse history(
            @RequestParam(required = false, defaultValue = "4") int weeks) {
        int limit = (weeks == 8) ? 8 : 4;
        UUID profileId = currentBusinessProfile.resolveProfileId();
        List<CampaignRecord> records = campaignRepo.findByBusinessProfileIdOrderByCreatedAtDesc(
                profileId, PageRequest.of(0, limit));
        Collections.reverse(records);
        List<CampaignSnapshot> snapshots = records.stream()
                .map(r -> new CampaignSnapshot(
                        r.getPeriodStart(), r.getPeriodEnd(),
                        r.getPesScore()  != null ? r.getPesScore()  : 0.0,
                        r.getPesLabel()  != null ? r.getPesLabel()  : "",
                        r.getCtr(), r.getCpc(), r.getRoas(), r.getConvRate(), r.getCac()))
                .toList();
        return new CampaignHistoryResponse(snapshots);
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    /** Build the raw-input map forwarded to FastAPI pes-compute/analyze. */
    private static Map<String, Object> buildRawPayload(ManualIngestRequest in) {
        return Map.of(
                "impressions",  in.impressions()  != null ? in.impressions()  : 0,
                "clicks",       in.clicks()       != null ? in.clicks()       : 0,
                "adSpend",      in.adSpend()      != null ? in.adSpend()      : 0.0,
                "revenue",      in.revenue()      != null ? in.revenue()      : 0.0,
                "conversions",  in.conversions()  != null ? in.conversions()  : 0,
                "bookings",     in.bookings()     != null ? in.bookings()     : 0,
                "newCustomers", in.newCustomers() != null ? in.newCustomers() : 0
        );
    }
}
