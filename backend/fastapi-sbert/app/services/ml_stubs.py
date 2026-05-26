"""
Deterministic mock outputs for Module 1 ML models that aren't trained yet.
Keyed by a hash of the input so the frontend sees stable values across reloads.
"""

from __future__ import annotations

import hashlib


def _seed(*parts: str) -> int:
    h = hashlib.md5("|".join(parts).encode()).digest()
    return int.from_bytes(h[:4], "big")


def classify_categories(description: str, core_services: list[str]) -> list[dict]:
    """SBERT classification stub — returns category-allocation percentages summing to 100."""
    seed = _seed(description, *core_services)
    # Reproducible pseudo-distribution tilted toward Accommodation / Culinary
    weights = [
        ("Coastal & Island", (seed % 30)),
        ("Adventure & Nature", (seed // 7) % 20),
        ("Cultural & Heritage", (seed // 13) % 15),
        ("Theme Parks / Entertainment", (seed // 17) % 10),
        ("Urban & City", (seed // 23) % 15),
        ("Culinary & Gastronomy", 20 + (seed // 29) % 20),
        ("Accommodation & Staycation", 30 + (seed // 31) % 30),
    ]
    total = sum(w for _, w in weights) or 1
    return [{"name": n, "percentage": round(w * 100 / total)} for n, w in weights]


def cosine_uniqueness(description: str, categories: list[str]) -> dict:
    seed = _seed(description, *categories)
    desc = 50 + (seed % 50)
    cat = 40 + ((seed // 11) % 50)
    overall = round((desc + cat) / 2)
    return {
        "descriptionScore": desc,
        "categoryScore": cat,
        "overallScore": overall,
        "descriptionReasoning": "Use more sensory, place-specific language to separate your copy from generic resort descriptions.",
        "categoryReasoning": "Align but diversify your category mix to stand out from nearby competitors.",
    }
