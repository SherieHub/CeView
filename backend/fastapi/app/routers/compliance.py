from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.post("/evaluate")
def evaluate(_: dict) -> dict:
    """SDD §3.3 — multimodal compliance scoring. Returns the shape the
    SmartOptimizationBoard / Module 3 dashboard renders."""
    return {
        "score": 88,
        "aligned": [
            "Destination tags are correctly added so travelers can easily find your location.",
            "Text is clear and very easy to read against the background image.",
            "Important text is placed exactly where Korean travelers naturally look first.",
            "Words like 'healing' and 'rest' perfectly match what your target audience wants to see.",
        ],
        "gaps": [
            "The background looks a bit too crowded or messy. Try using a cleaner, simpler image.",
            "Missing words that suggest a 'fresh start' or 'new beginning', which Korean tourists love.",
            "No people are visible in the photo. Adding a person helps travelers imagine themselves there.",
        ],
        "captionAlignmentScore": 0.91,
        "visualAlignmentScore": 0.84,
        "multimodalComplianceScore": 0.88,
    }
