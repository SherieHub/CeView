# Module 4 — Campaign Analytics & Reporting

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note). Any
DoD item below referencing a Playwright spec passing is deferred until `frontend/` is wired into
`e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen doc: [`docs/module-4/screens/performance.md`](../../../module-4/screens/performance.md).
Component doc: [`_components/post-analytics-modal.md`](../../../module-4/screens/_components/post-analytics-modal.md).
Spec file: `e2e/tests/performance.spec.ts` (M4-F, M4-1–M4-6).

**Component diagram:** [`diagrams/module-4.mmd`](diagrams/module-4.mmd)

**Parallelism:** M4-F is the only card every other Module 4 card depends on — M4-1 through M4-5 can
all be built simultaneously once M4-F merges, since each owns disjoint files and reads only
already-computed values from `campaignMetrics.ts`. M4-6 additionally depends on Module 3's
`Foundation — Shared Stores` for the post list it reads, but not on any Content Studio feature card.

---

### CARD — Foundation: Performance Shell & Ingestion

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** The `/performance` shell — the entry↔full-view transition, the 7-field ingestion form,
the submitted campaign state, the 4/8-week trend toggle, and the metrics/PES computation every other
card renders from.
**Prototype reference:** screen-performance / `renderPerformance()` + `submitCampaign()` +
`computeMetrics()` + `computePes()` — `ui-ux-prototype.html:3882–3910`, `:3796–3837`, `:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` — the `/performance` screen
  shell; owns the entry↔full-view transition, the submitted campaign input, and the 4/8-week trend
  toggle; composes 9 named slot components by fixed import path
- `components/module-4/4.1-campaign-analytics/IngestionForm.tsx` — the 7-field campaign-input form
- `components/module-4/4.1-campaign-analytics/campaignMetrics.ts` — `computeMetrics()` /
  `computePes()` and the flagged-denominator detection
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` — the 9 slot prop contracts
  (`KpiSlotProps`, `PesGaugeSlotProps`, `FunnelSlotProps`, `TrendSlotProps`, `ActionPlanSlotProps`,
  plus the two no-prop consumer components below)
- `components/module-4/4.1-campaign-analytics/KpiCard.tsx`, `FlaggedMetricBanner.tsx`,
  `PesGauge.tsx`, `CustomerJourneyFunnel.tsx`, `PesTrendChart.tsx`, `EfficiencyTrendChart.tsx`,
  `CostTrendChart.tsx`, `AiActionPlan.tsx`, `PreviouslyPublished.tsx`, `PostAnalyticsModal.tsx` —
  **stub placeholders only**; ownership of each transfers whole to one sibling card below

**Related files:**
- `services/fixtures/campaign.ts` (Foundation — Fixture Data Layer) — `DEFAULT_CAMPAIGN_INPUT`
  (pre-fills the form's placeholder values), `CampaignInput`, `MOCK_HISTORY`, `MOCK_REPORT` — the
  types and data this card fetches via `apiClient.campaign.history()` / `.report()` once a campaign
  is submitted

**Flow:** [`diagrams/cards/module-4/foundation-performance-shell.mmd`](diagrams/cards/module-4/foundation-performance-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/foundation-performance-shell.ts`](pseudocode/module-4/foundation-performance-shell.ts)

**Milestone (finished state):** `/performance` with no campaign submitted shows only the ingestion
form; submitting valid values transitions to the full view with all 9 slot placeholders visible, and
a zero-denominator input (e.g. `adSpend: 0`) still produces a `computePes()` value in `[0, 1]` with
the corresponding metric flagged — before any sibling fills in real content.

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` covers form validation, the submit→full-view transition, and
      the 4/8-week toggle re-slicing `MOCK_HISTORY`
- [ ] `campaignMetrics.test.ts` covers `computeMetrics()`'s flagged-denominator branch for each of the
      5 metrics and `computePes()`'s weighted-sum formula and label thresholds
- [ ] `performance.spec.ts` shell coverage — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CampaignAnalyticsView campaignMetrics
```

---

### CARD — Performance: KPI Cards & Flagged Metrics

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The five KPI cards and the zero-denominator warning banner.
**Prototype reference:** screen-performance / KPI card row — `ui-ux-prototype.html:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/KpiCard.tsx` — replaces the Foundation stub; one KPI
  card with a trend arrow
- `components/module-4/4.1-campaign-analytics/FlaggedMetricBanner.tsx` — replaces the Foundation
  stub; the zero-denominator warning

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `KpiSlotProps`, the contract this card implements; `metrics`/`flagged` arrive
  already computed by `campaignMetrics.ts`, this card only renders them

**Flow:** [`diagrams/cards/module-4/kpi-cards.mmd`](diagrams/cards/module-4/kpi-cards.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/kpi-cards.ts`](pseudocode/module-4/kpi-cards.ts)

**Milestone (finished state):** Submitting the ingestion form with a zero denominator (e.g.
`adSpend: 0`) shows the flagged banner naming the correct metric(s), and the corresponding KPI card
still renders a value (`0`) rather than `NaN`/`Infinity`.

**Definition of Done:**
- [ ] `KpiCard.test.tsx` / `FlaggedMetricBanner.test.tsx` cover the inverse-good trend-arrow branch
      and the flagged-vs-empty banner branch
- [ ] `performance.spec.ts` → "KPI Cards & Flagged Metrics" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- KpiCard FlaggedMetricBanner
```

---

### CARD — Performance: PES Gauge

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The PES radial gauge and its per-metric contribution breakdown.
**Prototype reference:** screen-performance / `computePes()` render — `ui-ux-prototype.html:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PesGauge.tsx` — replaces the Foundation stub; radial
  gauge + contribution bars

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `PesGaugeSlotProps`, the contract this card implements; `score`/`label` arrive
  already computed by `computePes()`, this card only renders them

**Flow:** [`diagrams/cards/module-4/pes-gauge.mmd`](diagrams/cards/module-4/pes-gauge.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/pes-gauge.ts`](pseudocode/module-4/pes-gauge.ts)

**Milestone (finished state):** The gauge always renders a value in `[0, 1]` with the matching label
band (Excellent/Good/Fair/Poor), and its contribution bars sum to the weights the shell's formula
uses (ROAS 35% / convRate 30% / CAC 15% / CTR 15% / CPC 5%).

**Definition of Done:**
- [ ] `PesGauge.test.tsx` covers all 4 label bands and the contribution-bar weights
- [ ] `performance.spec.ts` → "PES Gauge" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PesGauge
```

---

### CARD — Performance: Customer Journey Funnel

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The 4-stage customer journey funnel with per-stage drop-off.
**Prototype reference:** screen-performance / funnel section — `ui-ux-prototype.html:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/CustomerJourneyFunnel.tsx` — replaces the Foundation
  stub; the 4-stage funnel

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `FunnelSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-4/customer-journey-funnel.mmd`](diagrams/cards/module-4/customer-journey-funnel.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/customer-journey-funnel.ts`](pseudocode/module-4/customer-journey-funnel.ts)

**Milestone (finished state):** Each of the 3 drop-off transitions (Impressions→Clicks→Conversions→
Bookings) shows its percentage when the previous stage is non-zero, and renders nothing for that
transition when it is zero.

**Definition of Done:**
- [ ] `CustomerJourneyFunnel.test.tsx` covers the zero-previous-stage no-drop-off branch
- [ ] `performance.spec.ts` → "Customer Journey Funnel" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CustomerJourneyFunnel
```

---

### CARD — Performance: Trend Charts

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The PES/efficiency/cost trend charts sharing the shell's 4/8-week toggle.
**Prototype reference:** screen-performance / `renderPerformance()` (trend section) —
`ui-ux-prototype.html:3876–3879`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PesTrendChart.tsx` — replaces the Foundation stub;
  PES-over-time with the 4/8-week toggle control
- `components/module-4/4.1-campaign-analytics/EfficiencyTrendChart.tsx` — replaces the Foundation
  stub; ROAS/CTR/CR over time
- `components/module-4/4.1-campaign-analytics/CostTrendChart.tsx` — replaces the Foundation stub;
  CPC/CAC over time

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `TrendSlotProps`, the contract this card implements; the shell owns slicing
  `MOCK_HISTORY` to the current `weeks`, this card only owns the toggle control and rendering

**Flow:** [`diagrams/cards/module-4/trend-charts.mmd`](diagrams/cards/module-4/trend-charts.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/trend-charts.ts`](pseudocode/module-4/trend-charts.ts)

**Milestone (finished state):** Toggling 4↔8 weeks updates all three trend charts consistently, since
they all read the same `window` slice the shell recomputes.

**Definition of Done:**
- [ ] `PesTrendChart.test.tsx` / `EfficiencyTrendChart.test.tsx` / `CostTrendChart.test.tsx` cover
      rendering against a 4-week and an 8-week window
- [ ] `performance.spec.ts` → "Trend Charts" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PesTrendChart EfficiencyTrendChart CostTrendChart
```

---

### CARD — Performance: AI Action Plan

**Depends on:** Foundation — Performance Shell & Ingestion
**Summary:** The AI prescriptive report — executive summary, ranked diagnostics, recommendations.
**Prototype reference:** screen-performance / report section — data shape in
`services/fixtures/campaign.ts`'s `MOCK_REPORT`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/AiActionPlan.tsx` — replaces the Foundation stub;
  executive summary + ranked diagnostics + recommendations

**Related files:**
- `components/module-4/4.1-campaign-analytics/campaignTypes.ts` (Foundation — Performance Shell &
  Ingestion) — `ActionPlanSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-4/ai-action-plan.mmd`](diagrams/cards/module-4/ai-action-plan.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/ai-action-plan.ts`](pseudocode/module-4/ai-action-plan.ts)

**Milestone (finished state):** The 3 diagnostics render in Weakest→Moderate→Alright order exactly as
given in `report.funnelDiagnostics`, regardless of each stage's raw drop percentage.

**Definition of Done:**
- [ ] `AiActionPlan.test.tsx` covers diagnostics rendered in report order (not re-sorted by raw drop)
      and the diagnostic↔recommendation pairing
- [ ] `performance.spec.ts` → "AI Action Plan" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AiActionPlan
```

---

### CARD — Performance: Previously Published & Post Analytics Modal

**Depends on:** Foundation — Performance Shell & Ingestion, Module 3's Foundation — Shared Stores
**Summary:** Platform-filtered published-post list and the per-post analytics modal, reading the same
shared post store Content Studio's Publish Action writes to.
**Prototype reference:** screen-performance / `openPostAnalytics()` — `ui-ux-prototype.html:3843–3874`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PreviouslyPublished.tsx` — replaces the Foundation
  stub; filter tabs + published-post list
- `components/module-4/4.1-campaign-analytics/PostAnalyticsModal.tsx` — replaces the Foundation
  stub; per-post analytics detail

**Related files:**
- `services/postStore.ts` (Module 3's Foundation — Shared Stores) — `usePosts()`, the shared post
  list this section filters and reads per-post metrics from; this card is a read-only consumer and
  does not depend on any Content Studio feature card
- `components/shared/Modal.tsx` (Foundation — Shell & Routing) — the overlay primitive
  `PostAnalyticsModal` is built on
- `styles/index.css` (Foundation — Design System) — this card uses Recharts for its chart, not the
  prototype's hand-rolled SVG `miniLine()` helper, per the Design System card's decision to keep
  Recharts

**Flow:** [`diagrams/cards/module-4/previously-published-post-analytics-modal.mmd`](diagrams/cards/module-4/previously-published-post-analytics-modal.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/previously-published-post-analytics-modal.ts`](pseudocode/module-4/previously-published-post-analytics-modal.ts)

**Milestone (finished state):** Clicking a published post opens its analytics modal with the correct
fixture data; clicking a draft post (in Calendar or the Content Board) does not offer this modal.

**Definition of Done:**
- [ ] `PostAnalyticsModal.test.tsx` covers the has-data vs. no-data-yet branch
- [ ] `performance.spec.ts` → "Previously Published & Post Analytics Modal" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PostAnalyticsModal
```
