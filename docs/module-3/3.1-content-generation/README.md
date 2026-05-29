# Submodule 3.1 — Content Generation

Generates a 3-platform × 3-archetype matrix of market-localized social media captions using a LangGraph 2-node agent powered by Groq (`llama-3.3-70b-versatile`). The agent applies cultural research context (SerpAPI or curated market templates) to produce captions tuned for Korea, Japan, or USA traveler segments.

## Diagrams

| Diagram | File | Description |
|---------|------|-------------|
| Class | [class.puml](class.puml) | Frontend components, Spring Boot layers, FastAPI agent, and DTOs |
| Sequence | [sequence.puml](sequence.puml) | Full request lifecycle: generation + approval flows |
| Entity-Relationship | [er.puml](er.puml) | `tbl_localized_promotional_content` and `tbl_content_generation_log` |

## Use Cases

| ID | Flow | Actor |
|----|------|-------|
| UC3.1 | Generate captions for selected market | Operator |
| UC3.2 | Approve one caption per platform | Operator |

## Components

### Frontend
| Component | File | Responsibility |
|-----------|------|---------------|
| ContentStudioView | `ceview/components/module-3/3.1-content-studio/ContentStudioView.tsx` | Orchestrates all Module 3 state and sub-views |
| AIContentMatrixPanel | `AIContentMatrixPanel.tsx` | Renders platform tabs and 3 caption options per tab |
| CopywritingOptionCard | `CopywritingOptionCard.tsx` | Archetype card with approve / copy buttons and AI reasoning |
| PlatformTab | `PlatformTab.tsx` | Tab selector (Instagram / TikTok / Facebook) |

### Backend — Spring Boot
| Class | Responsibility |
|-------|---------------|
| `ContentController` | `POST /api/v1/content/generate` and `POST /api/v1/content/approve` |
| `ContentGenerationService` | Loads `BusinessProfile`, builds `ForecastContext` from Module 2, delegates to FastAPI |
| `ContentApprovalService` | Sets `approval_status = true`; provides `hasApprovedContent()` guard used by 3.2 |
| `LocalizedPromotionalContent` | JPA entity → `tbl_localized_promotional_content` (4 rows per call) |
| `LocalizedPromotionalContentRepository` | JPA repository |
| `ContentGenerationLog` | JPA entity → `tbl_content_generation_log` |

### Backend — FastAPI (`fastapi-sbert`, port 8000)
| Component | File | Responsibility |
|-----------|------|---------------|
| ContentRouter | `app/routers/content.py` | Receives `POST /internal/content/generate` from Spring Boot; validates the request schema, invokes the `CreativeDirectorAgent`, and returns the serialized `ContentResponseDto` |
| CreativeDirectorAgent | `app/agents/creative_director_agent/` | Executes a 2-node LangGraph `StateGraph`: **Node 1** (`analyze_services`) filters the business's services into relevant vs. supplementary; **Node 2** (`generate_platform_captions`) produces a 3-archetype × 3-platform caption matrix (Witty / Formal / Storytelling × Instagram / TikTok / Facebook) with per-caption metadata — Naver captions are hardcoded separately |
| CulturalResearchService | `app/services/cultural_research.py` | Supplies market-specific traveler context to the agent prompt: attempts a live SerpAPI query ("Cebu Philippines tourism {market} travelers 2024 trends"); on API failure or missing key, falls back to curated `_MARKET_TEMPLATES` covering language nuances, traveler behavior, and platform preferences for Korea, Japan, and USA |
| AgentLLMModel | `app/core/AgentLLMModel.py` | Thread-safe singleton that initializes and returns the `ChatGroq` client (`llama-3.3-70b-versatile`, temperature 0.7); handles delayed `GROQ_API_KEY` availability via self-healing re-initialization — shared across all Module 3 FastAPI agents |

## Caption Archetypes

| Archetype | Style |
|-----------|-------|
| Witty | Playful, emoji-rich, hooks with humor |
| Formal | Professional, measured, brand-safe |
| Storytelling | Narrative-driven, evocative, experiential |

## Caption Generation — 4 Cultural Factors

1. **Core business context** — services, UVP, uniqueness score
2. **Market cultural localization** — language nuance, traveler psychology per market
3. **Psychological elements** — emotional anchors, desire triggers
4. **Algorithmic platform architecture** — character limits, hashtag conventions, CTA patterns

## Platform Character Limits

| Platform | Limit |
|----------|-------|
| Instagram | 2,200 characters |
| TikTok | 2,200 characters |
| Facebook | 63,206 characters |
| Naver | Hardcoded (2 curated Korean blog post options — not LLM-generated) |

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/content/generate` | Generate captions; optional `?profileId={UUID}` enriches from DB |
| POST | `/api/v1/content/approve` | Approve content for a profile + market (fire-and-forget from frontend) |
