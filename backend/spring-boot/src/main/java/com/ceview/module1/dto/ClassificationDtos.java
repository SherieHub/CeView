package com.ceview.module1.dto;

import java.util.List;

public class ClassificationDtos {

    public record AnalyzeRequest(
        String businessName,
        List<String> coreServices,
        String description,
        String uvp
    ) {}

    public record CategoryAllocation(String name, double percentage) {}

    public record AnalyzeResponse(List<CategoryAllocation> categories) {}

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

    public record KeywordRequest(
        String businessName,
        String description,
        String category
    ) {}
}
