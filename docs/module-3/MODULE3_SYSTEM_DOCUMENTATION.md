# Module 3: System Documentation

---

## Diagram Index

| Scope | Class Diagram | Sequence Diagram | ER Diagram |
|-------|--------------|-----------------|------------|
| [Module 3 (end-to-end)](README.md) | [class.puml](class.puml) | [sequence.puml](sequence.puml) | [er.puml](er.puml) |
| [3.1 Market-Localized Promotional Content Generation](3.1-content-generation/README.md) | [class.puml](3.1-content-generation/class.puml) | [sequence.puml](3.1-content-generation/sequence.puml) | [er.puml](3.1-content-generation/er.puml) |
| [3.2 Creative Direction and Visual Recommendation Generation](3.2-creative-direction/README.md) | [class.puml](3.2-creative-direction/class.puml) | [sequence.puml](3.2-creative-direction/sequence.puml) | [er.puml](3.2-creative-direction/er.puml) |
| [3.3 OMCS Compliance Audit](3.3-compliance/README.md) | [class.puml](3.3-compliance/class.puml) | [sequence.puml](3.3-compliance/sequence.puml) | [er.puml](3.3-compliance/er.puml) |

All diagrams are PlantUML (`.puml`), font size 12, portrait layout — render with the VS Code PlantUML extension or any compatible renderer.

---

## User Flows & Interaction (The Frontend)

Module 3 is the **Content Studio** — a single-view, sequential workflow that takes a business profile
and a target market and produces (1) culturally localised promotional captions for four social
platforms and (2) AI-generated visual direction and shot lists. The entire module lives inside
`ceview/components/module-3/3.1-content-studio/ContentStudioView.tsx` and is reached by navigating to
`/content` from the Market Radar drawer's "Target this market" CTA or directly from the sidebar.

As of the UI/UX overhaul, this same screen also owns publish gating, a content board, and the publish
action itself, and two new screens (Calendar, Settings → Platforms) join it under Module 3. Full
current screen-level detail lives in:

- [`screens/content-studio.md`](screens/content-studio.md)
- [`screens/calendar.md`](screens/calendar.md)
- [`screens/settings-platforms.md`](screens/settings-platforms.md)

The four sub-flows below describe the generation, creative-direction, and compliance-audit pipelines
that back the Content Studio screen — unchanged by the overhaul except that Sub-Flow A's tab set now
explicitly includes Naver's two-option branch (documented in point 10, still current) and captions are
approved per-platform independently, matching [content-studio.md](screens/content-studio.md).

---

### Sub-Flow A — Content Generation & Caption Matrix (Submodule 3.1)

1. **On mount**: `ContentStudioView` immediately fires `api.generateContent({ market, businessName, description, categories, trend }, businessProfileId)` → `POST /api/content/generate`. A full-page spinner "Generating content…" replaces the layout while the request is in-flight.
2. **Error states**: If generation fails, `<ServerErrorBanner>` appears with the structured `ApiError` code and trace ID. A fallback state message ("The content engine is unavailable") is shown below.
3. **Fallback pill**: When `content.source === 'fallback'` (Groq API key absent or unavailable), a gold "Demo content (LLM offline)" pill appears in the header so operators know they are seeing curated template data.
4. **Content header**: Once loaded, a navy header card shows `"{Country} — {City} Profile"` derived from the `content.market` object returned by the API.
5. **AI Copywriting Matrix** (`AIContentMatrixPanel`): Three platform tabs render across the top — **Instagram**, **TikTok**, **Facebook**. Each tab displays 3 `CopywritingOptionCard` components, one per demographic archetype:
   - **Archetype 1 — "Witty, Trend-Conscious & High-Energy"** (Gen Z / Younger Demographic)
   - **Archetype 2 — "Formal, Educational & Value-Driven"** (Mature Planners / Family)
   - **Archetype 3 — "Storytelling, Immersive & Emotional"** (Aspirational / Experiential)
6. **Caption card features**: Each card shows the archetype name, the full caption text, and a live character counter vs. the platform limit. The 5 explainability fields returned by the LangGraph agent (`core_business_context`, `market_cultural_localization`, `psychological_elements`, `creative_tone_atmosphere`, `algorithmic_platform_architecture`) accompany each option. Cards can be edited inline — the `editOverrides` state map tracks changes per `"{tab}-{idx}"` key.
7. **Platform character limits** (enforced by `PLATFORM_CHAR_LIMITS` in `CopywritingOptionCard.tsx`):

   | Platform | Enforced Limit | Note |
   |----------|----------------|------|
   | Instagram | 2,200 | Platform hard limit; first 125 chars = hook |
   | TikTok | 300 | Optimal display target (hard limit 2,200) |
   | Facebook | 500 | Practical conversational target |

8. **Caption approval**: User clicks "Approve" on a card → `handleApproveOption(idx, text)` fires:
   - Updates `approvedIndices[activeTab] = idx` (gold ring appears on approved card).
   - Updates `approvedCaptions[activeTab] = text`.
   - Stages the text in `stagedCaption` (auto-populates the `MediaCaptionManager` textarea).
   - **Fire-and-forget persistence**: `api.approveContent(businessProfileId, market)` → `POST /api/content/approve`. This marks the content as approved in `tbl_localized_promotional_content`. The approval state is required by Submodule 3.2.

9. **Visual Direction Board** (`VisualDirectionBoard`): Rendered alongside the caption matrix. Displays `platform.guide[]` — a list of curated visual direction tips per platform (e.g., "Aesthetic Mood Shot", "Apply warm golden filter", "4:5 portrait ratio"). These are market-specific and platform-specific, loaded from `gemini_client.get_platform_guides(market)`.

10. **Naver Blog tab**: A fourth platform injected into the API response. Content is **hardcoded Korean-language blog posts** — not generated by the LangGraph agent (which produces only the three main platforms). The two Naver options are: "힐링 스팟 스토리" (Healing Spot Story) and "여행 후기" (Travel Review).

---

### Sub-Flow B — Creative Direction (Submodule 3.2)

1. **Trigger**: After approving 3.1 content, the operator runs creative direction → `api.generateCreative(profileId, market)` → `POST /api/creative-direction/generate/{profileId}`.
2. **Dependency gate**: if no approved 3.1 content exists for the profile + market, the request is rejected with HTTP 400 `missing_dependency`; the UI prompts the operator to approve captions first.
3. **Visual Direction Board** renders the returned `visualGuide[]` staging blueprint per platform via `BlueprintStepItem`. The backend also returns `shots[]` and `moodboard` (palette + references); these are available in the response but not yet visualized in the UI.
4. **Approval**: `api.approveCreative(profileId, market)` → `POST /api/creative-direction/approve/{profileId}` marks the latest creative direction output approved.

---

### Sub-Flow C — Distribution Panel

`DistributionPanel` shows social platform channel cards (Instagram `@cebutravel_kr`, TikTok `@cebuhealing`, Facebook `CebuTourismKR`). These display connection status (verified/unverified icons) and are UI scaffolding for future social API integrations — no live API calls are made from this panel.

---

### Sub-Flow D — OMCS Compliance Audit (Submodule 3.3)

1. **Toggle**: The operator enables the compliance audit via `SmartOptimizationBoard`'s toggle. `auditOn = true` reveals `MediaCaptionManager` (caption textarea + media upload zone).
2. **Caption staging**: The `stagedCaption` field is pre-populated from the most recently approved caption card (`handleApproveOption` sets it automatically). The operator can edit it in `CaptionTextArea` before running the audit.
3. **Media upload**: `MediaDropzone` accepts PNG, JPG, or WEBP up to 20 MB via drag-and-drop or file browser. On selection the file is read as a base64 data URL (`imageDataUrl`) and a preview is shown in `MediaPreviewCard`. If no media is uploaded, `AuditEmptyBanner` blocks the run button.
4. **Audit execution**: The operator clicks "Run Audit". `runOmcsAudit()` in `ContentStudioView` fires → `api.analyzeOmcs({ caption, imageUrl: imageDataUrl, businessProfile, recommendations })` → `POST /api/compliance/omcs-analyze`. A 6-step `auditProgress` animation plays while the request is in-flight.
5. **Score display**: On response, `SmartOptimizationBoard` renders:
   - `ComplianceGauge` — SVG circular gauge coloured green (score ≥80), gold (≥60), or red (<60).
   - Three component scores: Profile Semantic Score (weight 0.35), Recommendations×Picture Score (weight 0.45), Pubmat Consistency Score (weight 0.20).
   - Rubric breakdown table — 7 evaluation criteria with individual scores.
   - Pass/Fail badge and a diagnostic `feedback` string when the audit fails.
6. **No persistence**: The audit result is held in `omcs` state only. No rows are written to the database (compliance tables were dropped in V16 — the audit is fully stateless).

---

## System Workflow & Sequence (The Bridge)

Module 3 has **two sequential transactions** — each builds on the previous. Submodule 3.2 requires 3.1 to have produced approved content.

---

### Request Lifecycle 1 — Content Generation (Submodule 3.1)

**Trigger**: `ContentStudioView` mounts → `POST /api/content/generate?profileId={UUID}`.

1. `ContentController.generate()` delegates to `ContentGenerationService.generate()`.
2. **DB enrichment (FR3.1)**: When `profileId != null`, loads `BusinessProfile` from `tbl_business_profile`. DB values **override** the HTTP request body — ensuring the AI prompt uses the verified, persisted identity rather than user-supplied fields from the frontend.
3. **Forecast context (FR3.4)**: `buildForecastContext(profileId, market)` queries the latest `ForecastResult` (4-week horizon) + `MarketScore` from Module 2 tables. Extracts: `predictedDemand`, `marketScore`, `spikeIndicator`, `seasonalityScore`. This context is formatted into the FastAPI prompt.
4. Builds an enriched snake_case payload → `ai.generateCaption(payload)` → `POST /internal/generation/caption` to fastapi-sbert (30 s timeout). *(`AIInferenceGatewayService.generateContent()` → `/internal/content/generate` exists as an alternate but is not used by this path.)*
5. FastAPI runs the **LangGraph caption generation pipeline** (see Engine section) → returns the `ContentResponseDto` shape.
6. **Persistence (FR3.10)**: For each platform in `dto.captions()`, creates one `LocalizedPromotionalContent` row in `tbl_localized_promotional_content` (per-platform: caption text, content direction, framework, source). Writes a `ContentGenerationLog` audit entry.
7. Returns `ContentResponseDto` as `200 OK`.

---

### Request Lifecycle 2 — Content Approval

**Trigger**: User clicks "Approve" on a caption card → `POST /api/content/approve?profileId={UUID}` with body `{ "market": "korea" }`.

1. `ContentController.approve()` delegates to `ContentApprovalService.approveForMarket(profileId, market)`.
2. Finds all `LocalizedPromotionalContent` rows for `(profileId, market)` where `approval_status = false`.
3. Sets `approval_status = true`, stamps `approved_at = now()`.
4. Returns a map `{ approvedIds, market, count }`. This approval flag is the **dependency gate** checked by Submodule 3.2 before generating creative direction.

---

### Request Lifecycle 3 — Creative Direction (Submodule 3.2)

**Trigger**: `api.generateCreative(profileId, market)` → `POST /api/creative-direction/generate/{profileId}?market=`.

1. `CreativeDirectionController.generate()` delegates to `CreativeDirectionService.generate(profileId, market)`.
2. **Dependency check (FR3.11)**: `contentApprovalService.hasApprovedContent(profileId, market)` — queries `tbl_localized_promotional_content` for approved rows. If none → throws `IllegalStateException("missing_dependency")` → controller returns `400 { error: "missing_dependency" }`. This is the **A3 alternative flow**.
3. `contentApprovalService.getApprovedCaptions(profileId, market)` — reads approved caption text from DB.
4. Loads `BusinessProfile` (categories, uniquenessScore) and `buildForecastContext()`.
5. Builds payload with `approvedCaptions[]` → `ai.generateCreative(payload)` → `POST /internal/creative/generate`.
6. FastAPI generates visual direction via Groq (`gemini_client.generate_creative_direction()`).
7. **Persistence (FR3.19)**: Saves a `CreativeDirectionOutput` entity: `shotListRecommendations`, `visualRecommendations`, `lightingSuggestions`, `moodboardReferences`, `platformRecommendations`, `visualTone` (palette string). Writes a `CreativeDirectionLog` audit entry. Returns `CreativeDirectionDto` (`visualGuide`, `shots`, `moodboard`).

---

### Request Lifecycle 4 — Creative Direction Approval

**Trigger**: `api.approveCreative(profileId, market)` → `POST /api/creative-direction/approve/{profileId}?market=`.

1. `CreativeDirectionController.approve()` → `CreativeApprovalService.approveLatest(profileId, market)`.
2. Marks the latest `CreativeDirectionOutput` for the profile + market `approval_status = true`, stamps `approved_at = now()`.
3. Returns `{ approvedId, market }`.

---

## Background Processing & Algorithmic Logic (The Engine)

### Module 3 AI Stack Overview

Module 3 uses two AI clients across the two transactions:

| Component | AI Client | Model | Role |
|-----------|-----------|-------|------|
| Caption Generation Agent (3.1) | `langchain_groq.ChatGroq` via LangGraph | `llama-3.3-70b-versatile` | Node 1 service filter + Node 2 caption matrix |
| Creative Direction (3.2) | `openai.OpenAI` (Groq base URL) via `gemini_client` | `llama-3.3-70b-versatile` | Visual direction, shot list, moodboard |
| Cultural Research (3.1) | SerpAPI → curated templates fallback | N/A | Market-specific traveler behavior context |

---

### LangGraph Caption Generation Agent (3.1)

The agent is defined in `app/agents/creative_director_agent/` and compiled as a `StateGraph` with exactly two nodes and a linear flow:

```
Entry Point
     │
     ▼
┌──────────────────────┐
│  Node 1              │
│  analyze_services    │  ← Filters business services into relevant vs. differentiators
└──────────────────────┘
     │   (always proceeds — no conditional branching)
     ▼
┌────────────────────────────┐
│  Node 2                    │
│  generate_platform_captions│  ← Produces 3-platform × 3-archetype caption matrix
└────────────────────────────┘
     │
     ▼
    END
```

**`SocialAgentState` (LangGraph typed dict):**

```python
{
  # Inputs (set by CaptionInputClass before ainvoke())
  business_name:        str          # from BusinessProfile
  business_description: str          # from BusinessProfile
  business_uvp:         str          # from BusinessProfile
  business_services:    list[str]    # categories from BusinessProfile
  market_category:      str          # first category or trend
  target_market:        str          # "South Korea" | "Japan" | "USA"
  forecast_context:     str          # pre-formatted multi-line string from Module 2
  research_context:     str          # pre-formatted multi-line string from SerpAPI/templates

  # Outputs (set by nodes during graph execution)
  relevant_priority_services: list[str]        # set by Node 1
  extra_additional_services:  list[str]        # set by Node 1
  final_captions:             dict             # set by Node 2
  source:                     str              # "groq" | "fallback"
}
```

---

#### Node 1 — `analyze_services` (Service Relevance Filtering)

**LangChain chain**: `service_analysis_prompt | ChatGroq | JsonOutputParser()`

**System prompt**: "You are an analytical brand strategist for a Cebu, Philippines tourism business. Sort all provided business services into two categories: `relevant_services` (directly related to the market category) and `unique_differentiators` (unexpected selling points that make the business stand out). Every service must appear in exactly one category."

**Input variables**: `{ market_category, business_services }` (all services from state).

**Output**: `{ relevant_services: [...], unique_differentiators: [...] }` which maps to state keys `relevant_priority_services` and `extra_additional_services`.

**Fallback** (LLM unavailable): All services passed as `relevant_priority_services`; `extra_additional_services = []`. The graph continues without error — Node 2 receives the unfiltered list.

**Purpose**: Separates core offerings (used in the primary marketing narrative) from unexpected differentiators (mentioned briefly to add uniqueness). Both sets are injected into the Node 2 prompt as separate template variables.

---

#### Node 2 — `generate_platform_captions` (Caption Matrix Generation)

**LangChain chain**: `caption_generation_prompt | ChatGroq | JsonOutputParser()`

**System prompt structure** (injected template variables):

```
━━━━━ BUSINESS CONTEXT ━━━━━
Business:           {business_name}
Target market:      {target_market}
Tourism category:   {market_category}
Relevant services:  {relevant_priority_services}
Extra services:     {extra_additional_services}
Description:        {business_description}
Unique value prop:  {business_uvp}

{forecast_context}    ← Module 2 market score, demand, spike, seasonality
{research_context}    ← SerpAPI/template traveler behavior, platform styles

━━━━━ 4 MULTIDIMENSIONAL CAPTION FACTORS ━━━━━
Factor 1 — Core Business Context
Factor 2 — Market & Cultural Localisation
Factor 3 — Psychological & Emotional Vectors
Factor 4 — Platform Mechanics

━━━━━ 3 DEMOGRAPHIC VARIATION ARCHETYPES ━━━━━
Archetype 1 — "Witty, Trend-Conscious & High-Energy"  (Gen Z)
Archetype 2 — "Formal, Educational & Value-Driven"    (Mature Planners)
Archetype 3 — "Storytelling, Immersive & Emotional"   (Aspirational)

━━━━━ MANDATORY PLATFORM RULES ━━━━━
[Per-platform character limits, link policies, hashtag counts]
```

**The 4 Caption Factors** force holistic caption construction across four dimensions simultaneously:
- **Factor 1 (Core Business Context)**: Tourism category metadata, unique services, UVP, and Cebu's destination-specific appeal.
- **Factor 2 (Market & Cultural Localisation)**: Native-language integration — Hangul for Korean (힐링여행, 호캉스, 세부여행); Kanji/Katakana for Japanese (絶景, 癒し, セブ島, 非日常); casual American English with FOMO vocabulary for USA.
- **Factor 3 (Psychological Vectors)**: Per-archetype emotional activation — Archetype 1 uses FOMO/urgency; Archetype 2 uses exclusivity/value; Archetype 3 uses escapism/tropical healing via the tension→threshold→release emotional arc.
- **Factor 4 (Platform Mechanics)**: Character limits, truncation windows, link policies, and hashtag counts strictly enforced.

**The 3 Demographic Archetypes** produce three fundamentally different tones per platform:

| Archetype | Tone | Emoji | Psychological Vectors |
|-----------|------|-------|-----------------------|
| Witty, Trend-Conscious & High-Energy | Playful, casual, punchy | High density | FOMO, social proof, excitement, urgency |
| Formal, Educational & Value-Driven | Respectful, authoritative | Minimal (📍 ✈️ 📅) | Exclusivity, security, value certainty |
| Storytelling, Immersive & Emotional | Cinematic, sensory, emotional arc | Moderate | Escapism, tropical healing, nostalgia |

**Per-platform rules enforced by the prompt:**

| Rule | Instagram | Facebook | TikTok |
|------|-----------|----------|--------|
| Char limit (UI counter) | 2,200 | 500 (practical target) | 300 (optimal; hard limit 2,200) |
| Hook window | First 125 chars | ~250 chars | Entire caption = hook |
| Links | "Link in bio" only | Embed clickable URL in CTA | "Link in bio" only |
| Hashtags | 10–30, native-language, at bottom | Max 1–3 only | Strictly 3–5 trending |

**Output schema** (6-field object per archetype, per platform):
```json
{
  "facebook":  [ { "core_business_context": "...", "market_cultural_localization": "...",
                   "psychological_elements": "...", "creative_tone_atmosphere": "...",
                   "algorithmic_platform_architecture": "...", "caption": "..." }, ×3 ],
  "instagram": [ { same 6 fields }, ×3 ],
  "tiktok":    [ { same 6 fields }, ×3 ]
}
```

**Validation**: The service validates that each platform has ≥1 object and each object has a non-empty `caption` field. If validation fails → `RuntimeError(MOD31_CAPTION_AGENT_FAILED)`.

**Fallback** (LLM unavailable): `_fallback_captions()` from `gemini_client._mock_captions()` — curated Korean-market captions across 3 platforms × 3 archetypes, with full 5-field metadata and `source: "fallback"`.

---

### Cultural Research Pipeline (FR3.3)

**Step**: `cultural_research.research_market(market)` — called before the LangGraph agent runs.

**Live path (SerpAPI available)**:
- Query: `"Cebu Philippines tourism {market} travelers 2024 trends preferences"`
- Fetches top 5 organic results; concatenates `snippet` fields (capped at 800 chars)
- Overwrites `traveler_behavior` field in the template with live snippets
- Returns `source: "serpapi"`

**Fallback (SerpAPI unavailable or `SERPAPI_KEY` not set)**:
- Returns curated `_MARKET_TEMPLATES[market]` with `source: "template"`
- Each template covers: `traveler_behavior`, `tourism_preferences`, `platform_styles`, `language_nuances`, `primary_platform`, `secondary_platforms`

**Per-market template highlights:**

| Market | Primary Platform | Key Language Signals |
|--------|-----------------|---------------------|
| Korea | Naver Blog | 힐링 (healing), 호캉스 (hotel+vacation), 나만의 공간 (personal space), 존댓말 (formal register) |
| Japan | Facebook | 絶景 (breathtaking), 非日常 (non-daily), 癒し (healing), 映え (Instagrammable), です・ます (polite form) |
| USA | Instagram Reels | "hidden gem", "bucket list", FOMO framing, direct CTA language, social proof |

**Context injection**: The result is formatted by `_format_research_context()` into a multi-line string injected into the LangGraph prompt as `{research_context}`.

---

### Creative Direction Generation (Submodule 3.2)

**`gemini_client.generate_creative_direction()`** calls Groq with a prompt that includes:
- Business name, categories, uniqueness score.
- Approved promotional captions from 3.1 (used as the creative brief).
- Market-specific platform priority (FR3.16).
- Forecast context spike indicator (→ urgency framing if spike is true).

**Market-to-platform priority mapping (FR3.16)**:

| Market | Primary Platform | Secondary Platforms |
|--------|-----------------|---------------------|
| Korea | Naver Blog | Instagram, TikTok |
| Japan | Facebook & Instagram | TikTok |
| USA | Instagram Reels | TikTok, Facebook |

**Groq returns JSON with**:
- `visualGuide[]` — composition guidelines (framing, subject emphasis, environmental focus)
- `shots[]` — objects each with `{ label, description, lighting }` (shot list + video sequences)
- `moodboard` — `{ palette: str (color/tone description), references: [style references] }`
- `platformRecommendations` — `{ platform_name: recommendation_string }` for primary + secondary
- `source` — `"groq"` or `"fallback"`

**Curated fallback (`_creative_fallback`)**: Full per-market templates for Korea (golden hour aerials, 4:5 portrait, Naver long-form), Japan (wabi-sabi minimalism, 16:9 Facebook, non-daily-life framing), USA (9:16 vertical Reels, fast-cut editing, vibrant saturated palette).

**Persistence**: `visualTone` (extracted from `moodboard.palette`) and `shotListRecommendations` are stored in `tbl_creative_direction_output` for operator reference. Note: the Spring `CreativeDirectionDto` returned to the frontend surfaces only `visualGuide`, `shots`, and `moodboard`; `platformRecommendations` and `source` exist on the FastAPI `CreativeDirectionResponse`.

---

### `AgentLLMModel` — Thread-Safe LLM Singleton

```python
class AgentLLMModel:
    _instance = None
    _lock = threading.Lock()   # prevents race conditions on first access

    def _initialize(self):
        from langchain_groq import ChatGroq
        self._model = ChatGroq(
            model      = "llama-3.3-70b-versatile",
            temperature = 0.7,              # creative temperature for caption writing
            groq_api_key = api_key,
        )
```

**Self-healing**: `get_model()` calls `_initialize()` again if `_model` is `None` — handles environments where `GROQ_API_KEY` is set after module import. Used by the 3.1 caption-generation agent nodes. The `gemini_client.py` uses a separate `openai.OpenAI(base_url="https://api.groq.com/openai/v1")` instance with `temperature=0.4` for the creative-direction functions — lower temperature for more deterministic factual outputs.

---

## API & Integration Contracts

### Spring Boot Public Endpoints (consumed by React frontend)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/content/generate` | `permitAll` | Generate 3-platform × 3-archetype caption matrix |
| `POST` | `/api/content/approve` | `permitAll` | Approve content for a market (UC-3.1 step 14) |
| `POST` | `/api/creative-direction/generate/{profileId}` | `permitAll` | Generate visual direction (requires 3.1 approved) |
| `POST` | `/api/creative-direction/approve/{profileId}` | `permitAll` | Approve creative direction output |
| `POST` | `/api/compliance/omcs-analyze` | `permitAll` | OMCS compliance audit — stateless passthrough to FastAPI omcs_agent (Submodule 3.3) |

---

#### `POST /api/content/generate?profileId={UUID}`

**Request body**:
```json
{
  "market": "korea",
  "businessName": "Sunset Cove Beach Resort",
  "description": "A serene beachfront property in Moalboal...",
  "categories": ["Coastal & Island"],
  "trend": "Healing Travel"
}
```

**Response** `200 OK` (abbreviated):
```json
{
  "market": { "country": "South Korea", "flag": "🇰🇷", "city": "Seoul" },
  "framework": "SOR — Stimulus-Organism-Response",
  "source": "groq",
  "captions": {
    "instagram": {
      "options": ["POV: you booked the 호캉스...", "Cebu, Philippines: a certified...", "Burned out?..."],
      "optionNames": ["Witty, Trend-Conscious & High-Energy", "Formal, Educational & Value-Driven", "Storytelling, Immersive & Emotional"],
      "optionMetadata": [
        {
          "core_business_context": "Korean-market healing resort...",
          "market_cultural_localization": "호캉스 naturally embedded...",
          "psychological_elements": "FOMO, excitement/hype...",
          "creative_tone_atmosphere": "Gen Z slang register...",
          "algorithmic_platform_architecture": "Instagram: ≤2200 chars; hook in first 125 chars..."
        }
      ],
      "guide": [
        "Aesthetic mood shot — open balcony doors...",
        "Apply warm, low-contrast golden filters...",
        "Recommended ratio: 4:5 portrait..."
      ]
    },
    "tiktok": { "..." },
    "facebook": { "..." },
    "naver": {
      "options": ["세부에서 찾은 나만의 힐링 스팟 🌴...", "직장인 필수 코스!..."],
      "optionNames": ["힐링 스팟 스토리", "여행 후기"],
      "guide": ["Long-form editorial blog layout..."]
    }
  }
}
```

---

#### `POST /api/creative-direction/generate/{profileId}?market=korea`

**Response** `200 OK` (`CreativeDirectionDto`):
```json
{
  "visualGuide": ["Lead with a golden-hour aerial...", "Frame the subject at 4:5..."],
  "shots": [
    { "label": "Hero shot", "description": "Open balcony doors to the sea", "lighting": "Warm golden hour" }
  ],
  "moodboard": { "palette": "Warm corals, sand neutrals, teal sea", "references": ["...", "..."] }
}
```

**Error responses**:

| Code | HTTP | Meaning |
|------|------|---------|
| `missing_dependency` | 400 | No approved 3.1 content for the profile + market |
| `MOD32_CREATIVE_GENERATION_FAILED` | 503 | FastAPI generation failed |
| `MOD3_CREATIVE_GATEWAY_TIMEOUT` | 503 | FastAPI call timed out |

---

### FastAPI SBERT Internal Endpoints (consumed by Spring Boot only)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/internal/generation/caption` | LangGraph caption generation agent (live path for 3.1) |
| `POST` | `/internal/content/generate` | Alternate caption endpoint (not used by the current Spring path) |
| `POST` | `/internal/creative/generate` | Groq visual direction + moodboard |
| `POST` | `/internal/omcs/analyze` | LangGraph omcs_agent — CAS + VAS + HCS scoring, stateless (3.3) |

---

### Database Schema — Module 3 Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `tbl_localized_promotional_content` | `content_id UUID PK`, `business_profile_id FK`, `selected_market VARCHAR`, `platform VARCHAR`, `generated_caption TEXT`, `content_direction TEXT`, `hashtags TEXT`, `cta TEXT`, `tone_suggestion TEXT`, `framework VARCHAR`, `source VARCHAR`, `approval_status BOOLEAN`, `approved_at TIMESTAMPTZ` | Per-platform generated content rows; `approval_status` is the 3.1 → 3.2 dependency gate |
| `tbl_content_generation_log` | `content_log_id UUID PK`, `business_profile_id FK`, `generation_status VARCHAR`, `diagnostics TEXT`, `logged_at TIMESTAMPTZ` | Generation audit trail per request |
| `tbl_creative_direction_output` | `creative_direction_id UUID PK`, `business_profile_id FK`, `selected_market VARCHAR`, `shot_list_recommendations TEXT`, `visual_recommendations TEXT`, `lighting_suggestions TEXT`, `moodboard_references TEXT`, `platform_recommendations TEXT`, `visual_tone TEXT`, `approval_status BOOLEAN`, `approved_at TIMESTAMPTZ` | Creative direction storage (operator reference / display) |
| `tbl_creative_direction_log` | `creative_log_id UUID PK`, `business_profile_id FK`, `generation_status VARCHAR`, `diagnostics TEXT`, `logged_at TIMESTAMPTZ` | Creative direction audit trail |

**Key indexes:**
- `idx_content_profile_market` on `(business_profile_id, selected_market)` — dependency gate query
- `idx_content_approval` on `(business_profile_id, approval_status)` — approval check
- `idx_creative_profile_market` on `(business_profile_id, selected_market)` — creative context retrieval

Schema migration: `V5__module3_content_creative_columns.sql`.

> **Submodule 3.3 — No persistent tables.** `tbl_compliance_evaluation_result` and `tbl_compliance_revision_history` (created in V5/V6, extended in V9) were dropped in `V16__drop_compliance_tables.sql` when the compliance audit was reimplemented as a stateless LangGraph omcs_agent. All audit results are returned in-memory only.

---

## Technology Stack & Infrastructure

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend framework** | React 18 + TypeScript, Vite | Single view (`ContentStudioView`) owns all Module 3 state; `approvedIndices`, `approvedCaptions` are lifted to the view level so all panels share consistent state |
| **Caption matrix UI** | `AIContentMatrixPanel` + `CopywritingOptionCard` | Inline editing with `editOverrides` state map; character counter with platform-specific limits |
| **Agent framework** | LangGraph (`StateGraph`, `ainvoke`) | Two-node sequential workflow — service filtering (Node 1) then caption matrix generation (Node 2); async `ainvoke()` integrates naturally with FastAPI's async request handler |
| **Agent LLM** | `langchain_groq.ChatGroq` (`llama-3.3-70b-versatile`, temperature=0.7) | Higher temperature (0.7) for creative caption writing diversity; thread-safe singleton via `threading.Lock()` prevents concurrent initialization race conditions |
| **Groq client (creative)** | `openai.OpenAI` (Groq OpenAI-compatible API, temperature=0.4) | Lower temperature (0.4) for deterministic factual evaluation; `response_format={"type": "json_object"}` ensures clean JSON without markdown fences |
| **Cultural research** | SerpAPI (`google-search-results` package) → curated template fallback | Live search enriches the Groq prompt with current traveler behavior; curated templates covering all 4 UC-3.1 data points ensure quality output even without SerpAPI access |
| **Visual guides** | `gemini_client.get_platform_guides(market)` — in-memory dict | Market × platform curated visual direction (Korea/Japan/USA × Instagram/TikTok/Facebook/Naver); no Groq call needed for guides — reduces RPM consumption |
| **Naver Blog content** | Hardcoded Korean-language templates | Naver content requires long-form editorial Korean writing which the 3-platform agent cannot produce reliably; curated templates ensure consistent quality |
| **Spring Boot orchestration** | `ContentGenerationService`, `CreativeDirectionService` | 3.1 content → 3.2 creative is enforced by the `approval_status` gate |
| **Content framework** | `"SOR — Stimulus-Organism-Response"` | Theoretical marketing framework embedded as a constant; Stimulus (the hook), Organism (the psychological processing by the traveler), Response (the CTA and booking intent) |
| **Database** | PostgreSQL 16 (shared with Modules 1 and 2) | Stores 3.1 content + 3.2 creative direction |
| **Containerization** | Docker Compose — same `fastapi-sbert` container (port 8000) as Module 1 | Module 3 routes (`/internal/generation`, `/internal/content`, `/internal/creative`) are registered in the same `app.main` alongside Module 1 classification routes |
| **Observability** | MDC error codes (`MOD31_*`, `MOD32_*`, `MOD3_*`), `X-Trace-Id` propagation, `ContentGenerationLog` + `CreativeDirectionLog` audit tables | Every generation and approval event carries a structured log code |
