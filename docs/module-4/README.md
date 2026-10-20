# Module 4 — Campaign Analytics & Reporting

Accepts raw campaign data from the operator, computes five marketing KPIs and a four-stage funnel,
runs the Promotional Effectiveness Score (PES) formula, and generates an AI prescriptive report that
diagnoses every funnel bottleneck with urgency-ranked recommendations.

## Screens

| Screen | Route | Doc |
|---|---|---|
| Performance | `/performance` | [`screens/performance.md`](screens/performance.md) |
| Performance — link-attributed evidence panel | `/performance` | [`screens/link-attribution.md`](screens/link-attribution.md) |

| Component | Doc |
|---|---|
| `PostAnalyticsModal` | [`screens/_components/post-analytics-modal.md`](screens/_components/post-analytics-modal.md) |

## Backend

| Component | Doc |
|---|---|
| Post-level metrics (daily sync and owned read endpoints) | [`backend/post-metrics.md`](backend/post-metrics.md) |

Existing, unchanged backend for KPI computation (4.1), PES scoring (4.2), and the AI prescriptive
report (4.3) is documented in full in
[`MODULE4_SYSTEM_DOCUMENTATION.md`](MODULE4_SYSTEM_DOCUMENTATION.md) and the submodule folders below.

| Submodule | Endpoint | Scope |
|---|---|---|
| [`module-4.1/`](module-4.1/) | `POST /api/analytics/manual` | KPI + funnel ingestion |
| [`module-4.2/`](module-4.2/) | `GET /api/analytics/pes/{campaignId}` | PES computation |
| [`module-4.3/`](module-4.3/) | `POST /api/analytics/report` | AI prescriptive report |

## Changed in the UI/UX overhaul

Source of truth: [`ui-ux-prototype.html`](../../ui-ux-prototype.html). Full rationale and card-by-card
build plan: [`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/00-index.md)
(Performance cards: [`05-module-4.md`](../superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md)).

- `CampaignAnalyticsView.tsx` gains an explicit entry state (the ingestion form, before any campaign
  is submitted — plus the attribution evidence panels, see [Link attribution](#link-attribution)) and a flagged-metric banner for divide-by-zero KPIs — both re-skinned from the
  prototype, not new logic.
- New: a "Previously published" post list with per-post analytics, requiring the
  [`PostMetric`](backend/post-metrics.md) entity and endpoints that don't exist yet — this is the one
  genuinely new backend surface Module 4 needs from this overhaul.

## Ad platform connections (Meta Ads, TikTok Ads)

Operators can OAuth-connect their Meta Ads and/or TikTok Ads account from Settings → Platforms and
pull that period's account-level metrics (impressions, clicks, spend, conversions) straight into
the [`IngestionForm`](../../frontend/components/module-4/4.1-campaign-analytics/IngestionForm.tsx)
via a "Sync from ad accounts" button. Revenue, bookings, and new customers stay operator-entered —
the ad platforms don't know them. Account-level insight sync remains a reporting feature.
Meta now shares its upgraded grant with [social publishing](../module-3/backend/PlatformConnectionController.md),
while TikTok Ads and creator publishing use separate apps. Original reporting design:
[`docs/superpowers/specs/2026-09-06-ad-platform-connections-design.md`](../superpowers/specs/2026-09-06-ad-platform-connections-design.md).
Developer setup: [`AD_PLATFORM_SETUP.md`](../../AD_PLATFORM_SETUP.md).

## Link attribution

Each campaign window gets a tracked link. When a traveller clicks it, CeView records the click and
the ad creative it came from. Performance then shows clicks, conversions and revenue per creative,
with a separate Organic / untagged row for clicks that carried no creative ID. The panel sits beside
the code-redemption and statistical-lift panels and is labelled as a different kind of evidence:
clicks are machine-observed, while redemption codes are reported by the operator.

It is not the same mechanism as the ad connections above. **Ad connections read metrics the platform
already has; link attribution records an enquiry or matched booking the platform never knew about.**
It also complements, and never replaces, the promo-code path in the
[marketing attribution design](../superpowers/specs/2026-09-14-marketing-attribution-design.md).
Codes are the only thing that reaches Messenger, phone and walk-in bookings, which a tracked link
cannot see.

It does not send conversions back to the ad platforms, does not instrument external booking pages,
and does not treat an enquiry as confirmed revenue. An enquiry counts as one conversion with ₱0
revenue. Counts are a floor, not a census: in-app browsers and tracking prevention can strip the
tracking parameters.

Design: [`docs/superpowers/specs/2026-09-20-link-attribution-design.md`](../superpowers/specs/2026-09-20-link-attribution-design.md).
Screen: [`screens/link-attribution.md`](screens/link-attribution.md).
Developer setup: [`LINK_ATTRIBUTION_SETUP.md`](../../LINK_ATTRIBUTION_SETUP.md) (owned by Track 3,
not yet in the repository).
