package com.ceview.module3;

import com.ceview.module3.dto.ContentDtos.ContentResponseDto;
import com.ceview.module3.submodule31.ContentApprovalService;
import com.ceview.module3.submodule31.ContentGenerationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Submodule 3.1 — Content Studio API (FR3.1-FR3.10).
 *
 * POST /generate — generates market-localised captions and supplementary outputs,
 *                  retrieves business profile + Module 2 forecast context from DB (FR3.1, FR3.4),
 *                  persists all generated content rows (FR3.10).
 * POST /approve  — marks generated content as operator-approved (FR3.10 / UC-3.1 step 14).
 */
@RestController
@RequestMapping("/api/v1/content")
public class ContentController {

    private static final Logger log = LoggerFactory.getLogger(ContentController.class);

    private final ContentGenerationService generationService;
    private final ContentApprovalService approvalService;

    public ContentController(ContentGenerationService generationService,
                             ContentApprovalService approvalService) {
        this.generationService = generationService;
        this.approvalService   = approvalService;
    }

    public record GenerateRequest(
        String market,
        String businessName,
        String description,
        List<String> categories,
        String trend
    ) {}

    /**
     * FR3.2 — market selection, FR3.3-FR3.6 — generation pipeline.
     * Accepts an optional profileId query param for DB enrichment (FR3.1, FR3.4).
     */
    @PostMapping("/generate")
    public ContentResponseDto generate(
            @RequestBody GenerateRequest req,
            @RequestParam(required = false) UUID profileId) {
        log.info("content.generate received market={} profileId={}", req.market(), profileId);
        return generationService.generate(
                profileId,
                req.market(),
                req.businessName(),
                req.description(),
                req.categories(),
                req.trend());
    }

    /**
     * FR3.10 / UC-3.1 step 14 — operator approves generated content for a market.
     * Body: { "market": "korea" }
     * Returns: { "approvedIds": [...] }
     */
    @PostMapping("/approve")
    public ResponseEntity<Map<String, Object>> approve(
            @RequestParam UUID profileId,
            @RequestBody Map<String, String> body) {
        String market = body.getOrDefault("market", "korea");
        log.info("content.approve received profileId={} market={}", profileId, market);

        List<UUID> ids = approvalService.approveForMarket(profileId, market);

        if (ids.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of(
                "approvedIds", ids,
                "market",      market,
                "count",       ids.size()
        ));
    }
}
