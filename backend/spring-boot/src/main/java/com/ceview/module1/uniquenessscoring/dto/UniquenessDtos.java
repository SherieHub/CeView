package com.ceview.module1.uniquenessscoring.dto;

import org.springframework.lang.Nullable;

import java.util.List;

/** DTOs for Transaction 1.2 — Uniqueness Scoring Dashboard. */
public class UniquenessDtos {

    public record UniquenessRequest(
        /** UUID of the already-saved profile, or null for unsaved drafts.
         *  Passed to FastAPI so the corpus query can exclude the caller's own embedding. */
        @Nullable String businessProfileId,
        String businessName,
        List<String> categories,
        List<String> coreServices,
        String description,
        String uvp
    ) {}

    public record UniquenessResponse(
        int overallScore,
        int semanticsScore,
        int categoryScore,
        String descriptionFeedback,
        String categoryFeedback
    ) {}
}
