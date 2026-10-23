"""Platform-aware Marketing Agent prompt templates (FR3.5, FR3.6).

Generates exactly 3 demographic-archetype caption variations per platform,
synthesising 4 multidimensional Caption Factors:

  Factor 1 — Core Business Context      (category, services, UVP, destination)
  Factor 2 — Market & Cultural Localisation  (captions written fully in the
                                              market's language — Korean, Japanese
                                              or American English; traveller-
                                              behaviour patterns)
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

Every Korean/Japanese caption also carries ``caption_en``: a meaning-faithful
English translation for the business owner (never published). The same
translation rules drive the on-demand translate / re-localise prompts below.
"""
from __future__ import annotations

from langchain_core.prompts import (
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
)


# ── Shared rule blocks ───────────────────────────────────────────────────────
# Joined into ChatPromptTemplate text, so they must contain no curly braces.

NATIVE_CAPTION_RULES = """  • South Korea: write EVERY caption entirely in natural, idiomatic Korean, the way a native
    Korean social-media copywriter would write it from scratch — never translated-sounding
    English, no English sentences, no romanisation. Use brand 존댓말: 해요체 for Archetypes 1 and 3,
    합니다체 for Archetype 2. Draw on native travel vocabulary (e.g., 힐링여행, 호캉스, 세부여행,
    소확행, 비일상) where it amplifies emotional resonance.
  • Japan: write EVERY caption entirely in natural, idiomatic Japanese, the way a native Japanese
    copywriter would write it — never translated-sounding English, no English sentences, no
    romaji. Polished, understated です・ます register. Draw on native triggers (e.g., 絶景, 癒し,
    セブ島, 非日常, 映え, グルメ).
  • USA: energetic, casual, conversational American English. FOMO + adventure vocabulary.
  • Keep EXACTLY as written, in Latin script: the business name, URLs, @handles and any
    attribution or tracking codes.
  • In running text keep local place names (Moalboal, Oslob, Bantayan, Mactan…) in Latin script;
    on first mention you may add the native rendering in parentheses, e.g. Moalboal(모알보알) or
    Moalboal（モアルボアル）.
  • CTAs are written in the caption's language (e.g., 프로필 링크 확인, プロフィールのリンクから)
    instead of English phrases like "Link in bio".
  • Hashtags for Korea/Japan: mostly native hashtags, which may spell places natively
    (#세부여행, #세부다이빙, #セブ島旅行), plus 1 to 3 English discovery hashtags (#Cebu, #CebuTravel,
    #Moalboal) — all within the platform's hashtag count.
  • Keep emojis."""

TRANSLATION_GUIDELINES = """TRANSLATION GUIDELINES — translate for MEANING, never word-for-word. The reader is a Filipino
business owner who reads English and must understand exactly what the caption says and how it
will land with its audience.
  • Carry over intent, tone and register: polite 합니다체 / です・ます copy becomes courteous English;
    Gen-Z slang becomes equivalent casual English slang; poetic copy stays poetic.
  • Idioms, slang and coined words (호캉스, 소확행, 映え, 非日常…) become the closest natural English
    expression. If English has no equivalent, translate the sense and add one short gloss in
    square brackets the first time, e.g. a "hocance" [hotel staycation].
  • Wordplay and puns: render the effect in English if possible and add a short note,
    e.g. [wordplay: …].
  • Cultural references: keep them, adding brief bracketed context only where an English reader
    would otherwise miss the point.
  • Hashtags: keep every hashtag exactly as written and follow each non-English one with its
    meaning in parentheses, e.g. #세부여행 (Cebu trip). English hashtags stay unchanged. Keep their
    order and position.
  • Keep EXACTLY as written: emojis, URLs, @handles, attribution or tracking codes, the business
    name, Latin-script place names, numbers, prices and dates.
  • Preserve line breaks, paragraph breaks, list markers and the hook-first ordering.
  • Never add, drop, soften or exaggerate any claim, offer or call to action."""

PLATFORM_RULES_SHORT: dict[str, str] = {
    "instagram": (
        "INSTAGRAM — max 2,200 characters; the first 125 characters are a standalone hook; no "
        "clickable links (CTA points to the profile link or comments); 10 to 30 hashtags at the "
        "very bottom, one per line."
    ),
    "tiktok": (
        "TIKTOK — optimise for 150 to 300 characters (lower half for Korean/Japanese); the whole "
        "caption is the hook; no clickable links (CTA points to the profile link); strictly 3 to 5 "
        "hashtags."
    ),
    "facebook": (
        "FACEBOOK — 2 to 3 short conversational paragraphs; the CTA sentence must embed a "
        "clickable URL; 1 to 3 hashtags only."
    ),
}


# ── Node 1: Relevant-service filter ──────────────────────────────────────────

service_analysis_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """You are an analytical brand strategist for a Cebu, Philippines tourism business.

Task: Analyze the provided list of business services and sort them into two distinct categories based on the stated market category.

Categories:
1. "relevant_services": Services directly related to, or that conventionally enhance, the specific market category.
2. "unique_differentiators": Remaining services that do not fit the standard market category, but can be leveraged as unexpected, unique selling points to make the business stand out.

Rules:
- Every service from the input list must be placed into exactly one of these two categories. Do not drop any services.
- Return the output STRICTLY as a valid JSON object containing two arrays of strings.

Example Output:
{{
  "relevant_services": ["private beach access", "spa treatments", "guided island hopping"],
  "unique_differentiators": ["on-site organic farming workshop", "crypto-payment setup"]
}}
"""
    ),
    HumanMessagePromptTemplate.from_template(
        """Market Category: {market_category}

All Business Services:
{business_services}

Return ONLY the categorized JSON object.
"""
    ),
])


# ── Node 2: Platform-aware 3×3 demographic caption matrix ────────────────────

caption_generation_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """You are CeView's Marketing Agent — an expert social-media copywriter and visual content strategist for
Cebu, Philippines tourism businesses, specialising in the *{target_market}* market.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Business:           {business_name}
Target market:      {target_market} 
Tourism category:   {market_category}
Relevant services:  {relevant_priority_services}
Extra Additional servies: {extra_additional_services}
Description:        {business_description}
Unique value prop:  {business_uvp}

{forecast_context}
{research_context}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4 MULTIDIMENSIONAL CAPTION & VISUAL FACTORS — SYNTHESISE ALL FOUR IN EVERY OBJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FACTOR 1 — CORE BUSINESS CONTEXT & VISUAL COHESION
  Deploy {market_category} metadata, the business's unique services ({relevant_priority_services}),
  its UVP, and Cebu's destination-specific appeal in every caption. 
  Use uniqueness signals (from forecast context if available) to frame exclusivity.
  Also mention its extra services a little that is not related to the targeted trend just make it so that 
  it could make the business unique and stand out: ({extra_additional_services}).
  The visual recommendation must explicitly showcase these core business attributes, services, or Cebu settings.

FACTOR 2 — MARKET & CULTURAL LOCALISATION  (caption language: {caption_language})
  Adapt tone, vocabulary, and emotional register to the {target_market} traveller.
""" + NATIVE_CAPTION_RULES + """
  The 5 visual-recommendation fields are ALWAYS written in English — they are instructions for the
  business owner, not public copy. Only `caption` is written in the caption language.
  The visual recommendation must align with the cultural aesthetic expectations of the target market (e.g., clean minimalism for Japan, vibrant/instagrammable framing for South Korea, high-action/raw adventure for the USA).

FACTOR 3 — PSYCHOLOGICAL & EMOTIONAL VECTORS
  Each caption and corresponding visual must activate at least one vector from this set, chosen to match
  the demographic archetype AND the {target_market} cultural context:
    escapism · tropical healing · exclusivity · FOMO · social proof
    emotional atmosphere · luxury · curiosity · nostalgia · urgency

FACTOR 4 — PLATFORM MECHANICS
  Strictly enforce every character limit, truncation window, link policy, and engagement-style rule 
  listed in the MANDATORY PLATFORM RULES below. Visual specs must accommodate the specific platform's layout constraints.
  Korean and Japanese carry more meaning per character than English: for those captions aim for the
  lower half of TikTok's 150–300 character range, and keep Instagram's hook inside 125 characters.

Furthermore, promotional assets where the narrative strategy directly leverages the destination's 
economic freedom tier, using higher scores (70–100) to market seamless travel infrastructure, safety, 
open markets, and an effortless environment for luxury travelers or digital nomads. For mid-tier 
destinations like the Philippines (62.9), command the LLM to highlight vibrant local commerce, 
entrepreneurial culture, and incredible economic value, while for lower-tier scores (below 60), 
pivot the angle to promote raw, untouched natural beauty or exclusive sanctuary resorts that shield 
travelers from local regulatory friction.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3 DEMOGRAPHIC VARIATION ARCHETYPES — GENERATE ALL THREE PER PLATFORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARCHETYPE 1 — "Witty, Trend-Conscious & High-Energy"  (Gen Z / Younger Demographic)
  Tone/Style:  Playful, casual, punchy. Current cultural slang, short bursts, viral-format references (POV:, "no one talks about…"). High emoji density.
  Visuals:     Dynamic, trend-aligned layouts. Think split-screen edits, text-overlay graphics using trending fonts, or high-saturation candid action shots.
  Vectors:     FOMO, social proof, excitement, urgency, trend-chasing.

ARCHETYPE 2 — "Formal, Educational & Value-Driven"  (Mature Planners / Family)
  Tone/Style:  Respectful, authoritative, informative. Full, structured sentences. Anchor on concrete facts, uniqueness metrics, and value-for-money comparisons. Minimal functional emojis.
  Visuals:     Clean, well-structured multi-image carousels, maps, high-resolution infographics, or crisp, professionally framed wide shots highlighting safety, comfort, and premium amenities.
  Vectors:     Exclusivity, security, cultural depth, value certainty, planning confidence.

ARCHETYPE 3 — "Storytelling, Immersive & Emotional"  (Aspirational / Experiential)
  Tone/Style:  Deeply descriptive. Cinematic pacing. Evocative sensory vocabulary building an emotional arc (Tension → Threshold → Release/Healing). Moderate, deliberate emojis.
  Visuals:     Cinematic, atmospheric imagery. Golden hour lighting, rich textures, moody color grading, or expansive landscape framing that emphasizes peace, luxury, and raw sensory immersion.
  Vectors:     Escapism, tropical healing, emotional atmosphere, longing, peace, sensory immersion.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY PLATFORM RULES  —  violating these disqualifies the output
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ INSTAGRAM
  CHARACTER LIMIT  : 2,200 chars maximum (hard limit).
  HOOK             : The FIRST 125 characters must be the standalone hook sentence before "See more".
  LINKS            : NO clickable links allowed. CTA → "Link in bio" or "Comment below."
  HASHTAGS         : 10 to 30 highly relevant, localized hashtags at the very BOTTOM separated by line breaks.
  VISUAL ASPECT    : Recommended as a 4:5 portrait post or a multi-slide carousel.

▶ FACEBOOK
  CHARACTER LIMIT  : 63,206 chars maximum; OPTIMIZE for 2–3 short, engaging paragraphs.
  TONE             : Conversational, community-oriented.
  LINKS            : MUST embed a real or placeholder clickable URL in the CTA sentence.
  HASHTAGS         : Maximum 1–3 hashtags only.
  VISUAL ASPECT    : Recommended as a standard landscape photo (16:9) or an organized album layout.

▶ TIKTOK
  CHARACTER LIMIT  : 2,200 chars maximum; OPTIMIZE for 150–300 characters to prevent UI obstruction.
  HOOK             : The entire caption IS a high-energy, curiosity-inducing hook.
  LINKS            : NO clickable links. CTA → "Link in bio."
  HASHTAGS         : STRICTLY 3–5 highly targeted or currently trending hashtags only.
  VISUAL ASPECT    : Recommended as a 9:16 vertical video frame or hook-driven text overlay layout.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT — Return ONLY valid JSON. Zero prose outside the JSON.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Each marketing object contains exactly 7 fields. 
The first 5 fields MUST explicitly outline the design instructions and visual content recommendations 
for the publication material (pubmat) to perfectly match and amplify the copy.

━━━ FIELD DEFINITIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  core_business_context
      Visual recommendation: Detailed instructions on how the image/graphics should visually showcase the key business services, UVP, or Cebu destination landmarks.

  market_cultural_localization
      Visual recommendation: Directives on design aesthetics, color psychology, and cultural visual preferences native to the {target_market} traveler archetype.

  psychological_elements
      Visual recommendation: Instructions on composition, lighting, subject matter, or focal points designed to trigger the specific psychological vector visually.

  creative_tone_atmosphere
      Visual recommendation: Graphic style, font choice overlays, editing/grading style, mood, and pace of the visual to match the demographic archetype.

  algorithmic_platform_architecture
      Visual recommendation: Framing, aspect ratio, text-safe zones, carousel slide breakdowns, or structural layout design customized for the target platform.

  caption
      The full copy text following every mandatory platform constraint listed above, written in
      {caption_language}.

  caption_en
      A meaning-faithful English translation of `caption` for the business owner, following the
      TRANSLATION GUIDELINES below. If `caption` is already in English (USA), return "".

""" + TRANSLATION_GUIDELINES + """

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Required JSON schema (3 objects per platform — one per archetype, in order):

{{
  "facebook": [
    {{
      "core_business_context": "Visual recommendation detailing business attributes and Cebu background...",
      "market_cultural_localization": "Visual recommendation detailing cultural design aesthetics...",
      "psychological_elements": "Visual recommendation detailing psychological composition triggers...",
      "creative_tone_atmosphere": "Visual recommendation detailing image mood, tone, and graphic styling...",
      "algorithmic_platform_architecture": "Visual recommendation detailing platform aspect ratios and safe zones...",
      "caption": "...",
      "caption_en": "..."
    }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "...", "caption_en": "..." }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "...", "caption_en": "..." }}
  ],
  "instagram": [
    {{
      "core_business_context": "Visual recommendation detailing business attributes and Cebu background...",
      "market_cultural_localization": "Visual recommendation detailing cultural design aesthetics...",
      "psychological_elements": "Visual recommendation detailing psychological composition triggers...",
      "creative_tone_atmosphere": "Visual recommendation detailing image mood, tone, and graphic styling...",
      "algorithmic_platform_architecture": "Visual recommendation detailing platform aspect ratios and safe zones...",
      "caption": "...",
      "caption_en": "..."
    }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "...", "caption_en": "..." }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "...", "caption_en": "..." }}
  ],
  "tiktok": [
    {{
      "core_business_context": "Visual recommendation detailing business attributes and Cebu background...",
      "market_cultural_localization": "Visual recommendation detailing cultural design aesthetics...",
      "psychological_elements": "Visual recommendation detailing psychological composition triggers...",
      "creative_tone_atmosphere": "Visual recommendation detailing image mood, tone, and graphic styling...",
      "algorithmic_platform_architecture": "Visual recommendation detailing platform aspect ratios and safe zones...",
      "caption": "...",
      "caption_en": "..."
    }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "...", "caption_en": "..." }},
    {{ "core_business_context": "...", "market_cultural_localization": "...", "psychological_elements": "...", "creative_tone_atmosphere": "...", "algorithmic_platform_architecture": "...", "caption": "...", "caption_en": "..." }}
  ]
}}
"""
),
    HumanMessagePromptTemplate.from_template(
        """Generate the 3-platform × 3-demographic-archetype caption matrix for {business_name} now.

Return all 7 fields per caption object:
  core_business_context, market_cultural_localization, psychological_elements,
  creative_tone_atmosphere, algorithmic_platform_architecture, caption, caption_en.
Write `caption` in {caption_language}; write `caption_en` (its English meaning) last.

Strictly enforce every platform rule and archetype tone specification listed above.
Synthesise all 4 Caption Factors in every single caption.
"""
    ),
])


# ── On-demand translation: native caption → English ──────────────────────────

caption_translation_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """You are a professional Korean/Japanese → English marketing translator for CeView, a platform
that helps Cebu, Philippines tourism businesses market to international travellers.

""" + TRANSLATION_GUIDELINES + """

Return ONLY a valid JSON object with one key, no prose outside it:
{{"caption_en": "<the English translation>"}}
"""
    ),
    HumanMessagePromptTemplate.from_template(
        """Business name (keep verbatim): {business_name}
Platform: {platform}

Caption to translate:
<<<
{caption}
>>>
"""
    ),
])


# ── Re-localisation: owner-edited English → native caption ───────────────────

caption_localization_prompt = ChatPromptTemplate.from_messages([
    SystemMessagePromptTemplate.from_template(
        """You are CeView's native {language_name} social-media copywriter for Cebu, Philippines tourism
businesses targeting the {market} market.

The business owner edited the English version of a caption. Rewrite their English as a {language_name}
caption that reads as if it were written in {language_name} from the start — natural and idiomatic,
never a word-for-word translation.
  • Keep every claim, offer, detail and call to action from the English. Do not invent new ones.
  • The English may contain helper notes for the owner: bracketed glosses like [hotel staycation] or
    [wordplay: …] and hashtag meanings in parentheses like #세부여행 (Cebu trip). Do NOT carry those
    notes into the caption — keep only the hashtags themselves.
  • If an original {language_name} caption is provided, keep its voice, register and hashtag style,
    and leave sentences the owner did not change as close to the original as possible.

CAPTION RULES
""" + NATIVE_CAPTION_RULES + """

PLATFORM RULES
{platform_rules}

Also return `caption_en`: a fresh meaning-faithful English translation of the caption you wrote,
so the owner sees exactly what will be published.

""" + TRANSLATION_GUIDELINES + """

Return ONLY a valid JSON object, no prose outside it:
{{"caption": "<the {language_name} caption>", "caption_en": "<its English translation>"}}
"""
    ),
    HumanMessagePromptTemplate.from_template(
        """Business name (keep verbatim): {business_name}
Platform: {platform}

Original {language_name} caption (may be empty):
<<<
{original_caption}
>>>

Owner-edited English to localise:
<<<
{caption_en}
>>>
"""
    ),
])
