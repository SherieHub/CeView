# Module 4 — Campaign Analytics & Reporting

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note). Any
DoD item below referencing a Playwright spec passing is deferred until `frontend/` is wired into
`e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen doc: [`docs/module-4/screens/performance.md`](../../../module-4/screens/performance.md).
Component doc: [`_components/post-analytics-modal.md`](../../../module-4/screens/_components/post-analytics-modal.md).
Spec file: `e2e/tests/performance.spec.ts` (Cards 24–27).

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

**Steps (pseudocode):**
1. `CampaignAnalyticsView.tsx`: if no campaign has been submitted yet (local/session state, not
   persisted), render only the ingestion form; once a campaign exists, render the full view (Card
   25's scope).
2. `IngestionForm.tsx`: render 7 numeric fields — impressions, clicks, ad spend, revenue,
   conversions, bookings, new customers — each with an inline hint describing what it means.
3. On submit:
   - Validate every field is a non-negative number; if any fails, show an inline error banner
     ("All fields must be non-negative numbers.") and do not proceed.
   - Otherwise, disable the submit button with a "Computing analytics…" spinner label, then (after
     a short simulated delay) hand the validated input off to the metrics computation the full view
     (Card 25) consumes, and transition to the full view.
4. A "New submission" ghost button (rendered by the full view, Card 25) clears the current campaign
   and returns to this entry state.

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

**Steps (pseudocode):**
1. From the submitted campaign input, derive 5 metrics (each guarding against a zero denominator by
   recording that metric's name in a "flagged" list instead of dividing by zero):
   - CTR = clicks / impressions × 100 (flag if impressions = 0).
   - CPC = ad spend / clicks (flag if clicks = 0).
   - Conversion rate = bookings / clicks × 100 (flag if clicks = 0).
   - ROAS = revenue / ad spend (flag if ad spend = 0).
   - CAC = ad spend / new customers (flag if new customers = 0).
2. Render one `KpiCard` per metric, each with a trend arrow — "good" direction differs per metric:
   higher is better for CTR/ROAS/conversion rate, lower is better for CPC/CAC ("inverse-good").
3. If the flagged list is non-empty, render `FlaggedMetricBanner` naming every flagged metric and
   stating that its weight was redistributed in the PES calculation below.
4. Compute PES (Promotional Effectiveness Score):
   - Normalize each of ROAS/conversion-rate/CAC/CTR/CPC against fixed Cebu-MSME bounds, inverting
     the two cost metrics (CAC, CPC) so "lower raw value" maps to "higher normalized score".
   - Weight the normalized values (ROAS 35%, conversion rate 30%, CAC 15%, CTR 15%, CPC 5%) and sum
     them into an overall score in `[0, 1]`.
   - Map the overall score to a qualitative label: ≥0.80 Excellent, ≥0.60 Good, ≥0.40 Fair, else
     Poor.
5. Render `PesGauge`: the radial gauge (score + qualitative label), a contribution-breakdown bar per
   weighted metric, and the weighted-sum formula shown verbatim beneath them.
6. Render `CustomerJourneyFunnel`: 4 stages (Impressions → Clicks → Conversions → Bookings), each
   after the first showing its drop-off percentage from the previous stage (or nothing if the
   previous stage's value was zero).

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

**Steps (pseudocode):**
1. Maintain a shared "weeks" toggle (4 or 8) for this screen; slice `MOCK_HISTORY` to the trailing N
   weeks based on it.
2. `PesTrendChart`: plot PES over the selected window, with dashed horizontal reference lines at each
   qualitative-label threshold (0.40 / 0.60 / 0.80).
3. `EfficiencyTrendChart`: plot ROAS, CTR, and conversion rate together over the same window.
4. `CostTrendChart`: plot CPC and CAC together over the same window.
5. `AiActionPlan`:
   - Render the executive summary text from `MOCK_REPORT`.
   - Render the 3 funnel diagnostics in the order `MOCK_REPORT` provides them — that order is
     ranked by business impact (Weakest → Moderate → Alright), which does **not** necessarily match
     sorting by raw drop-off percentage; render them as-given, don't re-sort by drop-size.
   - Pair each diagnostic with its matching recommendation card (title, action text) and an urgency
     chip (Most Urgent / Urgent / Not Very Urgent).

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

**Steps (pseudocode):**
1. `PreviouslyPublished.tsx`: render filter tabs (All / TikTok / Instagram / Facebook) over the
   shared post store, restricted to posts with `status: 'published'` — drafts and scheduled posts
   never appear here and are not clickable into the modal.
2. Clicking a published post opens `PostAnalyticsModal` for that post's id.
3. `PostAnalyticsModal.tsx`:
   - Header: platform, date, a truncated caption (first ~110 characters, ellipsized if longer).
   - A stat grid: reach, likes, comments, shares, engagement rate, platform.
   - If the post has non-zero reach: render a 7-day reach-accumulation line chart from its `series`
     data (Recharts area/line, not the prototype's SVG helper).
   - If the post has zero reach (no data has come back from the platform yet): render a "No data
     yet" empty state instead of an empty chart.

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
