# Submodule 3.3 — Compliance Audit (OMCS)

Evaluates operator-written captions against the AI-generated creative brief using the **Overall Multimodal Compliance Score (OMCS)** — a weighted composite of three sub-scores. Context is enriched from Submodules 3.1 and 3.2 when available; if no approved content exists, the pipeline falls back to a basic Groq single-score audit.

> **OMCS = (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)**

## Diagrams

| Diagram | File | Description |
|---------|------|-------------|
| Class | [class.puml](class.puml) | Frontend components, Spring Boot layers, FastAPI scoring services, and DTOs |
| Sequence | [sequence.puml](sequence.puml) | Full pipeline: context retrieval → CAS + VAS + HCS → persist → display |
| Entity-Relationship | [er.puml](er.puml) | `tbl_compliance_evaluation_result` and `tbl_compliance_revision_history` |

## Use Cases

| ID | Flow | Actor |
|----|------|-------|
| UC3.5 | Upload media + submit caption for OMCS audit | Operator |
| UC3.6 | Resubmit revised caption (revision tracking) | Operator |
| AF3.3 | FastAPI 5xx / timeout → automatic re-route to basic audit | System |

## OMCS Sub-Scores

| Score | Weight | Method | Range |
|-------|--------|--------|-------|
| **CAS** — Caption Alignment Score | 35% | SBERT `intfloat/multilingual-e5-base` cosine similarity vs approved 3.1 captions | 0 – 100 |
| **VAS** — Visual Alignment Score | 45% | Groq multimodal evaluation across 5 criteria | 0 – 100 |
| **HCS** — Heuristic Compliance Score | 20% | Deterministic 6-rule checker (always succeeds, no external dependencies) | 0 – 100 |

## OMCS Thresholds

| Score Range | Label | Badge |
|-------------|-------|-------|
| 90 – 100 | Excellent Alignment | ✦ green |
| 80 – 89 | High Compliance | ✓ blue |
| 70 – 79 | Moderate Revision Required | ⚠ gold |
| < 70 | Significant Revision Required | ✕ red-orange |

## HCS Rules (FR3.25.3)

| Rule | Max Pts | Logic |
|------|---------|-------|
| 1 — Tourism Category Alignment | 20 | Count overlap between caption tokens and 45 tourism terms + business category words; ≥3 hits = 20, ≥1 = 12, 0 = 0 |
| 2 — Target-Market Cultural Consistency | 20 | Count native-language keywords per market (Korean: 힐링, 호캉스…); ≥2 = 20, =1 = 12, market name in caption = 6, 0 = 0 |
| 3 — Seasonal Appropriateness | 20 | Penalize non-tropical terms (snow, blizzard…); 0 found = 20, 1 = 10, 2+ = 0 |
| 4 — Promotional Tone Conformity | 15 | Has CTA pattern + positive term? Both = 15, one = 8, neither = 0 |
| 5 — Recommendation Adherence | 15 | Has hashtag + length 40–500 chars? Both = 15, one = 8, neither = 0 |
| 6 — Caption-Visual Consistency | 10 | Token overlap between caption and `visual_tone` from 3.2; ≥3 = 10, ≥1 = 6, 0 = 3 |

## Revision Tracking (FR3.28 – FR3.29)

Each resubmission increments `revision_number`. When `revision_number > 1`, a `tbl_compliance_revision_history` row is also written with the previous evaluation ID as a foreign key, enabling full resubmission lineage tracking.

## Components

### Frontend
| Component | File | Responsibility |
|-----------|------|---------------|
| ContentStudioView | `ceview/components/module-3/3.1-content-studio/ContentStudioView.tsx` | Manages `auditOn`, `auditRunning`, `auditDone`, `compliance` state |
| SmartOptimizationBoard | `SmartOptimizationBoard.tsx` | Toggle, 6-step progress bar, results display |
| MediaCaptionManager | `MediaCaptionManager.tsx` | Media upload + caption editing before audit |
| MediaDropzone | `MediaDropzone.tsx` | Drag-and-drop image file input |
| ComplianceGauge | `ComplianceGauge.tsx` | Circular OMCS gauge (0 – 100) |
| FeedbackList | `FeedbackList.tsx` | Two-column "What Works / What Needs Improvement" |

### Backend — Spring Boot
| Class | Responsibility |
|-------|---------------|
| `ComplianceController` | 4 endpoints (evaluate, evaluate-json, evaluate-full, evaluate-full-json) |
| `ComplianceAnalysisService` | Context retrieval, pipeline routing, revision tracking, persistence |
| `ComplianceEvaluationResult` | JPA entity → `tbl_compliance_evaluation_result` |
| `ComplianceRevisionHistory` | JPA entity → `tbl_compliance_revision_history` |
| `ComplianceEvaluationResultRepository` | JPA repository |
| `ComplianceRevisionHistoryRepository` | JPA repository |

### Backend — FastAPI (`fastapi-sbert`, port 8000)
| Component | File | Responsibility |
|-----------|------|---------------|
| ComplianceRouter | `app/routers/compliance.py` | Basic + full pipeline endpoints |
| SentenceBertScorer | `app/services/sentence_bert_scorer.py` | CAS (`compute_cas`) and HCS (`compute_hcs`) |
| GeminiClient | `app/services/gemini_client.py` | VAS via Groq multimodal evaluation |
| BertModel | `app/core/BertModel.py` | SBERT E5 singleton — shared with Module 1 |

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/compliance/evaluate` | Basic Groq audit (multipart) |
| POST | `/api/v1/compliance/evaluate-json` | Basic Groq audit (JSON) |
| POST | `/api/v1/compliance/evaluate-full` | Full CAS + VAS + HCS pipeline (multipart) |
| POST | `/api/v1/compliance/evaluate-full-json` | Full pipeline (JSON) — used by React |
