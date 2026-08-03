package com.ceview.module3;

import com.ceview.auth.CurrentBusinessProfile;
import com.ceview.module3.dto.CreativeDirectionDtos.CreativeDirectionDto;
import com.ceview.module3.submodule32.CreativeApprovalService;
import com.ceview.module3.submodule32.CreativeDirectionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Submodule 3.2 — Creative Direction API (FR3.11-FR3.19).
 *
 * POST /generate/{profileId} — checks for approved content (FR3.11 dependency),
 *                              retrieves business + forecast context (FR3.12),
 *                              generates visual direction via Gemini (FR3.13-FR3.16),
 *                              persists output (FR3.19).
 * POST /approve/{profileId}  — marks generated output as approved (FR3.19 / UC-3.2 step 11).
 *
 * Ownership: URL shape is unchanged (profileId stays a path variable), but it's
 * now validated against {@link CurrentBusinessProfile} instead of trusted outright.
 * See Task 8 (mirrors Task 7 for Module 2).
 */
@RestController
@RequestMapping("/api/v1/creative-direction")
public class CreativeDirectionController {

    private static final Logger log = LoggerFactory.getLogger(CreativeDirectionController.class);

    private final CreativeDirectionService directionService;
    private final CreativeApprovalService approvalService;
    private final CurrentBusinessProfile currentBusinessProfile;

    public CreativeDirectionController(CreativeDirectionService directionService,
                                       CreativeApprovalService approvalService,
                                       CurrentBusinessProfile currentBusinessProfile) {
        this.directionService = directionService;
        this.approvalService  = approvalService;
        this.currentBusinessProfile = currentBusinessProfile;
    }

    /**
     * FR3.11-FR3.16, FR3.19 — generate and persist creative direction.
     * Requires UC-3.1 to be completed first (FR3.11); returns 400 with
     * { "error": "missing_dependency" } if no approved content exists (A3 flow).
     */
    @PostMapping("/generate/{profileId}")
    public ResponseEntity<?> generate(
            @PathVariable UUID profileId,
            @RequestParam(required = false) String market) {
        // URL shape unchanged (frontend routing change is a later task) — but the
        // path-variable profileId is now validated against the JWT-resolved profile
        // instead of trusted outright.
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        String resolvedMarket = market == null ? "korea" : market;
        log.info("creative.generate received profileId={} market={}", profileId, resolvedMarket);

        try {
            CreativeDirectionDto dto = directionService.generate(resolvedProfileId, resolvedMarket);
            return ResponseEntity.ok(dto);
        } catch (IllegalStateException e) {
            if ("missing_dependency".equals(e.getMessage())) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error",   "missing_dependency",
                        "message", "Content from Transaction 3.1 must be approved before generating creative direction.",
                        "redirect", "/content-studio"
                ));
            }
            throw e;
        }
    }

    /**
     * FR3.19 / UC-3.2 step 11 — approve the latest creative direction output.
     * Returns: { "approvedId": "...", "market": "..." }
     */
    @PostMapping("/approve/{profileId}")
    public ResponseEntity<Map<String, Object>> approve(
            @PathVariable UUID profileId,
            @RequestParam(required = false) String market) {
        UUID resolvedProfileId = currentBusinessProfile.resolveOrValidate(profileId);
        String resolvedMarket = market == null ? "korea" : market;
        log.info("creative.approve received profileId={} market={}", profileId, resolvedMarket);

        Optional<UUID> approvedId = approvalService.approveLatest(resolvedProfileId, resolvedMarket);

        if (approvedId.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of(
                "approvedId", approvedId.get(),
                "market",     resolvedMarket
        ));
    }
}
