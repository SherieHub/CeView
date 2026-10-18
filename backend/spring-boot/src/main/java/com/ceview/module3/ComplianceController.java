package com.ceview.module3;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.common.TraceIdFilter;
import com.ceview.module1.businessinput.BusinessProfile;
import com.ceview.module1.businessinput.BusinessProfileRepository;
import com.ceview.module3.dto.ComplianceDtos.OmcsAuditRequest;
import com.ceview.module3.dto.ComplianceDtos.OmcsAuditResultDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeoutException;

/**
 * SDD §3.3 — Multimodal Compliance Audit (OMCS).
 *
 * Thin stateless passthrough to the FastAPI LangGraph omcs_agent. The operator's
 * chosen caption + image are evaluated against the visual-guide recommendations
 * (the approved caption's generative metadata). Returns the full omcs_agent
 * evaluation state, including a Pass/Fail status and a feedback diagnostic when
 * the asset fails. No results are persisted.
 *
 * <p>The business profile the caption is scored against is always the
 * authenticated operator's own saved profile, read from the database — never a
 * profile supplied in the request body.
 */
@RestController
@RequestMapping("/api/compliance")
public class ComplianceController {

    private static final Logger log = LoggerFactory.getLogger(ComplianceController.class);

    private final AIInferenceGatewayService ai;
    private final CurrentBusinessProfile currentBusinessProfile;
    private final BusinessProfileRepository profileRepo;

    public ComplianceController(AIInferenceGatewayService ai,
                                CurrentBusinessProfile currentBusinessProfile,
                                BusinessProfileRepository profileRepo) {
        this.ai = ai;
        this.currentBusinessProfile = currentBusinessProfile;
        this.profileRepo = profileRepo;
    }

    /**
     * Submodule 3.3 — OMCS compliance audit via the LangGraph omcs_agent.
     *
     * OMCS = (0.35 × profile_semantic_score) + (0.45 × recommendations_picture_score)
     *      + (0.20 × pubmat_consistency_score). Status is Pass/Fail at threshold 70.
     *
     * <p>{@code profile_semantic_score} is the embedding similarity between the operator's
     * saved profile and the caption, computed by the agent from the profile built here.
     */
    @PostMapping(value = "/omcs-analyze", consumes = "application/json")
    public OmcsAuditResultDto omcsAnalyze(@RequestBody OmcsAuditRequest body) {
        String caption  = body == null || body.caption() == null ? "" : body.caption().strip();
        String imageUrl = body == null || body.imageUrl() == null ? "" : body.imageUrl().strip();

        if (caption.isBlank()) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.omcs-analyze rejected — empty caption");
            throw new IllegalArgumentException("caption is required");
        }
        if (imageUrl.isBlank()) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.omcs-analyze rejected — empty image_url");
            throw new IllegalArgumentException("image_url is required");
        }

        BusinessProfile profile = loadOwnProfile();

        Map<String, Object> payload = new HashMap<>();
        payload.put("caption", caption);
        String captionEn = body.captionEn() == null ? "" : body.captionEn().strip();
        if (captionEn.length() > 8000) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_VALIDATION);
            log.warn("compliance.omcs-analyze rejected — captionEn too long");
            throw new IllegalArgumentException("captionEn must be at most 8000 characters");
        }
        if (!captionEn.isBlank()) payload.put("caption_en", captionEn);
        payload.put("image_url", imageUrl);
        payload.put("business_profile", profileContext(profile));
        payload.put("recommendations", body.recommendations() != null ? body.recommendations() : Map.of());

        log.info("compliance.omcs-analyze caption_len={} caption_en_len={} image_url_len={} recommendations_keys={}",
                caption.length(), captionEn.length(), imageUrl.length(),
                body.recommendations() == null ? 0 : body.recommendations().size());

        Map<String, Object> raw;
        try {
            raw = ai.analyzeOmcsAgent(payload);
        } catch (WebClientResponseException e) {
            MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD33_OMCS_AGENT_FAILED);
            log.warn("compliance.omcs-analyze gateway failure status={}", e.getStatusCode().value(), e);
            throw e;
        } catch (RuntimeException e) {
            if (e.getCause() instanceof TimeoutException) {
                MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD3_COMPLIANCE_GATEWAY_TIMEOUT);
                log.warn("compliance.omcs-analyze gateway timeout", e);
            } else {
                MDC.put(TraceIdFilter.MDC_CODE_KEY, Module3ErrorCodes.MOD33_OMCS_AGENT_FAILED);
                log.warn("compliance.omcs-analyze gateway error: {}", e.getMessage());
            }
            throw e;
        }

        OmcsAuditResultDto dto = mapOmcsAgentResponse(raw);
        log.info("compliance.omcs-analyze ok omcs={} status={}", dto.omcsScore(), dto.status());
        return dto;
    }

    /** The authenticated operator's own profile; 401/409 per {@link CurrentBusinessProfile}. */
    private BusinessProfile loadOwnProfile() {
        UUID profileId = currentBusinessProfile.resolveProfileId();
        return profileRepo.findById(profileId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                        "operator has no business profile yet"));
    }

    /** The profile fields the agent compares the caption against (snake_case, as its contract expects). */
    private static Map<String, Object> profileContext(BusinessProfile profile) {
        Map<String, Object> context = new HashMap<>();
        context.put("business_name", profile.getBusinessName() == null ? "" : profile.getBusinessName());
        context.put("business_description",
                profile.getBusinessDescription() == null ? "" : profile.getBusinessDescription());
        context.put("uvp", profile.getUvp() == null ? "" : profile.getUvp());
        context.put("core_services", profile.coreServicesList());
        context.put("categories", profile.categoriesList());
        return context;
    }

    @SuppressWarnings("unchecked")
    private OmcsAuditResultDto mapOmcsAgentResponse(Map<String, Object> raw) {
        Object rubric = raw.get("rubric_evaluation_data");
        return new OmcsAuditResultDto(
                toDouble(raw.get("profile_semantic_score")),
                rubric instanceof Map ? (Map<String, Object>) rubric : Map.of(),
                toDouble(raw.get("recommendations_picture_score")),
                raw.get("consistency_explanation") == null ? "" : raw.get("consistency_explanation").toString(),
                toDouble(raw.get("pubmat_consistency_score")),
                toDouble(raw.get("omcs_score")),
                raw.get("status") == null ? "" : raw.get("status").toString(),
                raw.get("feedback") == null ? "" : raw.get("feedback").toString()
        );
    }

    private static double toDouble(Object val) {
        return val instanceof Number n ? n.doubleValue() : 0.0;
    }
}
