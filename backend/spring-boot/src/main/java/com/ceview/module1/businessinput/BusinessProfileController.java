package com.ceview.module1.businessinput;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.auth.CurrentOperator;
import com.ceview.module1.businessinput.dto.BusinessProfileDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/api/v1/business-profile")
public class BusinessProfileController {

    private static final Logger log = LoggerFactory.getLogger(BusinessProfileController.class);

    private final BusinessProfileRepository repo;
    private final AIInferenceGatewayService ai;
    private final CurrentOperator currentOperator;

    public BusinessProfileController(BusinessProfileRepository repo, AIInferenceGatewayService ai,
                                      CurrentOperator currentOperator) {
        this.repo = repo;
        this.ai = ai;
        this.currentOperator = currentOperator;
    }

    /** GET the authenticated operator's own profile, resolved server-side from the JWT. */
    @GetMapping
    public ResponseEntity<BusinessProfileDto> get() {
        UUID operatorId = currentOperator.resolve();
        return repo.findFirstByUserId(operatorId)
            .map(this::toDto)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.ok(emptyDto()));
    }

    /** PUT upsert profile (frontend BusinessProfile "Save"). */
    @PutMapping
    public BusinessProfileDto save(@RequestBody BusinessProfileDto in) {
        UUID operatorId = currentOperator.resolve();
        var existing = in.businessProfileId() != null ? repo.findById(in.businessProfileId()) : Optional.<BusinessProfile>empty();
        // Reject silent ownership takeover: a client could otherwise pass another
        // operator's businessProfileId and overwrite it via this upsert.
        existing.ifPresent(p -> {
            if (p.getUserId() != null && !p.getUserId().equals(operatorId)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "business profile belongs to a different operator");
            }
            // A null userId means an orphaned/pre-auth row (user_id has always been
            // nullable) rather than another operator's data, so it's fair game to adopt:
            // businessProfileId is an unguessable UUID, so reaching this branch requires
            // already knowing the id. Logged so an unexpected adoption is traceable.
            if (p.getUserId() == null) {
                log.warn("adopting ownerless business profile {} into operator {}", p.getBusinessProfileId(), operatorId);
            }
        });
        var p = existing.orElseGet(BusinessProfile::new);
        p.setUserId(operatorId);
        p.setBusinessName(in.businessName());
        p.setBusinessDescription(in.description());
        p.setUvp(in.uvp());
        p.setCoreServicesList(in.coreServices() == null ? List.of() : in.coreServices());
        p.setImageUrl(in.imagePreview());
        p.setCategoriesList(in.categories() == null ? List.of() : in.categories());
        p.setUniquenessScore(in.uniquenessScore());
        repo.save(p);

        // Fire-and-forget: generate + persist the 768-dim E5 embedding so this
        // profile joins the uniqueness comparison corpus for all future scorings.
        // Failures are non-fatal — the corpus will simply be stale until the next save.
        var embedPayload = new java.util.HashMap<String, Object>();
        embedPayload.put("businessProfileId", p.getBusinessProfileId().toString());
        embedPayload.put("coreServices", in.coreServices() != null ? in.coreServices() : java.util.List.of());
        embedPayload.put("description", in.description() != null ? in.description() : "");
        embedPayload.put("uvp", in.uvp() != null ? in.uvp() : "");
        try {
            ai.embedBusinessProfile(embedPayload);
        } catch (Exception e) {
            log.warn("embed call failed for profile {} — uniqueness corpus will be stale: {}",
                     p.getBusinessProfileId(), e.getMessage());
        }

        return toDto(p);
    }

    private BusinessProfileDto toDto(BusinessProfile p) {
        return new BusinessProfileDto(
            p.getBusinessProfileId(),
            p.getBusinessName(),
            p.categoriesList(),
            p.coreServicesList(),
            p.getBusinessDescription(),
            p.getUvp(),
            p.getImageUrl(),
            p.getUniquenessScore()
        );
    }

    private BusinessProfileDto emptyDto() {
        return new BusinessProfileDto(null, "", List.of(), List.of(), "", "", null, null);
    }
}
