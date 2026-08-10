# Module 4 — Campaign Analytics & Reporting

Accepts raw campaign data from the operator, computes five marketing KPIs and a four-stage funnel,
runs the Promotional Effectiveness Score (PES) formula, and generates an AI prescriptive report that
diagnoses every funnel bottleneck with urgency-ranked recommendations.

## Screens

| Screen | Route | Doc |
|---|---|---|
| Performance | `/performance` | [`screens/performance.md`](screens/performance.md) |

| Component | Doc |
|---|---|
| `PostAnalyticsModal` | [`screens/_components/post-analytics-modal.md`](screens/_components/post-analytics-modal.md) |

## Backend

| Component | Doc |
|---|---|
| Post-level metrics (specified, not implemented) | [`backend/post-metrics.md`](backend/post-metrics.md) |

Existing, unchanged backend for KPI computation (4.1), PES scoring (4.2), and the AI prescriptive
report (4.3) is documented in full in
[`MODULE4_SYSTEM_DOCUMENTATION.md`](MODULE4_SYSTEM_DOCUMENTATION.md) and the submodule folders below.

| Submodule | Endpoint | Scope |
|---|---|---|
| [`module-4.1/`](module-4.1/) | `POST /api/v1/analytics/manual` | KPI + funnel ingestion |
| [`module-4.2/`](module-4.2/) | `GET /api/v1/analytics/pes/{campaignId}` | PES computation |
| [`module-4.3/`](module-4.3/) | `POST /api/v1/analytics/report` | AI prescriptive report |

## Changed in the UI/UX overhaul

Source of truth: [`ui-ux-prototype.html`](../../ui-ux-prototype.html). Full rationale and card-by-card
build plan: [`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md)
(Performance cards: [`05-module-4.md`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md)).

- `CampaignAnalyticsView.tsx` gains an explicit entry state (ingestion form only, before any campaign
  is submitted) and a flagged-metric banner for divide-by-zero KPIs — both re-skinned from the
  prototype, not new logic.
- New: a "Previously published" post list with per-post analytics, requiring the
  [`PostMetric`](backend/post-metrics.md) entity and endpoints that don't exist yet — this is the one
  genuinely new backend surface Module 4 needs from this overhaul.
