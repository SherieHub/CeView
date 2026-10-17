"""Curated visual-direction guides per market and platform (Module 3, FR3.6).

Static copy shown next to generated captions, so no second LLM call is needed
for supplementary assets. Read it through ``gemini_client.get_platform_guides``.
"""

from __future__ import annotations

PLATFORM_GUIDES: dict[str, dict[str, list[str]]] = {
    "korea": {
        "instagram": [
            "Aesthetic mood shot — open balcony doors, morning sunlight on tropical fruits beside a plunge pool.",
            "Apply warm, low-contrast golden filters (LUT: 'Mango Sunrise').",
            "Recommended ratio: 4:5 portrait — maximizes feed real-estate on Korean Instagram feeds.",
            "Soft vignette, no text overlay. Let the image breathe.",
            "Cultural nuance: avoid showing other guests — solo 'me-space' framing resonates with Korean healing-travel archetype.",
        ],
        "tiktok": [
            "Slow-motion first-person POV tracking shot — start tight on a local delicacy.",
            "Pan smoothly upward to reveal a crisp ocean panorama — the 'reveal' moment is the hook.",
            "Keep ambient sound prominent; sync video rhythm to chill lo-fi acoustic track.",
            "Duration target: 18–27 seconds — optimal for Korean TikTok algorithm retention window.",
            "Add Korean subtitle overlay at bottom third. Font: rounded sans, white with soft shadow.",
        ],
        "facebook": [
            "Wide establishing shot of coastline at golden hour — captures the 'breath of relief' emotional entry point.",
            "Include a human element (silhouette, hands holding coffee) to trigger empathy and projection.",
            "Facebook favors horizontal 16:9 frame for organic reach; include destination tag overlay.",
            "Use warm, slightly desaturated tones — not oversaturated tropical clichés.",
            "CTA text: 'Plan your escape →' — drives link-click micro-conversion on Facebook.",
        ],
    },
    "japan": {
        "instagram": [
            "Minimalist composition — single subject (a bowl of tropical fruit, a zen garden corner) with ocean behind.",
            "Cool-to-neutral colour grading; avoid oversaturation. Japanese Instagram prefers 'wabi-sabi' aesthetics.",
            "Aspect ratio: 1:1 square for Japanese feed preference.",
            "Add subtle texture overlay (paper grain) to evoke premium editorial feel.",
            "Include one culturally relevant prop — a Japanese straw hat, folded fan, or travel journal.",
        ],
        "tiktok": [
            "Slow, deliberate camera movement — Japanese TikTok users respond to calm, cinematic pacing.",
            "Natural ambient sound (waves, birds, breeze) — no loud electronic music.",
            "Duration: 30–45 seconds — longer than Korean TikTok; Japanese audiences prefer narrative depth.",
            "Subtitle overlay in Japanese katakana/kanji. Clean, minimal font.",
            "End with a peaceful still frame of the ocean — 'ichi-go ichi-e' (once-in-a-lifetime moment) framing.",
        ],
        "facebook": [
            "Clean 16:9 horizontal hero image — resorts, nature paths, cultural sites.",
            "Japanese Facebook users are older; prioritize information density over emotion.",
            "Include pricing anchor or package summary as image overlay text.",
            "Use cool, authoritative colour palette — blues and greens over warm gold.",
            "CTA: 'View full itinerary →' — Japanese audiences want complete information before deciding.",
        ],
    },
    "usa": {
        "instagram": [
            "High-saturation lifestyle shot — vibrant turquoise water, colourful tropical flowers.",
            "Human-in-frame required — US Instagram audiences respond to people, not just scenery.",
            "Stories-first vertical 9:16 format — US Instagram Stories outperform feed for US audiences.",
            "Text overlay with key benefit ('₱ Stronger Than You Think') increases swipe-up engagement.",
            "Use bright, travel-magazine colour grading — bold and aspirational.",
        ],
        "tiktok": [
            "Fast-cut editing — 3–5 clips in the first 3 seconds to capture the US TikTok scroll reflex.",
            "Trending audio from the US Billboard chart or viral sound — check TikTok Creative Center weekly.",
            "Add trending text template ('POV:', 'Tell me you're in Cebu') in the caption and on-screen.",
            "Duration: 15–30 seconds — US TikTok has the shortest average attention window.",
            "End with a strong CTA card: 'Link in bio for the full package deal 🌊'.",
        ],
        "facebook": [
            "Facebook Ad-style creative — bold headline overlay, single value statement, strong CTA button.",
            "US Facebook audiences skew 35+; use 'adventure + comfort' framing (bucket list + luxury).",
            "Horizontal 1.91:1 ratio for Feed; 1:1 for Marketplace.",
            "Use social proof element: '500+ American travellers visited this month'.",
            "CTA: 'Book Now' or 'Get the Deal' — US audiences respond to direct, benefit-led language.",
        ],
    },
}
