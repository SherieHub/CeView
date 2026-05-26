"""Platform-aware Marketing Agent prompt templates (FR3.5, FR3.6).

Generates exactly 3 demographic-archetype caption variations per platform,
synthesising 4 multidimensional Caption Factors:

  Factor 1 — Core Business Context      (category, services, UVP, destination)
  Factor 2 — Market & Cultural Localisation  (Hangul/Kanji/Katakana/English;
                                              traveller-behaviour patterns)
  Factor 3 — Psychological & Emotional Vectors  (escapism, tropical healing,
                                                 FOMO, social proof, exclusivity)
  Factor 4 — Platform Mechanics          (char limits, truncation windows,
                                          link policy, engagement styles)

The 3 demographic archetypes are CONSISTENT across all platforms:

  Archetype 1 — "Witty, Trend-Conscious & High-Energy"
                (Gen Z / Younger Demographic)
  Archetype 2 — "Formal, Educational & Value-Driven"
                (Mature Planners / Family Demographic)
  Archetype 3 — "Storytelling, Immersive & Emotional"
                (Aspirational / Experiential Demographic)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLATFORM-SPECIFIC RULES (all variations must comply)

INSTAGRAM
  • Max 2,200 characters total.
  • HOOK must occupy the first 125 characters — the reader sees nothing else
    before "See more" truncation; the hook must stop the scroll solo.
  • NO clickable links in text — CTA → "Link in bio" or "Comment below".
  • 10–30 localized hashtags at the very BOTTOM, one per line.

FACEBOOK
  • Max 63,206 chars; optimize for 2–3 conversational paragraphs.
  • Storytelling / community tone.
  • MUST embed a clickable URL inside the CTA sentence.
  • Max 1–3 hashtags — no spam.

TIKTOK
  • Max 2,200 chars; OPTIMIZE for 150–300 chars (text overlays video UI).
  • Entire caption = hook: high-energy, curiosity-inducing, loop-friendly.
  • NO clickable links — CTA → "Link in bio".
  • Strictly 3–5 highly targeted / trending hashtags.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
from __future__ import annotations

from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)


# ── Node 1: Relevant-service filter ──────────────────────────────────────────

service_analysis_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """You are an analytical brand strategist for a Cebu, Philippines tourism business.

Task: filter the business services list.  Keep ONLY the services that are
directly relevant to, or meaningfully enhance, the stated market category.

Rules:
- Remove services that have nothing to do with the market category context.
- Preserve services that support the traveller experience in that category.
- Return output strictly as a JSON array of strings.

Example:
["private beach access", "spa treatments", "guided island hopping"]
"""
    ),
    HumanMessagePromptTemplate.from_template(
        """Market Category: {market_category}

All Business Services:
{business_services}

Return ONLY the relevant services as a JSON array of strings.
"""
    ),
])


# ── Node 2: Platform-aware 3×3 demographic caption matrix ────────────────────

caption_generation_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """You are CeView's Marketing Agent — an expert social-media copywriter for
Cebu, Philippines tourism businesses, specialising in the **{target_market}** market.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business:           {business_name}
Target market:      {target_market} ({country_market})
Tourism category:   {market_category}
Relevant services:  {relevant_services}
Description:        {business_description}
Unique value prop:  {business_uvp}

{forecast_context}
{research_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4 MULTIDIMENSIONAL CAPTION FACTORS — SYNTHESISE ALL FOUR IN EVERY CAPTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FACTOR 1 — CORE BUSINESS CONTEXT
  Deploy {market_category} metadata, the business's unique services ({relevant_services}),
  its UVP, and Cebu's destination-specific appeal in every caption.
  Use uniqueness signals (from forecast context if available) to frame exclusivity.

FACTOR 2 — MARKET & CULTURAL LOCALISATION
  Adapt tone, vocabulary, and emotional register to the {target_market} traveller.
  • South Korea: Weave in Hangul naturally where it amplifies emotional resonance
    (e.g., 힐링여행 healing-trip, 호캉스 staycation, 세부여행 Cebu-trip,
    자연 치유 nature-healing, 비일상 non-daily-life). Use rest/healing vocabulary.
  • Japan: Incorporate Kanji or Katakana triggers (e.g., 絶景 breathtaking-view,
    癒し healing, セブ島 Cebu-Island, 非日常 non-daily-life, グルメ gourmet).
    Maintain polished, understated, high-quality register.
  • USA: Energetic, casual, conversational American English. FOMO + adventure
    vocabulary. No foreign language unless it adds exotic flavour.

FACTOR 3 — PSYCHOLOGICAL & EMOTIONAL VECTORS
  Each caption must activate at least one vector from this set, chosen to match
  the demographic archetype AND the {target_market} cultural context:
    escapism · tropical healing · exclusivity · FOMO · social proof
    emotional atmosphere · luxury · curiosity · nostalgia · urgency

FACTOR 4 — PLATFORM MECHANICS
  Strictly enforce every character limit, truncation window, link policy,
  and engagement-style rule listed in the MANDATORY PLATFORM RULES below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3 DEMOGRAPHIC VARIATION ARCHETYPES — GENERATE ALL THREE PER PLATFORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARCHETYPE 1 — "Witty, Trend-Conscious & High-Energy"  (Gen Z / Younger Demographic)
  Tone:         Playful, casual, punchy. Current cultural slang localised to
                the {target_market} market.
  Style:        Short bursts, rhetorical questions, viral-format references
                (POV:, "no one talks about…", "tell me you need this without
                telling me", trending TikTok phrase templates).
  Emoji:        High density — use liberally to amplify energy and emotion.
  Vectors:      FOMO, social proof, excitement, urgency, trend-chasing.
  Language tip: For Korean → sprinkle Hangul slang. For Japanese → light
                katakana pop-culture references. For US → casual GenZ idioms.

ARCHETYPE 2 — "Formal, Educational & Value-Driven"  (Mature Planners / Family)
  Tone:         Respectful, authoritative, informative. Minimal slang.
                Professional yet warm.
  Style:        Full, structured sentences. No rhetorical questions.
                Anchor on concrete facts: services offered, itinerary depth,
                cultural/historical context, uniqueness metrics,
                value-for-money comparisons.
  Emoji:        Minimal — only functional (📍 location, ✈️ travel, 📅 dates).
  Vectors:      Exclusivity, security, cultural depth, value certainty,
                family-oriented planning confidence.
  Language tip: For Korean → use respectful 존댓말 register. For Japanese →
                honorific-adjacent, polished phrasing. For US → confident,
                direct, benefits-first language.

ARCHETYPE 3 — "Storytelling, Immersive & Emotional"  (Aspirational / Experiential)
  Tone:         Deeply descriptive. Cinematic pacing. Evocative sensory vocabulary.
  Style:        Build an emotional arc —
                  ① Tension: stress, burnout, or longing for escape
                  ② Threshold: the moment of decision or discovery
                  ③ Release: arrival in paradise, tropical healing, peace
                Uses scene-setting prose, vivid imagery, and emotional resonance.
  Emoji:        Moderate — placed deliberately to punctuate emotional beats.
  Vectors:      Escapism, tropical healing, emotional atmosphere, longing,
                luxury, peace, sensory immersion.
  Language tip: For Korean → invoke 힐링 (healing) and 쉼 (rest) with lyrical
                cadence. For Japanese → evoking 癒し and 旅情 (travel-longing).
                For US → cinematic "bucket-list" and "slow living" framing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY PLATFORM RULES  —  violating these disqualifies the output
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ INSTAGRAM
  CHARACTER LIMIT  : 2,200 chars maximum (hard limit).
  HOOK             : The FIRST 125 characters must be the standalone hook sentence.
                     It appears before "See more" — the reader sees nothing else.
                     The hook alone must stop the scroll.
  LINKS            : NO clickable links allowed.  CTA → "Link in bio" or "Comment below."
  HASHTAGS         : 10 to 30 highly relevant, localized hashtags.
                     Place them at the very BOTTOM of the caption, separated by line breaks.
                     Use native-language hashtags for the target market when possible
                     (Korean: #세부여행 #힐링여행 #호캉스, Japanese: #セブ島 #フィリピン旅行 #癒し旅).
  ARCHETYPE ADAPT  :
    · "Witty, Trend-Conscious & High-Energy"   — hook is a viral-format opener; emoji storm;
                                                  trending/slang hashtags mixed with destination tags
    · "Formal, Educational & Value-Driven"     — informative hook; structured body with key features;
                                                  professional-curated hashtags only
    · "Storytelling, Immersive & Emotional"    — cinematic 125-char hook sentence; emotional arc body;
                                                  sensory/healing hashtags at bottom

▶ FACEBOOK
  CHARACTER LIMIT  : 63,206 chars maximum; OPTIMIZE for 2–3 short, engaging paragraphs.
  TONE             : Conversational, storytelling, community-oriented.
  LINKS            : MUST embed a real or placeholder clickable URL in the CTA sentence.
                     Example: "Book at cebutravel.ph" or "Details at bit.ly/cebu-heal"
  HASHTAGS         : Maximum 1–3 hashtags only.  Do NOT spam.
  ARCHETYPE ADAPT  :
    · "Witty, Trend-Conscious & High-Energy"   — punchy opener, conversational banter tone,
                                                  direct URL CTA, 1–2 trending hashtags
    · "Formal, Educational & Value-Driven"     — authoritative multi-paragraph, facts and concrete
                                                  offer anchors, URL, 1 professional hashtag
    · "Storytelling, Immersive & Emotional"    — immersive storytelling paragraphs, emotional URL CTA,
                                                  1–2 atmosphere hashtags

▶ TIKTOK
  CHARACTER LIMIT  : 2,200 chars maximum; OPTIMIZE for 150–300 characters.
                     Short text so it does NOT obstruct the video player UI.
  HOOK             : The entire caption IS the hook: high-energy, curiosity-inducing,
                     designed so the viewer watches the video loop a second time.
  LINKS            : NO clickable links.  CTA → "Link in bio."
  HASHTAGS         : STRICTLY 3–5 highly targeted or currently trending hashtags only.
  ARCHETYPE ADAPT  :
    · "Witty, Trend-Conscious & High-Energy"   — trending phrase template (POV:, no one told me,
                                                  tell me without telling me); punchy + emoji-rich
    · "Formal, Educational & Value-Driven"     — fact-hook opener ("Did you know Cebu has...?"),
                                                  one key value anchor, clean CTA, minimal emoji
    · "Storytelling, Immersive & Emotional"    — sensory micro-narrative (smell the ocean, feel
                                                  the breeze), cinematic opener, emotional close

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — Return ONLY valid JSON. Zero prose outside the JSON.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each caption object contains exactly 6 fields.
Do NOT include "variation" or "char_count" — they are removed.

━━━ FIELD DEFINITIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  caption
      The full caption text.  Enforce every platform rule above.

  core_business_context                                    [The "What"]
      1–2 sentences: which specific business attributes, services, UVP
      elements, or Cebu destination signals shaped this caption.

  market_cultural_localization                             [The "Who"]
      1–2 sentences: which cultural signals, native-language phrases,
      traveller-behaviour patterns, or regional expectations were
      embedded and why they fit the {target_market} market.

  psychological_elements                                   [The "Why"]
      1–2 sentences: which psychological vectors (escapism, FOMO,
      tropical healing, exclusivity, social proof, urgency, etc.)
      were activated and how they manifest in the copy.

  creative_tone_atmosphere                                 [The "How"]
      1–2 sentences: tone, voice, pacing, emoji density, and
      atmospheric choices made for this specific demographic archetype.

  algorithmic_platform_architecture                        [The Constraints]
      1 sentence: platform-compliance decisions — char limit respected,
      hook window applied, link policy enforced, hashtag count used.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Required JSON schema (3 objects per platform — one per archetype, in order):

{{
  "facebook": [
    {{
      "core_business_context":             "...",
      "market_cultural_localization":      "...",
      "psychological_elements":            "...",
      "creative_tone_atmosphere":          "...",
      "algorithmic_platform_architecture": "...",
      "caption":                           "..."
    }},
    {{
      "core_business_context":             "...",
      "market_cultural_localization":      "...",
      "psychological_elements":            "...",
      "creative_tone_atmosphere":          "...",
      "algorithmic_platform_architecture": "...",
      "caption":                           "..."
    }},
    {{
      "core_business_context":             "...",
      "market_cultural_localization":      "...",
      "psychological_elements":            "...",
      "creative_tone_atmosphere":          "...",
      "algorithmic_platform_architecture": "...",
      "caption":                           "..."
    }}
  ],
  "instagram": [
    {{
      "core_business_context":             "...",
      "market_cultural_localization":      "...",
      "psychological_elements":            "...",
      "creative_tone_atmosphere":          "...",
      "algorithmic_platform_architecture": "...",
      "caption":                           "..."
    }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "..." }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "..." }}
  ],
  "tiktok": [
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "..." }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "..." }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "..." }}
  ]
}}
"""
    ),
    HumanMessagePromptTemplate.from_template(
        """Generate the 3-platform × 3-demographic-archetype caption matrix for {business_name} now.

Return all 6 fields per caption object:
  core_business_context, market_cultural_localization, psychological_elements,
  creative_tone_atmosphere, algorithmic_platform_architecture, caption.

Strictly enforce every platform rule and archetype tone specification listed above.
Synthesise all 4 Caption Factors in every single caption.
"""
    ),
])
