# Submodule 3.2 — Creative Direction and Visual Recommendation Generation (Transaction)

Generates market-specific **visual direction** (visual guide, shot list, lighting, moodboard, palette, and platform recommendations) from the approved 3.1 captions, using Groq via the OpenAI-compatible `gemini_client`. Output persists to PostgreSQL and has its own **approval gate**.

> **Dependency gate (FR3.11 / A3):** requires approved 3.1 content. If no approved captions exist for the profile + market, `CreativeDirectionService` throws `missing_dependency` and the API returns **HTTP 400**. The check is `ContentApprovalService.hasApprovedContent(profileId, market)`.

## Diagrams

| Diagram | File | Description |
|---------|------|-------------|
| Class | [class.puml](class.puml) | Frontend components, Spring Boot layers, FastAPI client, and DTOs across the full stack |
| Sequence | [sequence.puml](sequence.puml) | Request lifecycle: dependency gate → context retrieval → generation → approval |
| Entity-Relationship | [er.puml](er.puml) | `tbl_creative_direction_output` and `tbl_creative_direction_log`, plus the `tbl_localized_promotional_content` dependency |

## Use Cases

| ID | Flow | Actor |
|----|------|-------|
| UC3.3 | Generate visual direction (requires 3.1 approval) | Operator |
| UC3.4 | Approve the latest creative direction output | Operator |
| A3 | Reject generate — no approved 3.1 content → HTTP 400 `missing_dependency` | System |
| A4 | Groq unavailable → curated per-market template (`source = "fallback"`) | System |

## Components

### Frontend — React 18 + TypeScript (`ceview/`)

| Component | File | Responsibility |
|-----------|------|---------------|
| `ContentStudioView` | `components/module-3/3.1-content-studio/ContentStudioView.tsx` | Calls `api.generateCreative()` / `api.approveCreative()`; holds creative-direction state |
| `VisualDirectionBoard` | `components/module-3/3.1-content-studio/components/VisualDirectionBoard.tsx` | Renders the `guide[]` / `visualGuide[]` staging blueprint per platform |
| `BlueprintStepItem` | `components/module-3/3.1-content-studio/components/BlueprintStepItem.tsx` | Single numbered visual-direction step |

**Frontend service & types**

| Symbol | File | Notes |
|--------|------|-------|
| `api.generateCreative(profileId, market?)` | `services/apiClient.ts` | `POST /api/v1/creative-direction/generate/{profileId}` |
| `api.approveCreative(profileId, market)` | `services/apiClient.ts` | `POST /api/v1/creative-direction/approve/{profileId}` |
| `CreativeDirectionDTO` | `types.ts` | `{ visualGuide[], shots[], moodboard }` |

> **UI status note:** `visualGuide[]` is rendered today; the `shots[]` shot list and `moodboard` palette are returned by the backend but not yet visualized in the UI.

### Backend — Spring Boot 3 / Java 21 (`backend/spring-boot/`)

| Class | Package | Responsibility |
|-------|---------|---------------|
| `CreativeDirectionController` | `com.ceview.module3` | `POST /api/v1/creative-direction/generate/{profileId}` and `approve/{profileId}` |
| `CreativeDirectionService` | `com.ceview.module3.submodule32` | Dependency-gate check, context retrieval, FastAPI delegation via `generateCreative()`, transform + persist |
| `CreativeApprovalService` | `com.ceview.module3.submodule32` | `approveLatest(profileId, market)` — sets `approval_status = true` on the latest output |
| `ContentApprovalService` | `com.ceview.module3.submodule31` | Provides `hasApprovedContent()` / `getApprovedCaptions()` (the 3.1 dependency) |
| `CreativeDirectionOutput` | `com.ceview.module3.submodule32` | JPA entity → `tbl_creative_direction_output` (1 row per profile + market) |
| `CreativeDirectionOutputRepository` | `com.ceview.module3.submodule32` | JPA repository (`findTopBy...OrderByGeneratedAtDesc`) |
| `CreativeDirectionLog` | `com.ceview.module3.submodule32` | JPA entity → `tbl_creative_direction_log` (audit trail) |
| `CreativeDirectionLogRepository` | `com.ceview.module3.submodule32` | JPA repository |
| `CreativeDirectionDtos` | `com.ceview.module3.dto` | `CreativeDirectionDto`, `ShotDto`, `MoodboardDto` |
| `AIInferenceGatewayService` | `com.ceview.ai` | `generateCreative(payload)` → `POST /internal/creative/generate` |
| `Module3ErrorCodes` | `com.ceview.module3` | `MOD32_CREATIVE_*`, `MOD3_CREATIVE_GATEWAY_*` |

### Backend — FastAPI (`backend/fastapi-sbert`, port 8000)

| Component | File | Responsibility |
|-----------|------|---------------|
| Creative router | `app/routers/creative.py` | `POST /internal/creative/generate` — accepts `CreativeGenerateRequest`, returns `CreativeDirectionResponse` |
| `gemini_client.generate_creative_direction()` | `app/services/gemini_client.py` | Groq (OpenAI-compatible) call; produces `visualGuide`, `shots`, `moodboard`, `platformRecommendations`; falls back to curated per-market templates |
| `AgentLLMModel` | `app/core/AgentLLMModel.py` | Shared `ChatGroq` singleton (also used by the 3.1 agent) |

**Pydantic schemas** (`app/routers/creative.py`): `CreativeGenerateRequest`, `ShotItem`, `MoodboardItem`, `CreativeDirectionResponse`.

## Platform Priority Mapping (FR3.16)

| Market | Primary | Secondary | Tertiary |
|--------|---------|-----------|----------|
| Korea | Naver Blog | Instagram | TikTok |
| Japan | Facebook | Instagram | TikTok |
| USA | Instagram Reels | TikTok | — |

## Output Structure

| Field | Description |
|-------|-------------|
| `visualGuide[]` | Platform-specific composition and framing tips |
| `shots[]` | Shot list entries — `{ label, description, lighting }` |
| `moodboard` | `{ palette, references[] }` |
| `platformRecommendations` | Map of `platform → recommendation string` (FastAPI response only — not surfaced by the Spring `CreativeDirectionDto`) |
| `source` | `"groq"` (LLM) or `"fallback"` (curated template) — FastAPI response only |

> The Spring `CreativeDirectionDto` returned to the frontend carries only `visualGuide`, `shots`, and `moodboard`; `platformRecommendations` and `source` exist on the FastAPI `CreativeDirectionResponse`.

## REST Endpoints — Spring Boot

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/creative-direction/generate/{profileId}` | Generate visual direction; optional `?market={market}` (requires approved 3.1 content) |
| POST | `/api/v1/creative-direction/approve/{profileId}` | Approve the latest creative direction output; `?market={market}` |

## FastAPI Internal Endpoint

| Method | Path | Router | Description |
|--------|------|--------|-------------|
| POST | `/internal/creative/generate` | `creative.py` | Groq visual direction generation with curated fallback |

## Database

| Table | Purpose |
|-------|---------|
| `tbl_creative_direction_output` | Visual direction output — 1 row per profile + market (JSON-serialized arrays in TEXT columns) |
| `tbl_creative_direction_log` | Audit trail — one row per generation attempt |

Migration: `V5__module3_content_creative_columns.sql`.
