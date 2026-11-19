package com.ceview.module1.businessinput;

import com.ceview.module1.businessinput.dto.AnalyzeDtos.*;
import com.ceview.module1.businessinput.dto.BusinessProfileDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ClassificationRunService {
    private static final Set<String> CATEGORY_NAMES = Set.of(
        "Coastal & Island", "Adventure & Nature", "Cultural & Heritage",
        "Theme Parks / Entertainment", "Urban & City", "Culinary & Gastronomy", "Accommodation & Staycation");
    private final ClassificationRunRepository runs;
    private final BusinessProfileRepository profiles;
    private final ObjectMapper mapper;

    public ClassificationRunService(ClassificationRunRepository runs, BusinessProfileRepository profiles,
                                    ObjectMapper mapper) {
        this.runs = runs;
        this.profiles = profiles;
        this.mapper = mapper;
    }

    public record Inference(String topCategory, Double topConfidence,
                            Map<String, Double> predictedCategories, Map<String, Double> categoryScores,
                            String modelVersion, Double inferenceLatencyMs) {}

    @Transactional
    public UUID record(UUID operatorId, AnalyzeRequest input, List<CategoryAllocation> allocations, Object metadata, String purpose) {
        Inference details;
        try {
            details = mapper.convertValue(metadata, Inference.class);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid inference metadata");
        }
        if (details == null || details.topCategory() == null || details.topConfidence() == null
                || details.categoryScores() == null || !details.categoryScores().keySet().containsAll(CATEGORY_NAMES)
                || details.predictedCategories() == null || details.predictedCategories().isEmpty()
                || details.modelVersion() == null || details.modelVersion().isBlank()
                || details.inferenceLatencyMs() == null || !Double.isFinite(details.inferenceLatencyMs())
                || details.inferenceLatencyMs() < 0
                || details.categoryScores().values().stream().anyMatch(v -> v == null || !Double.isFinite(v) || v < 0 || v > 1)
                || !Objects.equals(details.categoryScores().get(details.topCategory()), details.topConfidence())) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Incomplete inference metadata");
        }
        if (allocations == null || allocations.isEmpty()
                || allocations.stream().anyMatch(c -> !details.categoryScores().containsKey(c.name()))
                || details.predictedCategories().entrySet().stream().anyMatch(e ->
                    !Objects.equals(details.categoryScores().get(e.getKey()), e.getValue()))) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Invalid predicted categories");
        }
        var run = new ClassificationRun();
        run.setRunId(UUID.randomUUID());
        run.setOperatorId(operatorId);
        profiles.findFirstByUserId(operatorId).ifPresent(p -> run.setBusinessProfileId(p.getBusinessProfileId()));
        run.setCreatedAt(OffsetDateTime.now());
        run.setRunPurpose(purpose);
        run.setInputDescription(input.description());
        run.setInputUvp(input.uvp());
        run.setInputServices(List.copyOf(input.coreServices()));
        run.setTopCategory(details.topCategory());
        run.setTopConfidence(details.topConfidence());
        run.setPredictedCategories(details.predictedCategories());
        run.setCategoryScores(details.categoryScores());
        // The onboarding picker initially selects the two highest display allocations.
        run.setRecommendedCategories(allocations.stream().filter(c -> c.percentage() > 0)
            .sorted(Comparator.comparingInt(CategoryAllocation::percentage).reversed())
            .limit(2).map(CategoryAllocation::name).toList());
        run.setModelVersion(details.modelVersion());
        run.setInferenceLatencyMs(details.inferenceLatencyMs());
        runs.save(run);
        return run.getRunId();
    }

    @Transactional
    public void recordUniqueness(UUID operatorId, AnalyzeRequest input, Object classification) {
        if (!(classification instanceof Map<?, ?> result)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Missing uniqueness inference metadata");
        }
        var allocations = mapper.convertValue(result.get("categories"),
            new com.fasterxml.jackson.core.type.TypeReference<List<CategoryAllocation>>() {});
        record(operatorId, input, allocations, result.get("inference"), "UNIQUENESS");
    }

    /** Called inside the profile-save transaction; predictions never change after insertion. */
    @Transactional
    public void confirm(UUID operatorId, BusinessProfile profile, BusinessProfileDto input) {
        if (input.classificationRunId() == null) return; // Older clients and unrelated profile edits.
        var run = runs.findByRunIdAndOperatorId(input.classificationRunId(), operatorId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Classification run not found"));
        if (!Objects.equals(run.getInputDescription(), input.description())
                || !Objects.equals(run.getInputUvp(), input.uvp())
                || !Objects.equals(run.getInputServices(), input.coreServices())
                || (run.getBusinessProfileId() != null && !run.getBusinessProfileId().equals(profile.getBusinessProfileId()))) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Profile inputs changed; run classification again");
        }
        var selected = input.categories();
        if (selected == null || selected.isEmpty() || selected.stream().anyMatch(c -> !run.getCategoryScores().containsKey(c))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Select valid classification categories");
        }
        if (run.getConfirmedAt() != null) {
            if (!new HashSet<>(run.getFinalCategories()).equals(new HashSet<>(selected))) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Run already confirmed; run classification again");
            }
            return; // Identical retry leaves the original feedback timestamp intact.
        }
        run.setBusinessProfileId(profile.getBusinessProfileId());
        run.setFinalCategories(List.copyOf(selected));
        run.setConfirmedAt(OffsetDateTime.now());
        run.setIsOverridden(!new HashSet<>(run.getRecommendedCategories()).equals(new HashSet<>(selected)));
        runs.save(run);
    }
}
