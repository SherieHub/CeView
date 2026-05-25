package com.ceview.module1.dto;

import java.util.List;
import java.util.UUID;

/**
 * Matches the frontend ProfileData shape in App.tsx so the React state can
 * round-trip through this single DTO without remapping.
 */
public record BusinessProfileDto(
    UUID businessProfileId,
    String businessName,
    List<String> categories,
    List<String> coreServices,
    String description,
    String uvp,
    String imagePreview,
    Float uniquenessScore
) {}
