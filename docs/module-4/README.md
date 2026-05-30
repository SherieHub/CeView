# Module 4 — Campaign Analytics & Reporting

Module 4 accepts raw campaign data directly from the operator, computes five marketing KPIs and a four-stage funnel, runs the Promotional Effectiveness Score (PES) formula, and generates an AI prescriptive report that diagnoses every funnel bottleneck with urgency-ranked, 1-to-1 recommendations. It is reached via the `'reports'` sidebar tab and lives in `ceview/components/module-4/4.1-campaign-analytics/`.

The module is split into three **functional** submodules. Each submodule has its own README organized by **Frontend (React) / Spring Boot / FastAPI** layers, plus matching PlantUML diagrams (`class.puml`, `sequence.puml`, `er.puml`).

| Submodule | Name | What it does |
|---|---|---|
| **4.1** | [Campaign Engagement Metrics](module-4.1/README.md) | Validated 7-field data ingestion; computes 5 KPIs + 4-stage funnel on Spring Boot; persists to `tbl_campaign_records`; serves demo metrics + weekly history. |
| **4.2** | [PES Computation](module-4.2/README.md) | Min-Max normalization (Cebu MSME ₱ bounds) + weighted-sum PES on FastAPI, with a Spring Boot FR4.26 rule-based fallback. |
| **4.3** | [AI Prescriptive Report](module-4.3/README.md) | Groq prescriptive report (urgency-ranked funnel diagnostics) + LangGraph quality-gated PES deep-analysis agent. |
| **Module-wide docs** | [System Documentation](MODULE4_SYSTEM_DOCUMENTATION.md) | Full cross-submodule architecture, request lifecycles, and the PES engine. |

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript (Vite) — `CampaignAnalyticsView.tsx`; client `ceview/services/apiClient.ts`, types `ceview/types.ts` |
| Backend API | Spring Boot 3 / Java 21 — `com/ceview/module4/{engagement,pes,report,dto}` |
| PES Computation (4.2) | FastAPI `pes_compute_service.py` (pure Python) + Groq insights via `gemini_client.py` |
| Prescriptive Report (4.3) | Groq `llama-3.3-70b-versatile` via `gemini_client.performance_report()` |
| PES Deep-Analysis Agent (4.3) | LangGraph quality-gated `pes_report_agent` (3-node StateGraph, `AgentLLMModel` singleton) |
| Internal Bridge | FastAPI (`fastapi-sbert`, port 8000) — same container as Modules 1 & 3 |
| Database | PostgreSQL 16 — `tbl_campaign_records` (`V14` schema, `V15` seed data) |

## REST Endpoints — Spring Boot (`/api/v1/analytics`)

| Submodule | Method | Path | Description |
|-----------|--------|------|-------------|
| 4.1 | GET | `/metrics?weeks=4\|8` | Default demo campaign metrics |
| 4.1 | POST | `/manual` | Full pipeline: KPI compute + persist + FastAPI PES (FR4.26 fallback) |
| 4.1 | GET | `/history?weeks=4\|8` | Last N campaign records in chronological order |
| 4.2 | GET | `/pes/{campaignId}?weeks=4\|8` | Spring Boot rule-based PES (no FastAPI call) |
| 4.3 | POST | `/report` | Groq prescriptive report (funnel diagnostics + recommendations) |
| 4.3 | POST | `/pes-analysis` | LangGraph PES deep-analysis agent (backend-only; no UI trigger yet) |
| 4.3 | GET | `/report/{id}/pdf` | Binary PDF of a generated report (backend-only; no UI trigger yet) |

## FastAPI Internal Endpoints (`fastapi-sbert`, consumed by Spring Boot only)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/internal/pes-compute/analyze` | Base metrics → normalize → recalibrate → weighted-sum PES → Groq insights |
| POST | `/internal/report/generate` | Groq prescriptive report from pre-ranked funnel transitions |
| POST | `/internal/pes-analysis/generate` | LangGraph `pes_report_agent` (quality-gated, up to 3 retries) |
| POST | `/internal/report/pdf` | Render the prescriptive report as a binary PDF |

## Database Tables

| Table | Submodule | Purpose |
|-------|-----------|---------|
| `tbl_campaign_records` | 4.1 / 4.2 | Operator-submitted campaign ingestion; three-stage write lifecycle: raw inputs → derived KPIs → PES score/label |

Schema migration: `V14__module4_campaign_records.sql` (table + indexes); seed data: `V15__module4_campaign_seed_data.sql` (10-week Cebu MSME progression, Mar–May 2026).

See [`MODULE4_SYSTEM_DOCUMENTATION.md`](MODULE4_SYSTEM_DOCUMENTATION.md) for the complete system reference.
