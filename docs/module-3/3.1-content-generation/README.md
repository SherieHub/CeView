# Submodule 3.1 — Market-Localized Promotional Content Generation (Transaction)

Generates a **3-platform × 3-archetype** matrix of market-localized social media captions using a LangGraph 2-node agent powered by Groq (`llama-3.3-70b-versatile`). The agent applies cultural research context (SerpAPI or curated market templates) and Module 2 forecast outputs to produce captions tuned for Korea, Japan, or USA traveler segments. Generated rows persist to PostgreSQL; an explicit **approval gate** marks one caption per platform as approved, which is the prerequisite that unlocks Submodule 3.2.

> **Sequential dependency:** 3.1 must reach `approval_status = true` before 3.2 Creative Direction can run. The guard is `ContentApprovalService.hasApprovedContent(profileId, market)`.

## Diagrams

| Diagram | File | Description |
|---------|------|-------------|
| Class | [class.puml](class.puml) | Frontend components, Spring Boot layers, FastAPI agent, and DTOs across the full stack |
| Sequence | [sequence.puml](sequence.puml) | Request lifecycle: caption generation (on mount) + content approval (fire-and-forget) |
| Entity-Relationship | [er.puml](er.puml) | `tbl_localized_promotional_content` and `tbl_content_generation_log` vs `tbl_business_profile` |

## Use Cases

| ID | Flow | Actor |
|----|------|-------|
| UC3.1 | Generate captions for the selected market | Operator |
| UC3.2 | Approve one caption per platform (unlocks 3.2) | Operator |
| A1 | LLM unavailable → fallback templates returned (`source = "fallback"`) | System |

## Components

### Frontend — React 18 + TypeScript (`ceview/`)

| Component | File | Responsibility |
|-----------|------|---------------|
| `ContentStudioView` | `components/module-3/3.1-content-studio/ContentStudioView.tsx` | Orchestrates all Module 3 state; calls `api.generateContent()` on mount and `api.approveContent()` on approval |
| `AIContentMatrixPanel` | `components/module-3/3.1-content-studio/components/AIContentMatrixPanel.tsx` | Renders platform tabs and the 3 caption options for the active platform |
| `CopywritingOptionCard` | `components/module-3/3.1-content-studio/components/CopywritingOptionCard.tsx` | Archetype card with approve / copy / inline-edit; owns `PLATFORM_CHAR_LIMITS` and the char/hashtag counters |
| `PlatformTab` | `components/module-3/3.1-content-studio/components/PlatformTab.tsx` | Tab selector (Instagram / TikTok / Facebook) |
| `CopyTargetBtn` | `components/module-3/3.1-content-studio/components/CopyTargetBtn.tsx` | Copy-to-clipboard button with state toggle |
| `DistributionPanel` | `components/module-3/3.1-content-studio/components/DistributionPanel.tsx` | Multi-platform deployment cards (post-approval completion of 3.1) |
| `PlatformSyncCard` | `components/module-3/3.1-content-studio/components/PlatformSyncCard.tsx` | Individual channel card (Instagram / TikTok / Facebook / Naver) |

**Frontend service & types**

| Symbol | File | Notes |
|--------|------|-------|
| `api.generateContent(body, profileId?)` | `services/apiClient.ts` | `POST /api/v1/content/generate` |
| `api.approveContent(profileId, market)` | `services/apiClient.ts` | `POST /api/v1/content/approve` (fire-and-forget) |
| `ContentResponseDTO`, `PlatformContent`, `CaptionMetadata`, `ContentPlatformId` | `types.ts` | Response and per-platform option shapes |

### Backend — Spring Boot 3 / Java 21 (`backend/spring-boot/`)

| Class | Package | Responsibility |
|-------|---------|---------------|
| `ContentController` | `com.ceview.module3` | `POST /api/v1/content/generate` and `POST /api/v1/content/approve` |
| `ContentGenerationService` | `com.ceview.module3.submodule31` | Loads `BusinessProfile`, builds forecast context from Module 2, builds the snake_case payload, delegates to FastAPI via `AIInferenceGatewayService.generateCaption()`, deserializes `ContentResponseDto`, persists 4 rows |
| `ContentApprovalService` | `com.ceview.module3.submodule31` | Sets `approval_status = true`; exposes `hasApprovedContent()` / `getApprovedCaptions()` used as the 3.2 dependency gate |
| `LocalizedPromotionalContent` | `com.ceview.module3.submodule31` | JPA entity → `tbl_localized_promotional_content` (4 rows per generate call) |
| `LocalizedPromotionalContentRepository` | `com.ceview.module3.submodule31` | JPA repository (queries by profile + market + approval status) |
| `ContentGenerationLog` | `com.ceview.module3.submodule31` | JPA entity → `tbl_content_generation_log` (audit trail) |
| `ContentGenerationLogRepository` | `com.ceview.module3.submodule31` | JPA repository |
| `ContentDtos` | `com.ceview.module3.dto` | `ContentResponseDto`, `CaptionsDto`, `PlatformContentDto`, `MarketHeaderDto` |
| `AIInferenceGatewayService` | `com.ceview.ai` | `generateCaption(payload)` → `POST /internal/generation/caption` (WebClient to `fastapi-sbert`) |
| `Module3ErrorCodes` | `com.ceview.module3` | `MOD31_CONTENT_*`, `MOD3_CONTENT_GATEWAY_*` |

### Backend — FastAPI (`backend/fastapi-sbert`, port 8000)

| Component | File | Responsibility |
|-----------|------|---------------|
| Caption router | `app/routers/caption_generation.py` | **`POST /internal/generation/caption`** — the live path called by Spring Boot. Accepts `CaptionInputClass`, runs `caption_generation_service`, then `_transform_captions()` + `get_platform_guides()` |
| Content router (alternate) | `app/routers/content.py` | `POST /internal/content/generate` — equivalent endpoint accepting `ContentGenerateRequest`; performs cultural research + forecast formatting itself. Not used by the current Spring path (`AIInferenceGatewayService.generateContent()` exists but is unused for 3.1) |
| `caption_generation_service` | `app/services/caption_generation.py` | Invokes the LangGraph agent; raises `MOD31_CAPTION_AGENT_FAILED` on failure (no silent fallback at this layer) |
| Caption Generation Agent | `app/agents/creative_director_agent/` | LangGraph `StateGraph(SocialAgentState)`: **Node 1** `analyze_services` (relevant vs. extra services) → **Node 2** `generate_platform_captions` (3 archetypes × 3 platforms with 6-field schema) → `END` |
| `SocialAgentState` | `app/agents/creative_director_agent/state.py` | State carrying business context, `forecast_context`, `research_context`, `final_captions`, `source` |
| Agent prompt | `app/agents/creative_director_agent/prompts.py` | Encodes the 4 cultural factors, 3 archetypes, and platform mechanics |
| `cultural_research.research_market()` | `app/services/cultural_research.py` | FR3.3 — live SerpAPI query with curated `_MARKET_TEMPLATES` fallback |
| `gemini_client.get_platform_guides()` | `app/services/gemini_client.py` | Per-market, per-platform visual composition tips; also supplies hardcoded Naver content |
| `AgentLLMModel` | `app/core/AgentLLMModel.py` | Thread-safe `ChatGroq` singleton (`llama-3.3-70b-versatile`), shared across Module 3 agents |
| `CaptionInputClass` | `app/model/CaptionInputClass.py` | Pydantic request model for the agent |

## Caption Archetypes

| # | Archetype (`optionNames`) | Audience | Style |
|---|---------------------------|----------|-------|
| 1 | Witty, Trend-Conscious & High-Energy | Gen Z / younger | Playful, emoji-rich, humor hooks |
| 2 | Formal, Educational & Value-Driven | Mature planners / family | Professional, measured, brand-safe |
| 3 | Storytelling, Immersive & Emotional | Aspirational / experiential | Narrative, evocative, experiential |

## Caption Generation — 4 Cultural Factors

Each generated caption carries 5 metadata fields (`CaptionMetadata`) explaining the AI's reasoning across these factors:

1. **`core_business_context`** — services, UVP, destination signals (the *What*)
2. **`market_cultural_localization`** — language nuance, traveler psychology per market (the *Who*)
3. **`psychological_elements`** — emotional anchors, desire triggers, e.g. escapism / FOMO / healing (the *Why*)
4. **`creative_tone_atmosphere`** + **`algorithmic_platform_architecture`** — tone/voice/pacing and platform mechanics: char limits, hook window, hashtag count (the *How* + Constraints)

## Platform Character Limits

Enforced by `PLATFORM_CHAR_LIMITS` in `CopywritingOptionCard.tsx` (UI counters / progress bars):

| Platform | Enforced Limit | Note |
|----------|----------------|------|
| Instagram | 2,200 | Platform hard limit |
| TikTok | 300 | Optimal display target (platform hard limit is 2,200) |
| Facebook | 500 | Practical conversational target |
| Naver | — | 2 hardcoded curated Korean blog options (not LLM-generated) |

## REST Endpoints — Spring Boot

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/content/generate` | Generate captions; optional `?profileId={UUID}` enriches from DB and persists rows |
| POST | `/api/v1/content/approve` | Approve content for a profile + market; body `{ market }`; returns `{ approvedIds, market, count }` |

## FastAPI Internal Endpoint

| Method | Path | Router | Description |
|--------|------|--------|-------------|
| POST | `/internal/generation/caption` | `caption_generation.py` | Live path — LangGraph caption agent (`CaptionInputClass` → caption matrix) |
| POST | `/internal/content/generate` | `content.py` | Alternate equivalent endpoint (`ContentGenerateRequest`); not used by the current Spring path |

## Database

| Table | Purpose |
|-------|---------|
| `tbl_localized_promotional_content` | Generated captions — 4 rows per generate call (instagram / tiktok / facebook / naver) |
| `tbl_content_generation_log` | Audit trail — one row per generation attempt |

Migration: `V5__module3_content_creative_columns.sql`. Response `source` values: `"groq"` (LLM) or `"fallback"` (curated templates).
