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

### Frontend Components

| Component Name | Description & Purpose | Type / Format |
|----------------|-----------------------|---------------|
| `ContentStudioView` | Main Content Studio interface; orchestrates all Module 3 state and calls `api.generateContent()` on mount and `api.approveContent()` on approval. | React functional component |
| `AIContentMatrixPanel` | Renders the platform tabs and the 3 AI-generated caption options for the active platform. | React panel component |
| `CopywritingOptionCard` | Displays a single archetype caption with approve / copy / inline-edit controls; owns `PLATFORM_CHAR_LIMITS` and the char/hashtag counters. | React card component |
| `PlatformTab` | Tab selector for switching between Instagram / TikTok / Facebook outputs. | React button component |
| `CopyTargetBtn` | Copy-to-clipboard button with copied-state toggle. | React button component |
| `DistributionPanel` | Multi-platform deployment cards shown after approval (completion of 3.1). | React panel component |
| `PlatformSyncCard` | Individual channel card (Instagram / TikTok / Facebook / Naver). | React card component |
| `api.generateContent` | API client method — `POST /api/content/generate`; requests the caption matrix. | TypeScript API client method |
| `api.approveContent` | API client method — `POST /api/content/approve` (fire-and-forget) marking approved captions. | TypeScript API client method |
| `ContentResponseDTO`, `PlatformContent`, `CaptionMetadata`, `ContentPlatformId` | Response and per-platform option shapes consumed by the view. | TypeScript interfaces |

### Backend Components — Spring Boot 3 / Java 21

| Component Name | Description & Purpose | Type / Format |
|----------------|-----------------------|---------------|
| `ContentController` | Exposes `POST /api/content/generate` and `POST /api/content/approve`. | Spring REST Controller |
| `ContentGenerationService` | Loads `BusinessProfile`, builds forecast context from Module 2, builds the snake_case payload, delegates to FastAPI via `AIInferenceGatewayService.generateCaption()`, deserializes `ContentResponseDto`, persists 4 rows. | Spring Service |
| `ContentApprovalService` | Sets `approval_status = true`; exposes `hasApprovedContent()` / `getApprovedCaptions()` used as the 3.2 dependency gate. | Spring Service |
| `LocalizedPromotionalContent` | JPA entity mapping `tbl_localized_promotional_content` (4 rows per generate call). | JPA Entity |
| `LocalizedPromotionalContentRepository` | Queries content by profile + market + approval status. | JPA Repository |
| `ContentGenerationLog` | JPA entity mapping `tbl_content_generation_log` (audit trail). | JPA Entity |
| `ContentGenerationLogRepository` | Spring Data JPA repository for `ContentGenerationLog`. | JPA Repository |
| `ContentDtos` | Immutable records: `ContentResponseDto`, `CaptionsDto`, `PlatformContentDto`, `MarketHeaderDto`. | DTO Record Class |
| `AIInferenceGatewayService` | WebClient bridge — `generateCaption(payload)` → `POST /internal/generation/caption` (to `fastapi-sbert`). | Spring Service |
| `Module3ErrorCodes` | Constants for structured error codes (`MOD31_CONTENT_*`, `MOD3_CONTENT_GATEWAY_*`). | Utility Class |

### Backend Components — FastAPI (`fastapi-sbert`, port 8000)

| Component Name | Description & Purpose | Type / Format |
|----------------|-----------------------|---------------|
| Caption Router | **`POST /internal/generation/caption`** — the live path called by Spring Boot. Accepts `CaptionInputClass`, runs `caption_generation_service`, then `_transform_captions()` + `get_platform_guides()`. (`app/routers/caption_generation.py`) | FastAPI Router |
| Content Router (alternate) | `POST /internal/content/generate` — equivalent endpoint accepting `ContentGenerateRequest`; performs cultural research + forecast formatting itself. Not used by the current Spring path. (`app/routers/content.py`) | FastAPI Router |
| `caption_generation_service` | Invokes the LangGraph agent; raises `MOD31_CAPTION_AGENT_FAILED` on failure (no silent fallback at this layer). | Python Service |
| Caption Generation Agent | LangGraph `StateGraph(SocialAgentState)`: **Node 1** `analyze_services` → **Node 2** `generate_platform_captions` (3 archetypes × 3 platforms, 6-field schema) → `END`. (`app/agents/creative_director_agent/`) | LangGraph Agent |
| `SocialAgentState` | State carrying business context, `forecast_context`, `research_context`, `final_captions`, `source`. | Python Agent State Class |
| Agent Prompt | Encodes the 4 cultural factors, 3 archetypes, and platform mechanics. (`app/agents/creative_director_agent/prompts.py`) | Python Prompt Module |
| `cultural_research.research_market()` | FR3.3 — live SerpAPI query with curated `_MARKET_TEMPLATES` fallback. | Python Service |
| `gemini_client.get_platform_guides()` | Per-market, per-platform visual composition tips; also supplies hardcoded Naver content. | Python Service |
| `AgentLLMModel` | Thread-safe `ChatGroq` singleton (`llama-3.3-70b-versatile`), shared across Module 3 agents. | Python Singleton |
| `CaptionInputClass` | Request model for the caption agent. | Pydantic Schema |

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
| POST | `/api/content/generate` | Generate captions; optional `?profileId={UUID}` enriches from DB and persists rows |
| POST | `/api/content/approve` | Approve content for a profile + market; body `{ market }`; returns `{ approvedIds, market, count }` |

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
