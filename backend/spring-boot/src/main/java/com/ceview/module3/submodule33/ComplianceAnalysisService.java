package com.ceview.module3.submodule33;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.common.TraceIdFilter;
import com.ceview.module3.Module3ErrorCodes;
import com.ceview.module3.dto.ComplianceDtos.ComplianceResultDto;
import com.ceview.module3.submodule31.ContentApprovalService;
import com.ceview.module3.submodule32.CreativeDirectionOutput;
import com.ceview.module3.submodule32.CreativeDirectionOutputRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.util.*;
import java.util.concurrent.TimeoutException;

/**
 * Submodule 3.3 — Multimodal Promotional Compliance Analysis orchestrator.
 *
 * FR3.21 — retrieves approved captions (3.1) and creative direction context (3.2).
 * FR3.22 — assembles enriched payload for FastAPI.
 * FR3.23/FR3.24 — delegates CAS + VAS computation to FastAPI /evaluate-full.
 * FR3.25 — OMCS is computed inside FastAPI; this service persists and returns it.
 * FR3.28 — increments revision number on resubmission.
 * FR3.29 — persists ComplianceEvaluationResult + ComplianceRevisionHistory.
 * FR3.30 — falls back to /evaluate (basic Gemini) when full pipeline unavailable.
 */
@Service
public class ComplianceAnalysisService {

    private static final Logger log = LoggerFactory.getLogger(ComplianceAnalysisService.class);

    private final AIInferenceGatewayService ai;
    private final ContentApprovalService contentApproval;
    private final CreativeDirectionOutputRepository creativeRepo;
    private final ComplianceEvaluationResultRepository evalRepo;
    private final ComplianceRevisionHistoryRepository historyRepo;
    private final ObjectMapper mapper;

    public ComplianceAnalysisService(
            AIInferenceGatewayService ai,
            ContentApprovalService contentApproval,
            CreativeDirectionOutputRepository creativeRepo,
            ComplianceEvaluationResultRepository evalRepo,
            ComplianceRevisionHistoryRepository historyRepo,
            ObjectMapper mapper) {
        this.ai             = ai;
        this.contentApproval = contentApproval;
        this.creativeRepo   = creativeRepo;
        this.evalRepo       = evalRepo;
        this.historyRepo    = historyRepo;
        this.mapper         = mapper;
    }

    /**
     * Full multimodal compliance analysis pipeline (UC-3.3).
     *
     * When profileId is provided the service enriches the payload with approved
     * captions (FR3.21) and creative direction context (FR3.21), then calls
     * /evaluate-full. When profileId is null (or enrichment unavailable) it falls
     * back to the basic /evaluate path (FR3.30).
     *
     * @param profileId optional — null triggers fallback path immediately
     * @param caption   operator-uploaded caption text (FR3.20)
     * @param market    target market key (korea / japan / usa)
     * @param mediaName uploaded media filename (may be null)
     * @param mediaSize uploaded media size in bytes (may be null)
     */
    public ComplianceResultDto analyze(UUID profileId, String caption, String market,
                                       String mediaName, Long mediaSize) {

        // FR3.21 — retrieve 3.1 approved captions and 3.2 creative direction context
        List<String> approvedCaptions = List.of();
        String visualTone = null;
        String shotListContext = null;

        if (profileId != null) {
            try {
                approvedCaptions = contentApproval.getApprovedCaptions(profileId, market);
            } catch (Exception e) {
                log.warn("3.3 could not retrieve approved captions profile={} market={}: {}",
                        profileId, market, e.getMessage());
            }

            try {
                Optional<CreativeDirectionOutput> creative =
                        creativeRepo.findTopByBusinessProfileIdAndSelectedMarketAndApprovalStatusTrueOrderByGeneratedAtDesc(
                                profileId, market);
                if (creative.isPresent()) {
                    visualTone      = creative.get().getVisualTone();
                    shotListContext = creative.get().getShotListRecommendations();
                }
            } catch (Exception e) {
                log.warn("3.3 could not retrieve creative direction profile={} market={}: {}",
                        profileId, market, e.getMessage());
            }
        }

        boolean hasEnrichedContext = !approvedCaptions.isEmpty();

        ComplianceResultDto result;
        if (hasEnrichedContext) {
            result = invokeFullPipeline(caption, market, approvedCaptions,
                    visualTone, shotListContext, mediaName, mediaSize);
        } else {
            // FR3.30 — fallback to basic evaluate when no approved captions available
            log.info("3.3 fallback path — no approved captions for profile={} market={}",
                    profileId, market);
            result = invokeBasicEvaluate(caption, market, mediaName, mediaSize);
        }

        // FR3.28/FR3.29 — persist evaluation result and update revision history
        if (profileId != null) {
            persistResult(profileId, caption, market, result);
        }

        return result;
    }

    // ── FastAPI invocation ────────────────────────────────────────────────────

    private ComplianceResultDto invokeFullPipeline(String caption, String market,
            List<String> approvedCaptions, String visualTone, String shotListContext,
            String mediaName, Long mediaSize) {

        // FR3.22 — assemble enriched payload
        Map<String, Object> payload = new HashMap<>();
        payload.put("caption", caption);
        payload.put("market", market);
        payload.put("approvedCaptions", approvedCaptions);
        payload.put("visualTone", visualTone);
        payload.put("shotListContext", shotListContext);
        payload.put("mediaName", mediaName);
        payload.put("mediaSize", mediaSize);

        try {
            Map<String, Object> raw = ai.evaluateComplianceFull(payload);
            return mapper.convertValue(raw, ComplianceResultDto.class);

        } catch (WebClientResponseException e) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_GATEWAY_5XX);
            log.warn("3.3 full pipeline gateway failure status={} — falling back to basic",
                    e.getStatusCode().value(), e);
            MDC.remove(TraceIdFilter.MDC_CODE_KEY);
            return invokeBasicEvaluate(caption, market, mediaName, mediaSize);

        } catch (RuntimeException e) {
            if (e.getCause() instanceof TimeoutException) {
                MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_GATEWAY_TIMEOUT);
                log.warn("3.3 full pipeline gateway timeout — falling back to basic", e);
                MDC.remove(TraceIdFilter.MDC_CODE_KEY);
            }
            return invokeBasicEvaluate(caption, market, mediaName, mediaSize);
        }
    }

    private ComplianceResultDto invokeBasicEvaluate(String caption, String market,
                                                     String mediaName, Long mediaSize) {
        Map<String, Object> payload = Map.of(
                "caption", caption,
                "market", market,
                "mediaName", mediaName != null ? mediaName : "",
                "mediaSize", mediaSize != null ? mediaSize : 0L
        );
        try {
            Map<String, Object> raw = ai.evaluateCompliance(payload);
            return mapper.convertValue(raw, ComplianceResultDto.class);
        } catch (Exception e) {
            log.warn("3.3 basic evaluate also failed — returning zero-score fallback: {}",
                    e.getMessage());
            return ComplianceResultDto.basic(0, List.of(), List.of("evaluation unavailable"), "fallback");
        }
    }

    // ── Persistence (FR3.28, FR3.29) ─────────────────────────────────────────

    private void persistResult(UUID profileId, String caption, String market,
                               ComplianceResultDto result) {
        try {
            // Determine revision number: +1 over any previous evaluation for this profile+market
            int revisionNumber = evalRepo
                    .findTopByBusinessProfileIdAndSelectedMarketOrderByEvaluatedAtDesc(profileId, market)
                    .map(prev -> prev.getRevisionNumber() != null ? prev.getRevisionNumber() + 1 : 2)
                    .orElse(1);

            ComplianceEvaluationResult entity = new ComplianceEvaluationResult();
            entity.setBusinessProfileId(profileId);
            entity.setSelectedMarket(market);
            entity.setCaption(caption);
            entity.setScore(result.score());
            entity.setCasScore(result.casScore());
            entity.setVasScore(result.vasScore());
            entity.setOmcsScore(result.omcsScore());
            entity.setComplianceThreshold(result.interpretation());
            entity.setComplianceInterpretation(result.interpretation());
            entity.setSource(result.source());
            entity.setRevisionNumber(revisionNumber);
            entity.setAlignedItems(toJson(result.aligned()));
            entity.setGapItems(toJson(result.gaps()));
            entity.setMismatches(toJson(result.mismatches()));
            entity.setApprovalStatus(false);
            ComplianceEvaluationResult saved = evalRepo.save(entity);

            // FR3.28 — write revision history entry on resubmission (revisionNumber > 1)
            if (revisionNumber > 1) {
                ComplianceRevisionHistory history = new ComplianceRevisionHistory();
                history.setBusinessProfileId(profileId);
                history.setOriginalEvalId(saved.getEvaluationId());
                history.setSelectedMarket(market);
                history.setRevisionNumber(revisionNumber);
                history.setSubmittedCaption(caption);
                history.setCasScore(result.casScore());
                history.setOmcsScore(result.omcsScore());
                history.setComplianceThreshold(result.interpretation());
                historyRepo.save(history);
            }

            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_STORED);
            log.info("3.3 evaluation persisted profile={} market={} omcs={} revision={}",
                    profileId, market, result.omcsScore(), revisionNumber);
            MDC.remove(TraceIdFilter.MDC_CODE_KEY);

        } catch (Exception e) {
            log.warn("3.3 failed to persist evaluation result profile={} market={}: {}",
                    profileId, market, e.getMessage());
        }
    }

    private String toJson(List<String> list) {
        if (list == null || list.isEmpty()) return "[]";
        try {
            return mapper.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }
}
