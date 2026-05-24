package com.ceview.module1;

import com.ceview.ai.AIInferenceGatewayService;
import com.ceview.module1.dto.BusinessProfileDto;
import com.ceview.module1.dto.ClassificationDtos.KeywordRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/v1/business-profile")
public class BusinessProfileController {

    private final BusinessProfileRepository repo;
    private final AIInferenceGatewayService ai;

    public BusinessProfileController(BusinessProfileRepository repo, AIInferenceGatewayService ai) {
        this.repo = repo;
        this.ai = ai;
    }

    /** GET current operator's profile. operatorId via query for scaffolding; later from JWT. */
    @GetMapping
    public ResponseEntity<BusinessProfileDto> get(@RequestParam(required = false) UUID operatorId) {
        return repo.findFirstByUserId(operatorId)
            .map(this::toDto)
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.ok(emptyDto()));
    }

    /** PUT upsert profile (frontend BusinessProfile "Save"). */
    @PutMapping
    public BusinessProfileDto save(@RequestBody BusinessProfileDto in,
                                   @RequestParam(required = false) UUID operatorId) {
        var p = (in.businessProfileId() != null ? repo.findById(in.businessProfileId()) : Optional.<BusinessProfile>empty())
            .orElseGet(BusinessProfile::new);
        p.setUserId(operatorId);
        p.setBusinessName(in.businessName());
        p.setBusinessDescription(in.description());
        p.setUvp(in.uvp());
        p.setCoreServicesList(in.coreServices() == null ? List.of() : in.coreServices());
        p.setImageUrl(in.imagePreview());
        p.setFinalizedCategory(in.categories() == null || in.categories().isEmpty() ? null : in.categories().get(0));
        p.setUniquenessScore(in.uniquenessScore());
        repo.save(p);
        return toDto(p);
    }

    /** POST /api/v1/business-profile/keywords — replaces frontend generateOptimizedKeywords. */
    @PostMapping("/keywords")
    public List<String> keywords(@RequestBody KeywordRequest req) {
        var payload = new HashMap<String, Object>();
        payload.put("businessName", req.businessName());
        payload.put("description", req.description());
        payload.put("category", req.category());
        return ai.generateKeywords(payload);
    }

    private BusinessProfileDto toDto(BusinessProfile p) {
        return new BusinessProfileDto(
            p.getBusinessProfileId(),
            p.getBusinessName(),
            p.getFinalizedCategory() == null ? List.of() : List.of(p.getFinalizedCategory()),
            p.coreServicesList(),
            p.getBusinessDescription(),
            p.getUvp(),
            p.getImageUrl(),
            p.getFinalizedCategory(),
            p.getUniquenessScore()
        );
    }

    private BusinessProfileDto emptyDto() {
        return new BusinessProfileDto(null, "", List.of(), List.of(), "", "", null, null, null);
    }
}
