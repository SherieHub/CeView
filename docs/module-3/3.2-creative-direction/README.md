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

### Frontend Components

| Component Name | Description & Purpose | Type / Format |
|----------------|-----------------------|---------------|
| `ContentStudioView` | Hosts the creative-direction workflow; calls `api.generateCreative()` / `api.approveCreative()` and holds creative-direction state. | React functional component |
| `VisualDirectionBoard` | Renders the `guide[]` / `visualGuide[]` staging blueprint per platform. | React board component |
| `BlueprintStepItem` | Displays a single numbered visual-direction step. | React item component |
| `api.generateCreative` | API client method — `POST /api/v1/creative-direction/generate/{profileId}`. | TypeScript API client method |
| `api.approveCreative` | API client method — `POST /api/v1/creative-direction/approve/{profileId}`. | TypeScript API client method |
| `CreativeDirectionDTO` | Response shape `{ visualGuide[], shots[], moodboard }` consumed by the board. | TypeScript interface |

> **UI status note:** `visualGuide[]` is rendered today; the `shots[]` shot list and `moodboard` palette are returned by the backend but not yet visualized in the UI.

### Backend Components — Spring Boot 3 / Java 21

| Component Name | Description & Purpose | Type / Format |
|----------------|-----------------------|---------------|
| `CreativeDirectionController` | Exposes `POST /api/v1/creative-direction/generate/{profileId}` and `approve/{profileId}`. | Spring REST Controller |
| `CreativeDirectionService` | Performs the dependency-gate check, context retrieval, FastAPI delegation via `generateCreative()`, transform + persist. | Spring Service |
| `CreativeApprovalService` | `approveLatest(profileId, market)` — sets `approval_status = true` on the latest output. | Spring Service |
| `ContentApprovalService` | Provides `hasApprovedContent()` / `getApprovedCaptions()` — the 3.1 dependency gate. | Spring Service |
| `CreativeDirectionOutput` | JPA entity mapping `tbl_creative_direction_output` (1 row per profile + market). | JPA Entity |
| `CreativeDirectionOutputRepository` | Spring Data JPA repository (`findTopBy...OrderByGeneratedAtDesc`). | JPA Repository |
| `CreativeDirectionLog` | JPA entity mapping `tbl_creative_direction_log` (audit trail). | JPA Entity |
| `CreativeDirectionLogRepository` | Spring Data JPA repository for `CreativeDirectionLog`. | JPA Repository |
| `CreativeDirectionDtos` | Immutable records: `CreativeDirectionDto`, `ShotDto`, `MoodboardDto`. | DTO Record Class |
| `AIInferenceGatewayService` | WebClient bridge — `generateCreative(payload)` → `POST /internal/creative/generate`. | Spring Service |
| `Module3ErrorCodes` | Constants for structured error codes (`MOD32_CREATIVE_*`, `MOD3_CREATIVE_GATEWAY_*`). | Utility Class |

### Backend Components — FastAPI (`fastapi-sbert`, port 8000)

| Component Name | Description & Purpose | Type / Format |
|----------------|-----------------------|---------------|
| Creative Router | `POST /internal/creative/generate` — accepts `CreativeGenerateRequest`, returns `CreativeDirectionResponse`. (`app/routers/creative.py`) | FastAPI Router |
| `gemini_client.generate_creative_direction()` | Groq (OpenAI-compatible) call; produces `visualGuide`, `shots`, `moodboard`, `platformRecommendations`; falls back to curated per-market templates. | Python Service |
| `AgentLLMModel` | Shared `ChatGroq` singleton (also used by the 3.1 agent). | Python Singleton |
| `CreativeGenerateRequest` | Request payload for creative direction generation. | Pydantic Schema |
| `CreativeDirectionResponse` | Response payload carrying `visualGuide`, `shots`, `moodboard`, `platformRecommendations`, `source`. | Pydantic Schema |
| `ShotItem` | Single shot-list entry (`label`, `description`, `lighting`). | Pydantic Schema |
| `MoodboardItem` | Moodboard entry (`palette`, `references`). | Pydantic Schema |

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
