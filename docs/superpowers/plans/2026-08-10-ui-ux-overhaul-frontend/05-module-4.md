# Module 4 — Campaign Analytics & Reporting

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note). Any
DoD item below referencing a Playwright spec passing is deferred until `frontend/` is wired into
`e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen doc: [`docs/module-4/screens/performance.md`](../../../module-4/screens/performance.md).
Component doc: [`_components/post-analytics-modal.md`](../../../module-4/screens/_components/post-analytics-modal.md).
Spec file: `e2e/tests/performance.spec.ts` (Cards 24–27).

**Component diagram:** [`diagrams/module-4.mmd`](diagrams/module-4.mmd)

---

### CARD — Performance: Ingestion Form Entry State

**Depends on:** Foundation — Shell & Routing
**Summary:** The `/performance` entry state before any campaign is submitted.
**Prototype reference:** screen-performance / `renderPerformance()` (entry state) + `submitCampaign()`
— `ui-ux-prototype.html:3882–3910`, `:3796–3837`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` — the `/performance` screen
  shell, entry state
- `components/module-4/4.1-campaign-analytics/IngestionForm.tsx` — the 7-field campaign-input form

**Related files:**
- `services/fixtures/campaign.ts` (Foundation — Fixture Data Layer) — `DEFAULT_CAMPAIGN_INPUT`, used
  to pre-fill the form's placeholder values

**Flow:** [`diagrams/cards/module-4/ingestion-form-entry-state.mmd`](diagrams/cards/module-4/ingestion-form-entry-state.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/ingestion-form-entry-state.ts`](pseudocode/module-4/ingestion-form-entry-state.ts)

**Milestone (finished state):** `/performance` with no campaign submitted shows only the ingestion
form; submitting valid values transitions to the full view (Card 25).

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` covers form validation and the submit→full-view transition
- [ ] `performance.spec.ts` → "Ingestion Form Entry State" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CampaignAnalyticsView
```

---

### CARD — Performance: KPI Cards, PES Gauge & Funnel

**Depends on:** Card 24 (Ingestion Form Entry State)
**Summary:** The five KPI cards, PES radial gauge + breakdown, and the customer journey funnel.
**Prototype reference:** screen-performance / `computeMetrics()` + `computePes()` —
`ui-ux-prototype.html:3760–3794`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/KpiCard.tsx` — one KPI card with a trend arrow
- `components/module-4/4.1-campaign-analytics/FlaggedMetricBanner.tsx` — the zero-denominator warning
- `components/module-4/4.1-campaign-analytics/PesGauge.tsx` — the radial gauge + contribution bars
- `components/module-4/4.1-campaign-analytics/CustomerJourneyFunnel.tsx` — the 4-stage funnel

**Related files:**
- `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` (Card 24) — mounts all four
  of this card's components once a campaign exists

**Flow:** [`diagrams/cards/module-4/kpi-cards-pes-gauge-funnel.mmd`](diagrams/cards/module-4/kpi-cards-pes-gauge-funnel.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/kpi-cards-pes-gauge-funnel.ts`](pseudocode/module-4/kpi-cards-pes-gauge-funnel.ts)

**Milestone (finished state):** Submitting the ingestion form with a zero denominator (e.g.
`adSpend: 0`) shows the flagged banner naming the correct metric(s), and PES still renders a value in
`[0, 1]`.

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` extended: flagged-metric path for `computeMetrics`/`computePes`
- [ ] `performance.spec.ts` → "KPI Cards, PES Gauge & Funnel" — deferred, not wired for `frontend/`
      yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CampaignAnalyticsView
```

---

### CARD — Performance: Trend Charts & AI Action Plan

**Depends on:** Card 25 (KPI Cards, PES Gauge & Funnel)
**Summary:** The 4/8-week trend charts and the AI prescriptive report.
**Prototype reference:** screen-performance / `renderPerformance()` (trend + report section) —
`ui-ux-prototype.html:3876–3879` (weeks state), report shape in `services/fixtures/campaign.ts`'s
`MOCK_REPORT`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PesTrendChart.tsx` — PES-over-time with a 4/8-week
  toggle
- `components/module-4/4.1-campaign-analytics/EfficiencyTrendChart.tsx` — ROAS/CTR/CR over time
- `components/module-4/4.1-campaign-analytics/CostTrendChart.tsx` — CPC/CAC over time
- `components/module-4/4.1-campaign-analytics/AiActionPlan.tsx` — executive summary + ranked
  diagnostics + recommendations

**Related files:**
- `services/fixtures/campaign.ts` (Foundation — Fixture Data Layer) — `MOCK_HISTORY` (trend charts'
  data source), `MOCK_REPORT` (the AI action plan's data source)

**Flow:** [`diagrams/cards/module-4/trend-charts-ai-action-plan.mmd`](diagrams/cards/module-4/trend-charts-ai-action-plan.mmd)

**Steps (pseudocode):** [`pseudocode/module-4/trend-charts-ai-action-plan.ts`](pseudocode/module-4/trend-charts-ai-action-plan.ts)

**Milestone (finished state):** Toggling 4↔8 weeks updates both trend charts consistently; the 3
diagnostics render in Weakest→Moderate→Alright order regardless of each stage's raw drop percentage.

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` extended: diagnostics ranked by impact, not raw drop
- [ ] `performance.spec.ts` → "Trend Charts & AI Action Plan" — deferred, not wired for `frontend/`
      yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CampaignAnalyticsView
```

---

### CARD — Performance: Previously Published & Post Analytics Modal

**Depends on:** Card 25 (KPI Cards, PES Gauge & Funnel), Content Studio Card 19 (shared post store)
**Summary:** Platform-filtered published-post list and the per-post analytics modal.
**Prototype reference:** screen-performance / `openPostAnalytics()` — `ui-ux-prototype.html:3843–3874`

**Project files to add/implement:**
- `components/module-4/4.1-campaign-analytics/PreviouslyPublished.tsx` — filter tabs + published-post
  list
- `components/module-4/4.1-campaign-analytics/PostAnalyticsModal.tsx` — per-post analytics detail

**Related files:**
- `services/postStore.ts` (Content Studio Card 19) — the shared post list this section filters and
  reads per-post metrics from
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
