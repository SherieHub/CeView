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
and does not treat an enquiry as confirmed revenue until the operator says so. An enquiry starts as
one conversion with ₱0 revenue; the operator then marks it **Booked** (with the real bookings and
revenue) or **Declined** (which takes the booking back out) from the dashboard inbox. Counts are a
floor, not a census: in-app browsers and tracking prevention can strip the tracking parameters.

### Conversion path

1. An ad or post carries the tracked link `{CEVIEW_ATTRIBUTION_BASE_URL}/r/{slug}` (copied from
   Content Studio → Ad URL). That string is baked into live ads and must not change after go-live.
2. `GET /r/{slug}` records the click and redirects. The link either has the operator's own booking
   URL (the click id is appended as `cv`) or is **hosted**, in which case the traveller lands on
   CeView's form at `{FRONTEND_BASE_URL}/enquiry?cv=<clickId>`. A repeat click from the same address
   within a minute reuses the first click's id so the form still opens.
3. The traveller submits the form (no login). It stays open after the campaign window ends; those
   leads are tagged "After campaign window" and kept out of the per-creative rollup.
4. The enquiry is recorded as a `LINK` booking against the window's code and appears in the
   operator's inbox. Bookings taken on the operator's own site are not seen by CeView; the operator
   logs them with **Log a booking** and attaches the recorded click.
5. Both kinds feed Performance: the code-redemption evidence, the per-creative table and the booking
   provenance passed to the AI report.

Deployment needs two public origins set on the Spring Boot service: `CEVIEW_ATTRIBUTION_BASE_URL`
(this API) and `FRONTEND_BASE_URL` (the form). Startup logs a warning when either still points at
`localhost`. See [`DEPLOY_RENDER.md`](../DEPLOY_RENDER.md) for the smoke test.

Design: [`docs/superpowers/specs/2026-09-20-link-attribution-design.md`](../superpowers/specs/2026-09-20-link-attribution-design.md).
Screen: [`screens/link-attribution.md`](screens/link-attribution.md).
Developer setup: [`LINK_ATTRIBUTION_SETUP.md`](../../LINK_ATTRIBUTION_SETUP.md) (owned by Track 3,
not yet in the repository).

## Conversion capture — codes and logged bookings (CVW-42)

Every caption generated for a market with a live or upcoming surge window ends with a call to action
quoting that window's attribution code (e.g. `KR-DIVE-1019`), in the market's language. When a
customer quotes it, staff press **Log a booking** in the Performance screen's code-redemption panel
at the moment of the booking, and can attach it to a recorded ad click so the creative is known.
The panel splits each code's bookings by how they were captured (enquiry form, booking platform,
click-matched, code logged), and operator-logged rows can be removed if logged by mistake.

A code whose tracked bookings exceed what the operator reported for the same weeks is flagged in
the panel, and the weekly form shows the period's tracked bookings under its Bookings field, warning
(never blocking) when the typed total is lower. The same quick entry is on the dashboard
("Took a booking?"), since that is where staff land.

**Statistical lift** compares the operator's reported bookings and revenue per week during a code's
window with the 28 days before it. A baseline under four weeks is flagged; missing data is shown as
a status, never as an invented percentage.

The AI report receives the same split for its window (`bookingProvenance`) and is required to say
how much of the booking total is tracked versus self-reported, and to qualify its confidence.

Research, and why FareHarbor, POS and the operator survey are not yet built:
[`CONVERSION_CAPTURE_RESEARCH.md`](CONVERSION_CAPTURE_RESEARCH.md).
