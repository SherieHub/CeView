package com.ceview.module3.submodule31;

import com.ceview.module3.Module3ErrorCodes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Submodule 3.1 — Content Approval (FR3.10).
 *
 * Marks operator-approved captions in tbl_localized_promotional_content so
 * Submodule 3.2 can retrieve them as the dependency for creative direction (FR3.11).
 */
@Service
public class ContentApprovalService {

    private static final Logger log = LoggerFactory.getLogger(ContentApprovalService.class);

    private final LocalizedPromotionalContentRepository contentRepo;

    public ContentApprovalService(LocalizedPromotionalContentRepository contentRepo) {
        this.contentRepo = contentRepo;
    }

    /**
     * Approve all generated content rows for a profile+market.
     * Called when the operator confirms content in the Content Studio (UC-3.1 step 14).
     *
     * @return list of now-approved content IDs
     */
    public List<UUID> approveForMarket(UUID profileId, String market) {
        List<LocalizedPromotionalContent> rows =
                contentRepo.findByBusinessProfileIdAndSelectedMarketOrderByGeneratedAtDesc(
                        profileId, market);

        if (rows.isEmpty()) {
            log.warn("approve: no content rows found for profile={} market={}", profileId, market);
            return List.of();
        }

        OffsetDateTime now = OffsetDateTime.now();
        for (LocalizedPromotionalContent row : rows) {
            row.setApprovalStatus(true);
            row.setApprovedAt(now);
            contentRepo.save(row);
        }

        List<UUID> ids = rows.stream().map(LocalizedPromotionalContent::getContentId).toList();

        MDC.put("code", Module3ErrorCodes.MOD31_CONTENT_APPROVED);
        log.info("Content approved: profile={} market={} rows={}", profileId, market, ids.size());
        MDC.remove("code");

        return ids;
    }

    /**
     * Retrieve all approved captions for a profile+market.
     * Used by CreativeDirectionService (FR3.11).
     */
    public List<String> getApprovedCaptions(UUID profileId, String market) {
        return contentRepo
                .findByBusinessProfileIdAndSelectedMarketAndApprovalStatusTrue(profileId, market)
                .stream()
                .map(LocalizedPromotionalContent::getGeneratedCaption)
                .filter(c -> c != null && !c.isBlank())
                .toList();
    }

    /** Returns true when at least one approved caption exists for this profile+market. */
    public boolean hasApprovedContent(UUID profileId, String market) {
        return !contentRepo
                .findByBusinessProfileIdAndSelectedMarketAndApprovalStatusTrue(profileId, market)
                .isEmpty();
    }
}
