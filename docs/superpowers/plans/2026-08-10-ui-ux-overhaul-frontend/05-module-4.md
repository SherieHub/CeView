# Module 4 — Campaign Analytics & Reporting

Screen doc: [`docs/module-4/screens/performance.md`](../../../module-4/screens/performance.md).
Component doc: [`_components/post-analytics-modal.md`](../../../module-4/screens/_components/post-analytics-modal.md).
Spec file: `e2e/tests/performance.spec.ts` (Cards 24–27).

---

### CARD — Performance: Ingestion Form Entry State

**Depends on:** Foundation — Shell & Routing
**Summary:** The `/performance` entry state before any campaign is submitted.

**Steps:**
- [ ] `CampaignAnalyticsView.tsx` (re-skin) — no-campaign state: 7-field ingestion form (impressions,
      clicks, adSpend, revenue, conversions, bookings, newCustomers), inline hint per field
- [ ] "New submission" ghost button clears `campaign` and returns to this state from the full view

**Milestone (finished state):** `/performance` with no campaign submitted shows only the ingestion
form; submitting valid values transitions to the full view (Card 25).

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` covers form validation and the submit→full-view transition
- [ ] `performance.spec.ts` → "Ingestion Form Entry State" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- CampaignAnalyticsView
cd e2e && npx playwright test performance.spec.ts -g "Ingestion Form Entry State"
```

---

### CARD — Performance: KPI Cards, PES Gauge & Funnel

**Depends on:** Card 24 (Ingestion Form Entry State)
**Summary:** The five KPI cards, PES radial gauge + breakdown, and the customer journey funnel.

**Steps:**
- [ ] 5 KPI cards (CTR, CPC inverse-good, ROAS, CR, CAC inverse-good) with trend arrows
- [ ] Flagged-metric banner — names any zero-denominator metric, states weight redistribution
- [ ] PES radial gauge, qualitative label, contribution-breakdown bars, formula footer
      (`computePes`, `ui-ux-prototype.html:3772–3794`)
- [ ] Customer journey funnel (Impressions→Clicks→Conversions→Bookings, drop-off %)

**Milestone (finished state):** Submitting the ingestion form with a zero denominator (e.g.
`adSpend: 0`) shows the flagged banner naming the correct metric(s), and PES still renders a value in
`[0, 1]`.

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` extended: `computePes`/`computeMetrics` flagged-metric path
- [ ] `performance.spec.ts` → "KPI Cards, PES Gauge & Funnel" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- CampaignAnalyticsView
cd e2e && npx playwright test performance.spec.ts -g "KPI Cards, PES Gauge & Funnel"
```

---

### CARD — Performance: Trend Charts & AI Action Plan

**Depends on:** Card 25 (KPI Cards, PES Gauge & Funnel)
**Summary:** The 4/8-week trend charts and the AI prescriptive report.

**Steps:**
- [ ] PES trend (4/8-week toggle) with label-threshold dashed reference lines
- [ ] Efficiency trend chart (ROAS/CTR/CR) and cost trend chart (CPC/CAC)
- [ ] AI action plan — executive summary card, 3 funnel diagnostics ranked by business impact (not
      raw drop-size), each paired with a recommendation card + urgency chip

**Milestone (finished state):** Toggling 4↔8 weeks updates both trend charts consistently; the 3
diagnostics render in Weakest→Moderate→Alright order regardless of each stage's raw drop percentage.

**Definition of Done:**
- [ ] `CampaignAnalyticsView.test.tsx` extended: diagnostics ranked by impact, not raw drop
- [ ] `performance.spec.ts` → "Trend Charts & AI Action Plan" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- CampaignAnalyticsView
cd e2e && npx playwright test performance.spec.ts -g "Trend Charts & AI Action Plan"
```

---

### CARD — Performance: Previously Published & Post Analytics Modal

**Depends on:** Card 25 (KPI Cards, PES Gauge & Funnel), Content Studio Card 19 (shared post store)
**Summary:** Platform-filtered published-post list and the per-post analytics modal.

**Steps:**
- [ ] "Previously published" section — All/TikTok/Instagram/Facebook filter tabs over published posts
- [ ] `PostAnalyticsModal` (new) — reach/likes/comments/shares/engagement-rate stat grid, 7-day
      reach-accumulation line chart (Recharts, not the prototype's SVG helper — see Foundation
      Design System card), "No data yet" empty state for zero-reach posts

**Milestone (finished state):** Clicking a published post opens its analytics modal with the correct
fixture data; clicking a draft post (in Calendar or the Content Board) does not offer this modal.

**Definition of Done:**
- [ ] `PostAnalyticsModal.test.tsx` covers the has-data vs. no-data-yet branch
- [ ] `performance.spec.ts` → "Previously Published & Post Analytics Modal" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- PostAnalyticsModal
cd e2e && npx playwright test performance.spec.ts -g "Previously Published & Post Analytics Modal"
```
