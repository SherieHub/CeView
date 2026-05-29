# Submodule 3.2 — Creative Direction

Generates market-specific visual direction (shot list, moodboard, palette, platform recommendations) using Groq via an OpenAI-compatible client. Requires approved 3.1 content — if no approved captions exist for the profile + market, the request is rejected with a 400 `missing_dependency` error (FR3.11 / A3 alternative flow).

## Diagrams

| Diagram | File | Description |
|---------|------|-------------|
| Class | [class.puml](class.puml) | Frontend components, Spring Boot layers, FastAPI client, and DTOs |
| Sequence | [sequence.puml](sequence.puml) | Full request lifecycle: dependency gate → generation → approval |
| Entity-Relationship | [er.puml](er.puml) | `tbl_creative_direction_output` and `tbl_creative_direction_log` |

## Use Cases

| ID | Flow | Actor |
|----|------|-------|
| UC3.3 | Generate visual direction (requires 3.1 approval) | Operator |
| UC3.4 | Approve creative direction output (unlocks enriched 3.3 pipeline) | Operator |
| A3 | Reject generate request — no approved 3.1 content | System |

## Components

### Frontend
| Component | File | Responsibility |
|-----------|------|---------------|
| ContentStudioView | `ceview/components/module-3/3.1-content-studio/ContentStudioView.tsx` | Triggers `api.generateCreative()` on operator action |
| VisualDirectionBoard | `VisualDirectionBoard.tsx` | Renders `platform.guide[]` visual composition tips per platform |
| DistributionPanel | `DistributionPanel.tsx` | Displays social channel cards (Instagram / TikTok / Facebook) |

### Backend — Spring Boot
| Class | Responsibility |
|-------|---------------|
| `CreativeDirectionController` | `POST /api/v1/creative-direction/generate/{profileId}` and `approve/{profileId}` |
| `CreativeDirectionService` | Dependency gate check, context retrieval, FastAPI delegation, persistence |
| `CreativeApprovalService` | Sets `approval_status = true` on the latest creative direction output |
| `ContentApprovalService` | Provides `hasApprovedContent()` guard (dependency check from 3.1) |
| `CreativeDirectionOutput` | JPA entity → `tbl_creative_direction_output` |
| `CreativeDirectionOutputRepository` | JPA repository |
| `CreativeDirectionLog` | JPA entity → `tbl_creative_direction_log` |

### Backend — FastAPI (`fastapi-sbert`, port 8000)
| Component | File | Responsibility |
|-----------|------|---------------|
| CreativeRouter | `app/routers/creative.py` | `POST /internal/creative/generate` |
| GeminiClient | `app/services/gemini_client.py` | Groq OpenAI-compatible client for creative direction |
| AgentLLMModel | `app/core/AgentLLMModel.py` | Shared Groq singleton (also used by 3.1 agent) |

## Platform Priority Mapping (FR3.16)

| Market | Primary | Secondary | Tertiary |
|--------|---------|-----------|---------|
| Korea | Naver Blog | Instagram | TikTok |
| Japan | Facebook | Instagram | TikTok |
| USA | Instagram Reels | TikTok | — |

## Output Structure

| Field | Description |
|-------|-------------|
| `visualGuide[]` | Platform-specific composition and framing tips |
| `shots[]` | Shot list entries — `{label, description, lighting}` |
| `moodboard` | `{palette: string[], references: string[]}` |
| `platformRecommendations` | Map of `platform → recommendation string` |

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/creative-direction/generate/{profileId}` | Generate visual direction; optional `?market={market}` |
| POST | `/api/v1/creative-direction/approve/{profileId}` | Approve the latest creative direction output |
