# Module 3 — Content Studio

Content Studio is a sequential, **two-transaction** pipeline that generates and then visually directs market-localized social media content for Cebu tourism businesses. Transaction 3.1 must be approved before 3.2 can run.

## Sequential Dependency

| Step | Submodule | Transaction | Approval Gate |
|------|-----------|-------------|---------------|
| 1 | [3.1 Market-Localized Promotional Content Generation](3.1-content-generation/README.md) | Generate 3-platform × 3-archetype captions via LangGraph | `approval_status = true` on localized content |
| 2 | [3.2 Creative Direction and Visual Recommendation Generation](3.2-creative-direction/README.md) | Generate visual shot list, moodboard, palette, and platform recommendations via Groq | `approval_status = true` on creative direction |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (Vite) — `ContentStudioView.tsx` |
| Backend API | Spring Boot 3 / Java 21 |
| AI Agent (3.1) | LangGraph + Groq `llama-3.3-70b-versatile` (2-node StateGraph) |
| Visual Direction (3.2) | Groq via OpenAI-compatible client (`gemini_client.py`) |
| Internal Bridge | FastAPI (`fastapi-sbert`, port 8000) — same container as Module 1 |
| Database | PostgreSQL 16 |

## Diagrams

Module-level PlantUML diagrams covering both transactions end-to-end:

| Diagram | File | Scope |
|---------|------|-------|
| Class | [class.puml](class.puml) | Frontend, Spring Boot, and FastAPI components across 3.1 + 3.2 |
| Sequence | [sequence.puml](sequence.puml) | Full pipeline: 3.1 generate → approve → 3.2 generate → approve |
| Entity-Relationship | [er.puml](er.puml) | All Module 3 tables and their relationships |

Per-submodule diagrams live in each submodule folder (`class.puml`, `sequence.puml`, `er.puml`).

## REST Endpoints — Spring Boot

| Submodule | Method | Path | Description |
|-----------|--------|------|-------------|
| 3.1 | POST | `/api/v1/content/generate` | Generate captions via LangGraph agent |
| 3.1 | POST | `/api/v1/content/approve` | Approve generated content (unlocks 3.2) |
| 3.2 | POST | `/api/v1/creative-direction/generate/{profileId}` | Generate visual direction (requires 3.1 approval) |
| 3.2 | POST | `/api/v1/creative-direction/approve/{profileId}` | Approve creative direction output |

## FastAPI Internal Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/generation/caption` | LangGraph 2-node caption generation agent (live path) |
| POST | `/internal/content/generate` | Alternate caption endpoint (not used by the current Spring path) |
| POST | `/internal/creative/generate` | Groq visual direction generation |

## Database Tables

| Table | Submodule | Purpose |
|-------|-----------|---------|
| `tbl_localized_promotional_content` | 3.1 | Generated captions — 4 rows per generation call (instagram / tiktok / facebook / naver) |
| `tbl_content_generation_log` | 3.1 | Audit trail for each generation attempt |
| `tbl_creative_direction_output` | 3.2 | Visual direction output — 1 row per profile + market |
| `tbl_creative_direction_log` | 3.2 | Audit trail for each creative direction attempt |

Schema migration: `V5__module3_content_creative_columns.sql`.

See [`MODULE3_SYSTEM_DOCUMENTATION.md`](MODULE3_SYSTEM_DOCUMENTATION.md) for the complete system reference.
