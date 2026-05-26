package com.ceview.module1.uniquenessscoring.dto;

import java.util.List;

/** DTOs for Transaction 1.2 — Uniqueness Scoring Dashboard. */
public class UniquenessDtos {

    public record UniquenessRequest(
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
