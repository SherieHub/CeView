package com.ceview.module1.businessinput.dto;

import java.util.List;

/** DTOs for Transaction 1.1 — Business Input and Categorization. */
public class AnalyzeDtos {

    public record AnalyzeRequest(
        String businessName,
        List<String> coreServices,
        String description,
        String uvp
    ) {}

    public record CategoryAllocation(String name, int percentage) {}

    public record AnalyzeResponse(List<CategoryAllocation> categories) {}

}
