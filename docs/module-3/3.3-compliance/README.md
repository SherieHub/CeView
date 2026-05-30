# Submodule 3.3 — OMCS Compliance Audit

Submodule 3.3 evaluates a staged caption + uploaded image against the business profile and the visual-guide recommendations produced by Submodule 3.2. It returns a composite **OMCS score** and a Pass/Fail verdict. The entire audit is **stateless** — no results are persisted to the database.

---

## Diagram Index

| Scope | Class Diagram | Sequence Diagram | ER Diagram |
|-------|--------------|-----------------|------------|
| [3.3 OMCS Compliance Audit](README.md) | [class.puml](class.puml) | [sequence.puml](sequence.puml) | [er.puml](er.puml) |

---

## Component Table

### Frontend — `ceview/components/module-3/3.1-content-studio/`

| Component Name (file) | Description & Purpose | Type / Format |
|----------------------|----------------------|---------------|
| `ContentStudioView.tsx` | Root view — owns audit state (`auditOn`, `auditRunning`, `omcs`, `stagedCaption`, `uploadedFile`, `imageDataUrl`); fires `runOmcsAudit()` | React view `.tsx` |
| `SmartOptimizationBoard.tsx` | Audit toggle, 6-step progress indicator, `ComplianceGauge` + rubric display | React component `.tsx` |
| `ComplianceGauge.tsx` | SVG circular gauge for OMCS score (green ≥80, gold ≥60, red <60) | React component `.tsx` |
| `MediaCaptionManager.tsx` | Container composing `CaptionTextArea` + `MediaDropzone`/`MediaPreviewCard` for audit input staging | React component `.tsx` |
| `MediaDropzone.tsx` | Drag-and-drop file upload; PNG/JPG/WEBP ≤20 MB; reads file as base64 data URL | React component `.tsx` |
| `MediaPreviewCard.tsx` | Image thumbnail preview with file size and removal button | React component `.tsx` |
| `CaptionTextArea.tsx` | Editable textarea for staging the caption before the audit | React component `.tsx` |
| `AuditEmptyBanner.tsx` | Warning banner blocking run until media is uploaded | React component `.tsx` |
| `apiClient.ts` (`analyzeOmcs`) | Calls `POST /api/v1/compliance/omcs-analyze`; returns `OmcsAuditResultDTO` | TypeScript service `.ts` |

### Backend — `backend/spring-boot/src/main/java/com/ceview/module3/`

| Component Name (file) | Description & Purpose | Type / Format |
|----------------------|----------------------|---------------|
| `ComplianceController.java` | Thin stateless REST controller: validates inputs, builds payload, delegates to `AIInferenceGatewayService` | `@RestController` `.java` |
| `dto/ComplianceDtos.java` | Records `OmcsAuditRequest` + `OmcsAuditResultDto` — 3.3 wire format | Java records `.java` |
| `AIInferenceGatewayService.java` (`analyzeOmcsAgent`) | HTTP gateway method routing to FastAPI `/internal/omcs/analyze` | `@Service` `.java` |

### FastAPI — `backend/fastapi/`

| Component Name (file) | Description & Purpose | Type / Format |
|----------------------|----------------------|---------------|
| `ComplianceRouter` | Endpoint `POST /internal/omcs/analyze`; runs LangGraph omcs_agent (CAS + VAS + HCS scoring) | FastAPI router |

---

## User Flow

1. **Enable audit**: Operator toggles `SmartOptimizationBoard` → `auditOn = true`.
2. **Stage caption**: `stagedCaption` auto-populates from the most recently approved caption card. Editable in `CaptionTextArea`.
3. **Upload media**: Drag-and-drop or browse a PNG/JPG/WEBP image (≤20 MB). The file is read as a base64 data URL. `AuditEmptyBanner` blocks the run button until media is present.
4. **Run audit**: Click "Run Audit" → `runOmcsAudit()` → `POST /api/v1/compliance/omcs-analyze`. A 6-step progress animation plays while in-flight.
5. **View score**: `ComplianceGauge` renders the OMCS score. Component scores and a 7-criterion rubric table are shown. If the audit fails, a `feedback` diagnostic explains the root cause and suggests corrections.
6. **Reset**: Click "Reset Audit" → `omcs = null`, `auditDone = false`, `auditOn = false`.

---

## Request Lifecycle

**Trigger**: `api.analyzeOmcs({ caption, imageUrl, businessProfile, recommendations })` → `POST /api/v1/compliance/omcs-analyze`.

1. `ComplianceController.omcsAnalyze()` validates that `caption` and `imageUrl` are non-blank (throws 400 otherwise).
2. Builds a snake_case payload: `{ caption, image_url, business_profile, recommendations }`.
3. Calls `AIInferenceGatewayService.analyzeOmcsAgent(payload)` → `POST /internal/omcs/analyze` to FastAPI (30 s timeout).
4. FastAPI runs the **LangGraph omcs_agent** (see Engine section).
5. `mapOmcsAgentResponse()` converts the snake_case FastAPI response to `OmcsAuditResultDto`.
6. Returns `OmcsAuditResultDto` as `200 OK`. **No rows are written to the database.**

**Error codes**: `MOD3_COMPLIANCE_VALIDATION` (400 — blank caption/imageUrl), `MOD3_COMPLIANCE_GATEWAY_TIMEOUT` (503), `MOD33_OMCS_AGENT_FAILED` (503 — FastAPI failure).

---

## OMCS Formula

```
OMCS = (0.35 × CAS) + (0.45 × VAS) + (0.20 × HCS)
```

| Score | Full Name | Weight | Source |
|-------|-----------|--------|--------|
| **CAS** | Content Alignment Score | 0.35 | `profileSemanticScore` — business-profile semantic alignment against caption |
| **VAS** | Visual Alignment Score | 0.45 | `recommendationsPictureScore` — image evaluated against 3.2 visual-guide recommendations (7-criterion rubric) |
| **HCS** | Heuristic Consistency Score | 0.20 | `pubmatConsistencyScore` — caption ↔ image semantic consistency |

**Pass threshold**: OMCS ≥ 70.

---

## Rubric Criteria (VAS — 7 items)

| Criterion | What is evaluated |
|-----------|------------------|
| Visual ↔ Business Context Match | Does the image reflect the business type and services? |
| Visual Intent Consistency | Does the image align with the visual guide's stated intent? |
| Tone ↔ Visual Mood | Does the visual mood match the caption's emotional tone? |
| Psychological Strategy Support | Does the image reinforce the psychological archetype (FOMO / exclusivity / escapism)? |
| Target Audience Fit | Is the image appropriate for the demographic archetype? |
| Platform Suitability | Does the image composition suit the selected platform's format and aspect ratio? |
| Attribute Coverage Consistency | Does the image reflect the core business attributes described in the caption? |

---

## Statelessness Note

Compliance tables (`tbl_compliance_evaluation_result`, `tbl_compliance_revision_history`) were created in V5/V6 and extended in V9. They were dropped in **V16** (`V16__drop_compliance_tables.sql`) when the compliance audit was reimplemented as a stateless LangGraph omcs_agent. All audit results live only in React state (`ContentStudioView.omcs`) and are discarded on page reload or reset.
