package com.ceview.module3.submodule32;

import com.ceview.module3.Module3ErrorCodes;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Submodule 3.2 — Creative Direction Approval (FR3.19).
 *
 * Marks the latest generated creative direction output as approved so it
 * becomes available for compliance evaluation and publishing workflows.
 */
@Service
public class CreativeApprovalService {

    private static final Logger log = LoggerFactory.getLogger(CreativeApprovalService.class);

    private final CreativeDirectionOutputRepository creativeRepo;

    public CreativeApprovalService(CreativeDirectionOutputRepository creativeRepo) {
        this.creativeRepo = creativeRepo;
    }

    /**
     * Approve the most recent creative direction output for a profile+market.
     * Called when the operator confirms recommendations in the Creative Direction
     * dashboard (UC-3.2 step 11).
     *
     * @return the approved output ID, or empty if no output was found
     */
    public Optional<UUID> approveLatest(UUID profileId, String market) {
        Optional<CreativeDirectionOutput> latest =
                creativeRepo.findTopByBusinessProfileIdAndSelectedMarketOrderByGeneratedAtDesc(
                        profileId, market);

        if (latest.isEmpty()) {
            log.warn("creative.approve: no output found for profile={} market={}", profileId, market);
            return Optional.empty();
        }

        CreativeDirectionOutput output = latest.get();
        output.setApprovalStatus(true);
        output.setApprovedAt(OffsetDateTime.now());
        creativeRepo.save(output);

        MDC.put("code", Module3ErrorCodes.MOD32_CREATIVE_APPROVED);
        log.info("Creative direction approved: profile={} market={} id={}",
                profileId, market, output.getCreativeDirectionId());
        MDC.remove("code");

        return Optional.of(output.getCreativeDirectionId());
    }
}
