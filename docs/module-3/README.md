# Module 3 — Content Studio

Content Studio is a sequential, three-transaction pipeline that generates, visually directs, and audits market-localized social media content for Cebu tourism businesses. Each submodule gates the next via an approval flag — 3.1 must be approved before 3.2 can run, and 3.2 must be approved before 3.3 can run the enriched OMCS pipeline.

## Sequential Dependency

| Step | Submodule | Transaction | Approval Gate |
|------|-----------|-------------|---------------|
| 1 | [3.1 Content Generation](3.1-content-generation/README.md) | Generate 3-platform × 3-archetype captions via LangGraph | `approval_status = true` on localized content |
| 2 | [3.2 Creative Direction](3.2-creative-direction/README.md) | Generate visual shot list, moodboard, and palette via Groq | `approval_status = true` on creative direction |
| 3 | [3.3 Compliance Audit](3.3-compliance-audit/README.md) | Compute OMCS score (CAS + VAS + HCS) | — (terminal transaction) |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (Vite) — `ContentStudioView.tsx` |
| Backend API | Spring Boot 3 / Java 21 |
| AI Agent (3.1) | LangGraph + Groq `llama-3.3-70b-versatile` (2-node StateGraph) |
| Visual Direction (3.2) | Groq via OpenAI-compatible client (`gemini_client.py`) |
| Compliance Scoring (3.3) | SBERT `intfloat/multilingual-e5-base` (CAS) · Groq (VAS) · Deterministic rules (HCS) |
| Internal Bridge | FastAPI (`fastapi-sbert`, port 8000) — same container as Module 1 |
| Database | PostgreSQL 16 |

## REST Endpoints — Spring Boot

| Submodule | Method | Path | Description |
|-----------|--------|------|-------------|
| 3.1 | POST | `/api/v1/content/generate` | Generate captions via LangGraph agent |
| 3.1 | POST | `/api/v1/content/approve` | Approve generated content (unlocks 3.2) |
| 3.2 | POST | `/api/v1/creative-direction/generate/{profileId}` | Generate visual direction (requires 3.1 approval) |
| 3.2 | POST | `/api/v1/creative-direction/approve/{profileId}` | Approve creative direction output |
| 3.3 | POST | `/api/v1/compliance/evaluate` | Basic Groq compliance audit (multipart) |
| 3.3 | POST | `/api/v1/compliance/evaluate-json` | Basic compliance audit (JSON only) |
| 3.3 | POST | `/api/v1/compliance/evaluate-full` | Full CAS + VAS + HCS pipeline (multipart) |
| 3.3 | POST | `/api/v1/compliance/evaluate-full-json` | Full pipeline (JSON only, used by React) |

## FastAPI Internal Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/content/generate` | LangGraph 2-node caption generation agent |
| POST | `/internal/creative/generate` | Groq visual direction generation |
| POST | `/internal/compliance/evaluate` | Basic single-score Groq audit |
| POST | `/internal/compliance/evaluate-full` | Full CAS + VAS + HCS → OMCS pipeline |

## Database Tables

| Table | Submodule | Purpose |
|-------|-----------|---------|
| `tbl_localized_promotional_content` | 3.1 | Generated captions — 4 rows per generation call (instagram / tiktok / facebook / naver) |
| `tbl_content_generation_log` | 3.1 | Audit trail for each generation attempt |
| `tbl_creative_direction_output` | 3.2 | Visual direction output — 1 row per profile + market |
| `tbl_creative_direction_log` | 3.2 | Audit trail for each creative direction attempt |
| `tbl_compliance_evaluation_result` | 3.3 | OMCS scores, sub-scores, and explainability (1 row per submission) |
| `tbl_compliance_revision_history` | 3.3 | Resubmission lineage — created when `revision_number > 1` |

Schema migrations: `V5__module3_content_creative_columns.sql` · `V6__module33_compliance_scoring.sql` · `V9__module3_hcs_score_column.sql`

See [`MODULE3_SYSTEM_DOCUMENTATION.md`](MODULE3_SYSTEM_DOCUMENTATION.md) for the complete system reference.
