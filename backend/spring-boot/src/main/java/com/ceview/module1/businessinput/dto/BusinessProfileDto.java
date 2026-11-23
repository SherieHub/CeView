package com.ceview.module1.businessinput.dto;

import java.util.List;
import java.util.UUID;

/**
 * Matches the frontend ProfileData shape in App.tsx so the React state can
 * round-trip through this single DTO without remapping.
 *
 * <p>{@code description}/{@code uvp} are the composed Business Story and UVP paragraphs. The
 * {@code story*}/{@code uvp*} answers they are composed from are all-or-nothing (see
 * {@code StructuredInputs}); the {@code *Edited} flags are nullable so a client that predates them
 * can omit them.
 */
public record BusinessProfileDto(
    UUID businessProfileId,
    String businessName,
    List<String> categories,
    List<String> coreServices,
    String description,
    String uvp,
    String imagePreview,
    Float uniquenessScore,
    String storyBusinessType,
    String storyLocation,
    String storyExperience,
    String storyFacilities,
    String uvpDistinguisher,
    String uvpSupportingFact,
    String uvpGuestBenefit,
    Boolean descriptionEdited,
    Boolean uvpEdited
) {}
