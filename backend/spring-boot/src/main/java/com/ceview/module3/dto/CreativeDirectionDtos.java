package com.ceview.module3.dto;

import java.util.List;

/**
 * Wire shapes for Module 3 / Creative Direction. Returns blueprint instructions
 * (shot list, lighting cues, moodboard references) the operator can hand to a
 * photographer or in-house creative team.
 *
 * Kept intentionally lean — the FastAPI contract is still being firmed up; we
 * cover only the fields the frontend will render in this pass. Additional
 * fields can be added without breaking the existing UI.
 */
public class CreativeDirectionDtos {

    public record ShotDto(
        String label,
        String description,
        String lighting
    ) {}

    public record MoodboardDto(
        String palette,
        List<String> references
    ) {}

    public record CreativeDirectionDto(
        List<String> visualGuide,
        List<ShotDto> shots,
        MoodboardDto moodboard
    ) {}
}
