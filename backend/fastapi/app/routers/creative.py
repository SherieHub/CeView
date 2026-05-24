from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.post("/generate")
def generate(_: dict) -> dict:
    """Static creative-direction stub matching VisualDirectionBoard expectations."""
    return {
        "shotListRecommendations": [
            "Aerial drone shot starting high above the ocean, moving slowly toward a private villa balcony.",
            "Close-up of a local breakfast tray on the balcony with ocean blur in the background.",
            "POV walking through lush resort gardens, opening a gate to a private beach.",
        ],
        "visualRecommendations": [
            "Soft, dreamy color grading; avoid oversaturated tropical clichés.",
            "Use warm, low-contrast golden filters during the first 3 seconds.",
            "Maintain a 4:5 portrait ratio for Korean Instagram feeds.",
        ],
        "lightingSuggestions": [
            "Golden hour (06:00–07:30 or 16:30–18:00) only — midday light flattens the ocean texture.",
            "Backlight subjects against the ocean for depth and silhouette warmth.",
        ],
        "moodboardReferences": [
            "Aman Resorts editorial photography",
            "Wabi-sabi minimal interiors",
            "Korean 'healing travel' Instagram aesthetic",
        ],
    }
