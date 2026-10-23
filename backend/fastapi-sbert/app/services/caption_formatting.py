"""Shapes the caption agent's output into the ContentResponseDto ``captions`` field.

Used by ``routers/caption_generation.py``.
"""
from __future__ import annotations

from app.config.markets import DEMOGRAPHIC_OPTION_NAMES


def format_research_context(rc: dict) -> str:
    """Format a cultural_research result dict into the pre-formatted string the
    LangGraph prompt template expects as {research_context}."""
    if not rc:
        return ""
    return (
        f"Cultural research context (source: {rc.get('source', 'template')}):\n"
        f"- Traveler behavior: {rc.get('traveler_behavior', '')}\n"
        f"- Tourism preferences: {rc.get('tourism_preferences', '')}\n"
        f"- Platform styles: {rc.get('platform_styles', '')}\n"
        f"- Language nuances: {rc.get('language_nuances', '')}\n"
    )


def transform_captions(
    final_captions: dict,
    guides: dict[str, list[str]],
) -> dict:
    """Transform the agent's final_captions (6-field schema) into the
    ContentResponseDto captions shape expected by Spring Boot.

    For instagram / tiktok / facebook: extract options, optionNames, optionMetadata
    from the agent's 3-variation list. ``optionsEn`` runs parallel to ``options``
    (English meaning of each caption; "" when there is none, e.g. USA).

    Args:
        final_captions: { "facebook": [...], "instagram": [...], "tiktok": [...] }
        guides:         { "instagram": [...], "tiktok": [...], "facebook": [...] }

    Returns:
        { "instagram": {...}, "tiktok": {...}, "facebook": {...} }
    """
    captions: dict = {}

    for platform in ("instagram", "tiktok", "facebook"):
        variations: list[dict] = final_captions.get(platform, [])
        options: list[str] = []
        options_en: list[str] = []
        option_names: list[str] = []
        option_metadata: list[dict] = []

        for i, v in enumerate(variations):
            if not isinstance(v, dict):
                continue
            options.append(v.get("caption", ""))
            en = v.get("caption_en")
            options_en.append(en if isinstance(en, str) else "")
            option_names.append(DEMOGRAPHIC_OPTION_NAMES[i] if i < len(DEMOGRAPHIC_OPTION_NAMES) else f"Option {i + 1}")
            option_metadata.append({
                "core_business_context":             v.get("core_business_context", ""),
                "market_cultural_localization":      v.get("market_cultural_localization", ""),
                "psychological_elements":            v.get("psychological_elements", ""),
                "creative_tone_atmosphere":          v.get("creative_tone_atmosphere", ""),
                "algorithmic_platform_architecture": v.get("algorithmic_platform_architecture", ""),
            })

        captions[platform] = {
            "options":        options,
            "optionsEn":      options_en,
            "optionNames":    option_names,
            "optionMetadata": option_metadata,
            "guide":          guides.get(platform, []),
        }

    return captions
