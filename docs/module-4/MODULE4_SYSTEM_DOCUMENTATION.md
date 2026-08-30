# Module 4: System Documentation

---

## User Flows & Interaction (The Frontend)

Module 4 is the **Campaign Analytics & Reporting** module. It accepts raw campaign data directly from the operator, computes five marketing KPIs, runs the Promotional Effectiveness Score (PES) formula, and generates an AI prescriptive report diagnosing every funnel bottleneck with urgency-ranked, 1-to-1 recommendations. The entire module lives in `ceview/components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` and is reached via `/performance` in the sidebar.

As of the UI/UX overhaul this screen also gains a "Previously published" post list with per-post
analytics — see [`screens/performance.md`](screens/performance.md) for full current detail. The two
sub-flows below (ingestion form entry state, dashboard) are unchanged by the overhaul.

The view has two exclusive states managed by `dashboardActive` boolean:

---

### Sub-Flow A — Data Ingestion Form (Entry State)

Handled by `ceview/components/module-4/4.1-campaign-analytics/components/DataIngestionForm.tsx`.

1. **Landing**: When `!dashboardActive`, the form fills the entire view. A centred navy icon header reads "No Campaign Data Found" with a subtitle encouraging the operator to enter campaign parameters.
2. **Seven input fields** (all numeric, all validated as non-negative):

   | Field | Description |
   |-------|-------------|
   | **Impressions** | Total ad impressions served across all platforms |
   | **Clicks** | Total clicks on ads |
   | **Ad Spend (₱)** | Total ad spend in Philippine Pesos |
   | **Revenue (₱)** | Revenue attributed to the campaign in PHP |
   | **Conversions (Leads)** | Enquiry form submissions / lead conversions |
   | **Bookings (Sales)** | Confirmed bookings (actual sales closed) |
   | **New Customers** | Net-new customers acquired in the period |

3. **Client-side validation**: `handleSubmit` checks that all seven values are non-negative numbers. Any negative or `NaN` value shows a red error banner "All fields must be non-negative numbers."
4. **Submission**: Clicking "Generate Campaign Analytics" sets `submitting = true` (spinner + "Computing Analytics…" label) and calls `api.analyticsManual(payload)` → `POST /api/analytics/manual`.
5. **On success**: `onDataReady(result)` stores the `ManualIngestResponse` in `CampaignAnalyticsView.metricsData` and sets `dashboardActive = true`. The form is replaced by the full dashboard.
6. **On failure**: `ApiError.code` shown in a red error banner. Dashboard is **not** activated.

---

### Sub-Flow B — Campaign Engagement Dashboard

Rendered once `dashboardActive = true`. Four components render in sequence, all receiving the operator's submitted data without additional API round-trips for the KPI and PES sections.

**1. `EngagementMetricsBoard`**

- **4W / 8W toggle**: Binary window selector (`weeks: 4 | 8`, default 4). Changing the window updates `weeks` state in the parent view, which flows into `AIActionPlanReport` (re-fetches the prescriptive report for the new window). The KPI cards **always show the operator's submitted values** — they do not re-fetch on window change since `metricsData` is already computed from the submitted raw inputs.
- **Five KPI metric cards**, each with: computed value, unit, trend delta (vs. a baseline), and directional indicator:

   | Card | Unit | Logic | `inverseLogic` |
   |------|------|-------|----------------|
   | **CTR** — Click-Through Rate | % | Higher = better | No |
   | **CPC** — Cost per Click | ₱ | Lower = better | **Yes** |
   | **ROAS** — Return on Ad Spend | × | Higher = better | No |
   | **CR** — Conversion Rate | % | Higher = better | No |
   | **CAC** — Customer Acquisition Cost | ₱ | Lower = better | **Yes** |

   Cards with `inverseLogic` show a green up-arrow for a positive trend delta even when the value decreased (since lower CPC/CAC is an improvement).

**2. `CustomerJourneyFunnel`** (Campaign Metrics Trend)

- Auto-fetches `api.analyticsHistory(weeks)` → `GET /api/analytics/history?weeks=` on mount and when `weeks` changes.
- Renders two side-by-side `LineChart` panels from the stored history:
  - **Efficiency Metrics**: ROAS (navy), CTR (gold), CR (emerald)
  - **Cost Metrics (₱)**: CPC (amber), CAC (red-orange)
- Y-axis formatted as `₱` for cost metrics. Dates derived from `periodStart` of each campaign record. "No campaign records yet" placeholder when history is empty.

**3. `PESComputationBoard`**

- **Left panel — Score Gauge**: `<ScoreGauge>` circular gauge (0–1 scale, shown as 0.00–1.00) receives the submitted PES `overallScore` as its `score` prop. `<QualitativeLabel>` takes the PES `label` string and shows the textual tier: Poor / Fair / Good / Excellent Performance. Falls back to last history record when no submitted PES is present.
- **Right panel — PES Trend chart**:
  - Auto-fetches `api.analyticsHistory(weeks)` → `GET /api/analytics/history`.
  - Recharts `LineChart` with Y domain `[0, 1]` and four dashed reference lines:
    - `y=0.80` — "Excellent" (green)
    - `y=0.60` — "Good" (amber)
    - `y=0.40` — "Fair" (red)
  - Dot colors by tier: `≥ 0.80` → gold, `≥ 0.60` → green, `≥ 0.40` → amber, `< 0.40` → red-orange.
  - Formula label in the header (monospace): `PES = ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05`
  - Custom tooltip shows: period range, PES score (color-coded), qualitative label.
- "No campaign history yet" placeholder when the history list is empty.

**4. `AIActionPlanReport`**

- **Auto-fires on mount** and re-fires when `weeks` changes: `api.prescriptiveReport(weeks)` → `POST /api/analytics/report`. This is the only component in Module 4 that calls an AI endpoint on-demand (not triggered by user action).
- **Loading state**: Full-panel spinner "Analyzing your campaign funnel…" while the Groq report generates.
- **Report output** (when `reportData` populated):
  - **Executive Summary**: 2–3 sentence overall campaign assessment referencing the PES score and primary bottleneck.
  - **Recommended Platform badge**: Market-resolved platform (e.g., "Naver Blog" for Korea). Displayed as a teal chip.
  - **Stage-by-Stage Analysis panel**: Left-column urgency summary list. Three urgency rows — Most Urgent (red), Urgent (amber), Not Very Urgent (green) — each showing the recommendation title and action.
  - **`PriorityFixCard` panel**: Right-column detailed funnel diagnostics. Three stacked diagnostic cards, one per funnel transition:
    - **Rank badge**: **Weakest** (red, `AlertTriangle` icon), **Moderate** (amber, `TrendingDown` icon), **Alright** (green, `CheckCircle2` icon).
    - **Drop rate pill**: Absolute percentage drop for that transition.
    - **AI insight**: One-sentence root-cause diagnosis specific to the Cebu tourism funnel.
    - **Paired recommendation**: 1-to-1 urgency-tagged action plan (`Most Urgent` / `Urgent` / `Not Very Urgent`), including a short title (≤ 8 words) and a concrete implementation step.

---

## System Workflow & Sequence (The Bridge)

---

### Request Lifecycle 1 — Manual Data Ingestion (`POST /api/analytics/manual`)

The central pipeline of Module 4. All computation, persistence, and AI enrichment flows through this single endpoint.

1. `EngagementMetricsController.manualIngest()` receives the raw input record.
2. **Step 1 — Local KPI computation** (synchronous, zero latency):
   `MetricsCalculationService.compute(in)` → derives all five KPIs and the four-stage funnel locally without any external call.
3. **Step 2 — Persist raw inputs + KPIs**:
   `CampaignRecord.from(in)` → creates the entity with raw values. `record.enrichWithKpis(ctr, cpc, convRate, roas, cac)` → sets derived KPI fields. `campaignRepo.save(record)` → **first DB write** (raw data + KPIs persisted before any AI call).
4. **Step 3 — FastAPI PES enrichment**:
   `ai.computePesFromRaw(payload)` → `POST /internal/pes-compute/analyze` to fastapi-sbert (30 s timeout). Returns full PES result including breakdown, AI report, flagged metrics, and effective weights.
5. **Step 4 — Enrich DB record with PES**:
   `record.enrichWithPes(pesScore, pesLabel)` → `campaignRepo.save(record)` → **second DB write** (PES score and label persisted).
6. **FR4.26 Fallback** (FastAPI unavailable):
   `pesSvc.compute(mr.metrics())` → Spring Boot rule-based PES computation. Record still saved with fallback scores. No error returned to the frontend — the response is always fully populated.
7. Returns `ManualIngestResponse(metrics, funnel, pes)` — a single combined response enabling the frontend to display all sections without additional round-trips.

---

### Request Lifecycle 2 — History Load

**Trigger**: `PESComputationBoard` and `CustomerJourneyFunnel` mount → `GET /api/analytics/history?weeks={4|8}`.

1. `EngagementMetricsController.history()` sets `limit = (weeks == 8) ? 8 : 4`.
2. `campaignRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(0, limit))` — loads the most recent `limit` records in DESC order.
3. `Collections.reverse(records)` — reverses to **chronological order** (oldest first) so the frontend trend charts read left-to-right correctly.
4. Returns `CampaignHistoryResponse(snapshots)` — each snapshot carries: `periodStart`, `periodEnd`, `pesScore`, `pesLabel`, `ctr`, `cpc`, `roas`, `convRate`, `cac`.

---

### Request Lifecycle 3 — Prescriptive Report (`POST /api/analytics/report`)

**Trigger**: `AIActionPlanReport` mounts → `POST /api/analytics/report` with body `{ weeks: 4 | 8 }`.

1. `PrescriptiveReportController.report()` loads default metrics via `metricsSvc.defaultMetrics(weeks)` (scaled demo defaults).
2. `metricsSvc.computeFunnelTransitions(mr.funnel())` — derives three absolute drop rates and **ranks them by business impact** (see Engine section).
3. Enriches payload: adds `funnelTransitions` and `weeks` to the request body.
4. `ai.generateReport(payload)` → `POST /internal/report/generate` to fastapi-sbert → `gemini_client.performance_report()` which calls Groq.
5. **FR4.26 Fallback**: `buildRuleBasedReport(mr, transitions)` — identifies the lowest PES contribution metric as the primary bottleneck; returns three hardcoded contextual diagnostics and recommendations.
6. Returns the prescriptive report map `{ executiveSummary, funnelDiagnostics[], recommendations[], recommendedPlatform }`.

---

### Request Lifecycle 4 — PES Time-Series Analysis (`POST /api/analytics/pes-analysis`)

**Trigger**: Future on-demand call → `POST /api/analytics/pes-analysis` with body `{ weeks: 4 | 8 }`.

1. `PrescriptiveReportController.pesAnalysis()` loads current metrics via `metricsSvc.defaultMetrics(weeks)`.
2. `metricsSvc.buildTimeSeries(metrics, weeks)` — generates a synthetic `weeks`-length time series in **reverse chronological order** (index 0 = current) for all five metrics.
3. `ai.generatePesAnalysis({"metrics_data": timeSeries, "weeks": weeks})` → `POST /internal/pes-analysis/generate` → LangGraph `pes_report_agent`.
4. **FR4.26 Fallback**: `buildOfflinePesAnalysisFallback()` returns `{report_data: {metric_conditions: [], ...}, metadata: {needs_human_review: true, warning_message: "..."}}`.

---

## Background Processing & Algorithmic Logic (The Engine)

### Phase 1 — KPI Computation from Raw Inputs

All five KPIs are computed deterministically from the seven raw inputs using `MetricsCalculationService.compute()` on Spring Boot (and mirrored in `pes_compute_service.compute_base_metrics()` on FastAPI):

```
Inputs:
  impressions   — total ad impressions
  clicks        — total ad clicks
  adSpend (₱)  — total ad spend in Philippine Pesos
  revenue (₱)  — total revenue attributed to the campaign
  conversions   — enquiry / lead form submissions
  bookings      — confirmed reservations / sales
  newCustomers  — net-new customers acquired

Derived KPIs:
  CTR  = (clicks / impressions) × 100          [%]   — ad creative relevance
         if impressions = 0 → CTR = 0.0  [FLAGGED]

  CPC  = adSpend / clicks                      [₱]   — ad spend efficiency per click
         if clicks = 0 OR adSpend = 0 → CPC = 0.0  [FLAGGED]

  CR   = (bookings / clicks) × 100             [%]   — booking conversion rate
         Note: uses bookings (confirmed sales), NOT conversions (leads)
         if clicks = 0 → CR = 0.0  [FLAGGED]

  ROAS = revenue / adSpend                     [×]   — campaign profitability multiple
         if adSpend = 0 → ROAS = 0.0  [FLAGGED]

  CAC  = adSpend / newCustomers                [₱]   — customer acquisition cost
         if newCustomers = 0 → CAC = 0.0  [FLAGGED]
```

**Zero-denominator flagging**: Any metric that cannot be computed (zero denominator) is added to the `flagged` list with a descriptive reason, e.g., `"CTR (impressions = 0)"`. Flagged metrics are excluded from the PES formula and their weights are redistributed.

---

### Phase 2 — Four-Stage Customer Journey Funnel

```
Funnel:  Impressions → Clicks → Conversions → Bookings

Dropoff at each stage (relative % change, can be positive or negative):
  dropoff(stage_n, stage_n+1) = ((stage_n+1 - stage_n) / stage_n) × 100
  Formatted as a signed percentage string: "-95.2%", "-88.1%"
```

**Business-impact ranking of funnel transitions** (`computeFunnelTransitions`):

Three transitions are computed and ranked **by business impact**, not solely by raw drop-rate magnitude. This is a deliberate design decision for Cebu MSME hospitality businesses:

```
Priority 1 — "Clicks → Conversions"   (absolute drop: |conversions - clicks| / clicks)
  Rationale: Primary revenue bottleneck. Every non-converting click is wasted ₱ ad spend.
  Highest actionability: landing page, booking form, pricing, social proof.

Priority 2 — "Conversions → Bookings"  (absolute drop: |bookings - conversions| / conversions)
  Rationale: High-intent leads who started the commitment process but abandoned.
  Recoverable via retargeting, abandoned-enquiry SMS, booking-path friction reduction.

Priority 3 — "Impressions → Clicks"   (absolute drop: |clicks - impressions| / impressions)
  Rationale: Large absolute drop is expected (normal CTR behaviour, 2-8%).
  Ad creative issue; lower direct-revenue impact than mid-funnel.
```

The ranked list is passed to the Groq report prompt, which is instructed to **not re-order** them — preserving the business-impact priority in the output.

---

### Phase 3 — Min-Max Normalization (FastAPI)

Before PES computation, all five KPIs are mapped to a common `[0, 1]` scale using industry-calibrated bounds for **Cebu MSME hospitality / tourism businesses** denominated in Philippine Pesos:

```
METRIC_BOUNDS (industry-calibrated for Cebu MSME tourism):
  CTR  : min = 0.0 %,    max = 10.0 %     (typical social ad CTR ceiling in Cebu market)
  CPC  : min = ₱0.01,    max = ₱500.0     (₱0.01 = virtually free; ₱500 = severely overpriced)
  CR   : min = 0.0 %,    max = 15.0 %     (15% booking conversion = exceptional for hospitality)
  ROAS : min = 0.0 ×,    max = 8.0 ×      (8× ROAS = strong ceiling for Cebu tourism campaigns)
  CAC  : min = ₱1.0,     max = ₱5,000.0   (₱1 = best possible; ₱5,000 = extremely inefficient)

Min-Max normalization formula:
  n = clamp01( (raw_val − min) / (max − min) )
  n = max(0.0, min(1.0, n))   # clamp handles values outside the calibrated range
```

**Cost metric inversion** (`COST_METRICS = {"CPC", "CAC"}`):

Because lower cost = higher effectiveness, CPC and CAC are inverted after normalization:
```
For CPC and CAC:
  n_inverted = 1.0 − n
  # n = 0.0 (maximum cost, ₱500 CPC / ₱5000 CAC) → n_inv = 1.0 (worst → contributes nothing)
  # n = 1.0 (minimum cost, ₱0.01 CPC / ₱1 CAC)   → n_inv = 0.0 ... wait — this is correct:
  # n_raw = (raw_val - min) / (max - min)
  # For CPC=₱0.01 (best): n_raw = (0.01-0.01)/(500-0.01) ≈ 0.0 → n_inv = 1.0  ✓  (high contribution)
  # For CPC=₱500 (worst):  n_raw = (500-0.01)/(500-0.01) ≈ 1.0 → n_inv = 0.0  ✓  (no contribution)
```

---

### Phase 4 — Edge-Case Weight Recalibration

When one or more metrics are flagged (zero denominator), their weight must be redistributed to prevent the PES from being artificially depressed:

```
BASE_WEIGHTS (full dataset):
  ROAS → 0.35
  CR   → 0.30
  CAC  → 0.15
  CTR  → 0.15
  CPC  → 0.05
  Sum  = 1.00

Example — ROAS flagged (adSpend = 0):
  active_weights = { CR: 0.30, CAC: 0.15, CTR: 0.15, CPC: 0.05 }
  total_active   = 0.65

  effective_weights = { k: weight[k] / 0.65 for k in active_weights }
  → { CR: 0.461538, CAC: 0.230769, CTR: 0.230769, CPC: 0.076923 }
  Sum = 1.000000  ✓

  This ensures PES ∈ [0, 1] even when high-weight metrics like ROAS are unavailable.
  The operator's content performance is still scored accurately relative to what was submitted.
```

---

### Phase 5 — PES Weighted-Sum Formula

```
Full formula (all five metrics active):

  PES = (ROAS_n × 0.35) + (CR_n × 0.30) + (CAC_n_inv × 0.15) + (CTR_n × 0.15) + (CPC_n_inv × 0.05)

Generalised formula (with recalibrated weights for partial data):

  PES = Σ ( normalized_metric[k] × effective_weight[k] )
        for each active (non-flagged) metric k

  PES ∈ [0.0, 1.0]   (clamped)
```

**Per-metric contribution breakdown** (what each metric contributes to the final PES):

```
contribution[k] = normalized_metric[k] × effective_weight[k]

Breakdown ordering (highest weight first):
  ROAS  (35%) → contribution = ROAS_n  × 0.35     "Ad spend profitability"
  CR    (30%) → contribution = CR_n    × 0.30     "Booking conversion efficiency"
  CAC   (15%) → contribution = CAC_inv × 0.15     "Customer acquisition cost efficiency"
  CTR   (15%) → contribution = CTR_n   × 0.15     "Ad creative relevance"
  CPC   ( 5%) → contribution = CPC_inv × 0.05     "Click cost efficiency"
```

**Weight rationale** (SDD §4.2):
- **ROAS (35%)**: Directly measures campaign profitability in ₱ terms — the highest-priority signal for a revenue-focused Cebu MSME.
- **CR (30%)**: Booking conversion rate determines whether the ad spend reaches its ultimate goal. Low CR means money spent on traffic that never converts.
- **CAC (15%)** and **CTR (15%)**: Equally weighted secondary signals — CAC measures total acquisition efficiency; CTR measures creative relevance.
- **CPC (5%)**: Lowest weight because CPC alone can be low while the campaign is still unprofitable (low ROAS, low CR).

**Qualitative PES labels:**

| PES Range | Label | Meaning for Cebu MSME |
|-----------|-------|----------------------|
| ≥ 0.80 | **Excellent Performance** | Campaign is highly profitable; scale spend |
| ≥ 0.60 | **Good Performance** | Campaign is working; optimise mid-funnel |
| ≥ 0.40 | **Fair Performance** | Positive ROAS but significant inefficiencies |
| < 0.40 | **Poor Performance** | Campaign is burning budget; major restructure needed |

---

### Phase 6 — Worked PES Example

Using Week 4 seed data (KOL collaboration week, first "Good Performance"):

```
Raw inputs:
  impressions=95,000  clicks=2,800  adSpend=₱4,000
  revenue=₱35,000  conversions=185  bookings=112  newCustomers=34

Step 1 — Base metrics:
  CTR  = (2,800 / 95,000) × 100 = 2.947 %
  CPC  = ₱4,000 / 2,800        = ₱1.429
  CR   = (112 / 2,800) × 100   = 4.000 %
  ROAS = ₱35,000 / ₱4,000      = 8.750 ×
  CAC  = ₱4,000 / 34            = ₱117.65
  (no flags — all denominators > 0)

Step 2 — Min-Max normalization:
  CTR_n  = clamp01((2.947 − 0)   / (10 − 0))     = 0.2947
  CPC_n  = clamp01((1.429 − 0.01)/ (500 − 0.01)) = 0.0028  → CPC_inv = 1 − 0.0028 = 0.9972
  CR_n   = clamp01((4.000 − 0)   / (15 − 0))     = 0.2667
  ROAS_n = clamp01((8.750 − 0)   / (8 − 0))      = clamp01(1.0938) = 1.0000  ← CAPPED at 1.0
  CAC_n  = clamp01((117.65 − 1)  / (5000 − 1))   = 0.0233  → CAC_inv = 1 − 0.0233 = 0.9767

Step 3 — No flags, so effective_weights = BASE_WEIGHTS

Step 4 — PES:
  PES = (1.0000 × 0.35) + (0.2667 × 0.30) + (0.9767 × 0.15)
       + (0.2947 × 0.15) + (0.9972 × 0.05)
      = 0.3500 + 0.0800 + 0.1465 + 0.0442 + 0.0499
      = 0.6706 → PES ≈ 0.67  ✓ matches seed data "Good Performance"

Breakdown:
  ROAS  (35%) → 0.3500   ← ROAS capped at 1.0 due to 8.75× exceeding the 8× ceiling
  CR    (30%) → 0.0800
  CAC   (15%) → 0.1465   ← excellent CAC efficiency (₱117 well below ₱5000 max)
  CTR   (15%) → 0.0442
  CPC   ( 5%) → 0.0499   ← near-perfect CPC efficiency (₱1.43 near floor of ₱0.01)

Weakest metric by contribution: CR (0.0800) — "Clicks → Bookings" is the bottleneck
```

---

### Phase 7 — Cross-Metric Funnel Weakness Identification

The weakest metric is identified by finding the **smallest contribution value** among all active metrics in the breakdown:

```python
active_items  = [b for b in breakdown if b["contribution"] > 0]
weakest_item  = min(active_items, key=lambda x: x["contribution"])
weakest_name  = weakest_item["metric"]        # e.g. "Conv. Rate"
weakest_stage = _METRIC_TO_STAGE[weakest_name]  # e.g. "Clicks → Bookings"
```

**Metric-to-funnel-stage mapping:**

| Metric | Funnel Stage | Business Meaning |
|--------|-------------|-----------------|
| `ROAS` | Impressions → Revenue (Ad Spend Efficiency) | Overall campaign profitability — every ₱ of ad spend |
| `Conv. Rate` | Clicks → Bookings | % of ad clicks that became confirmed reservations |
| `CAC (Inv)` | Impressions → New Customers | Total cost to acquire one paying new guest |
| `CTR` | Impressions → Clicks | % of people who saw the ad and clicked — creative relevance |
| `CPC (Inv)` | Impressions → Clicks (Cost Efficiency) | Cost per click — platform targeting precision |

**Cross-metric logic reasoning** (as reasoned by the `pes_report_agent`):

The PES time-series deep analysis understands cross-metric causality within the Cebu tourism funnel:
- Low CTR → fewer clicks → lower CR even if landing page is strong (traffic quality problem)
- High CPC + low CR → double penalty on ROAS (paying more for clicks that don't convert)
- Low CAC with low ROAS → possible volume-over-profit trade-off (many cheap customers spending little)
- Spike in bookings + stable CTR → conversion path improvement likely (ad targeting unchanged but landing page or offer improved)

---

### Phase 8 — PES Report Agent (LangGraph, Quality-Gated)

The `pes_report_agent` is a **quality-gated** LangGraph workflow distinct from the Module 3 caption agent. It adds a self-evaluation loop with up to 3 retries.

```
Workflow:
  Entry → generate_report → evaluate_report → [route_action] → finalize_response → END
                                                      │
                                                      ├── score ≥ 85 AND pass=True → finalize_response
                                                      ├── iterations ≥ 3 (MAX_RETRIES) → finalize_response
                                                      └── else → generate_report  (retry with feedback)
```

**`AgentState` (shared across all nodes):**
```python
{
  metrics_data:     str   # JSON string — reverse-chronological time series
  report:           dict  # output of generate_report
  evaluation:       dict  # output of evaluate_report
  iterations:       int   # retry counter (prevents infinite loop)
  final_metadata:   dict  # score, total_iterations, needs_human_review
  final_ui_payload: dict  # bundled {report_data, metadata} for the frontend
}
```

**Time-series data contract (CRITICAL — reverse chronological):**
```
metrics_data = {
  "CTR":  [current_week, ..., baseline_week],   # index 0 = most recent
  "CPC":  [current_week, ..., baseline_week],
  "ROAS": [current_week, ..., baseline_week],
  "CR":   [current_week, ..., baseline_week],
  "CAC":  [current_week, ..., baseline_week]
}
```

The agent's system prompt explicitly states "Read trends from LAST index → index [0] to determine direction." The evaluator validates that trend directions (`up` / `down` / `stable` / `volatile`) are consistent with this order.

---

#### Node 1 — `generate_report` (Generator Agent)

**LLM**: `AgentLLMModel().get_model()` → `ChatGroq(model="llama-3.3-70b-versatile")`
**Structured output**: `llm.with_structured_output(ReportOutput)` — enforces Pydantic schema.

**`generation_prompt` system message context:**
- Role: "CeView's Senior Campaign Analyst specialising in Cebu MSME tourism businesses"
- Business context: Korean/Japanese/US inbound tourism; all cost metrics in ₱
- Campaign funnel: Impressions → Clicks → Conversions (enquiries) → Bookings (confirmed)
- Five KPI definitions with Cebu-specific interpretation
- Instruction: "be concrete — reference actual numbers and their real-world implication for the operator"

**`generation_prompt` human message instructions:**
1. **METRIC CONDITIONS** for each metric (CTR, CPC, ROAS, CR, CAC):
   - `trend`: "up" / "down" / "stable" / "volatile" (from last index → index 0)
   - `peak_value`: highest value in the series
   - `low_value`: lowest value in the series
   - `current_status`: 2–3 sentences: (a) what is happening, (b) what it means for a Cebu tourism operator, (c) concrete reference to the actual numbers
2. **CROSS-METRIC LOGIC**: how ad platform metrics (CTR, CPC) drove traffic quality that affected conversion and cost outcomes
3. **RANKED WEAKNESSES**: 1–2 metrics needing urgent attention
   - `rank=1` = highest improvement opportunity (not just lowest absolute number)
   - `weakness_meaning`: plain-language cost to the operator (lost bookings, wasted ₱)
   - `recommendation`: concrete platform-specific action (e.g., "Reduce CPC on Naver Blog by tightening keyword targeting to 'Cebu resort packages'")

**On retry iterations**: evaluator feedback is injected as "CRITICAL FEEDBACK FROM EVALUATOR — FIX THESE ISSUES:" at the end of the human message, allowing the generator to correct specific errors.

**`ReportOutput` Pydantic schema:**
```python
class MetricCondition(BaseModel):
  metric_name:    str     # "CTR" | "CPC" | "ROAS" | "CR" | "CAC"
  current_status: str     # 2-3 sentence business-context description
  trend:          str     # "up" | "down" | "stable" | "volatile"
  peak_value:     float   # highest value in the time series
  low_value:      float   # lowest value in the time series

class RankedWeakness(BaseModel):
  metric_name:      str   # "CTR" | "CPC" | "ROAS" | "CR" | "CAC"
  rank:             int   # 1 = most urgent / weakest metric
  weakness_meaning: str   # what this costs the operator
  recommendation:   str   # concrete, platform-specific action

class CrossMetricLogic(BaseModel):
  relationships: str      # how ad metrics drove traffic quality and conversion
  insights:      str      # combined trend signal — maintain / scale / redirect?

class ReportOutput(BaseModel):
  metric_conditions:  List[MetricCondition]
  cross_metric_logic: CrossMetricLogic
  ranked_weaknesses:  List[RankedWeakness]
```

---

#### Node 2 — `evaluate_report` (Quality Evaluator)

**LLM**: Same `AgentLLMModel` instance.
**Structured output**: `llm.with_structured_output(EvaluationResult)`.

**Five evaluation criteria** (from `evaluation_prompt`):
1. **Data Coverage**: All five metrics (CTR, CPC, ROAS, CR, CAC) present in `metric_conditions`?
2. **Trend Accuracy**: Are trend directions correctly identified? Are `peak_value` and `low_value` accurate? Is `current_status` consistent with the actual numbers?
3. **Cebu Tourism Specificity**: Do descriptions reference real business implications? Do recommendations name specific platforms (Naver Blog, Instagram Reels, Facebook) or concrete tourism-context actions?
4. **Cross-Metric Logic**: Does it correctly explain the funnel relationship between ad metrics and booking outcomes?
5. **Ranking & Actionability**: Is `rank=1` the metric with the highest improvement opportunity? Are recommendations specific enough that the operator knows exactly what to do?

**`EvaluationResult` Pydantic schema:**
```python
class EvaluationResult(BaseModel):
  score:            int        # 0-100 quality score
  pass_status:      bool       # alias="pass" — True when score ≥ 85
  issues:           List[str]  # major problems found
  missing_elements: List[str]  # what is missing or weak
  accuracy_check:   str        # "correct" | "partially correct" | "incorrect"
  recommendation:   str        # "approve" | "regenerate"
```

---

#### `route_action` — Conditional Edge Logic

```python
def route_action(state):
  score      = state["evaluation"]["score"]    # 0-100
  passed     = state["evaluation"]["pass"]     # True/False
  iterations = state["iterations"]             # retry count
  MAX_RETRIES = 3

  if score >= 85 and passed:
    return "finalize_response"   # quality threshold met → proceed
  if iterations >= MAX_RETRIES:
    return "finalize_response"   # exhausted retries → proceed regardless
  return "generate_report"       # retry with evaluator feedback injected
```

---

#### Node 3 — `finalize_response`

Packages the accepted report into `final_ui_payload`:
```python
needs_human_review = (iterations >= 3 and score < 85)

final_ui_payload = {
  "report_data": {                          # from ReportOutput
    "metric_conditions":  [...],
    "cross_metric_logic": {...},
    "ranked_weaknesses":  [...]
  },
  "metadata": {
    "final_score":        score,            # evaluator's quality score
    "total_iterations":   iterations,       # how many generator cycles ran
    "needs_human_review": needs_human_review,  # True if quality threshold not met
    "warning_message":    "Report passed quality checks." | "WARNING: Quality threshold not met..."
  }
}
```

---

### Phase 9 — Synthetic Time-Series for Deep Analysis

Because `tbl_campaign_records` stores per-submission aggregates (not daily data), `MetricsCalculationService.buildTimeSeries()` generates a synthetic `weeks`-length series via linear interpolation:

```
Baseline assumptions:
  Positive metrics (CTR, ROAS, CR):   baseline ≈ 75%  of current  (trending UP is good)
  Cost metrics    (CPC, CAC):          baseline ≈ 130% of current  (trending DOWN is good)

Interpolation (current → baseline, index 0 = current):
  for i in 0..weeks-1:
    t = i / (weeks - 1)           # 0.0 at current, 1.0 at baseline
    value[i] = current + t × (baseline − current)

Example (CTR=4.5%, 4-week window):
  baseline = 4.5 × 0.75 = 3.375
  series = [4.50, 4.11, 3.72, 3.375]   # reverse-chron: week 0 = current
  Trend interpretation: CTR trended UP from 3.375 → 4.50 (improving)
```

This series is forwarded to the `pes_report_agent` which reads it as evidence of campaign trajectory.

---

### FR4.26 — Fallback Mechanism

**Principle**: Every AI-dependent call in Module 4 is wrapped in a `try-catch`. When FastAPI is unreachable, times out, or returns an error, Spring Boot falls back to a deterministic rule-based computation. **The REST response is always fully populated — the frontend never crashes.**

| Endpoint | FastAPI call | FR4.26 Fallback |
|----------|-------------|-----------------|
| `POST /manual` | `computePesFromRaw()` | Spring Boot `PESComputationService.compute()` |
| `POST /report` | `generateReport()` | `buildRuleBasedReport()` — identifies lowest-contribution metric |
| `POST /pes-analysis` | `generatePesAnalysis()` | `buildOfflinePesAnalysisFallback()` with `needs_human_review: true` |

**`PESComputationService` (Spring Boot fallback)** uses the same formula but simplified bounds:
```java
roasN = clamp01(roas / 8.0)                             // max=8×
crN   = clamp01(convRate / 15.0)                        // max=15%
cacN  = 1.0 - clamp01((cac - 1.0) / (5000.0 - 1.0))   // inverted, min=₱1 max=₱5000
ctrN  = clamp01(ctr / 10.0)                             // max=10%
cpcN  = 1.0 - clamp01((cpc - 0.01) / (500.0 - 0.01))  // inverted, min=₱0.01 max=₱500

PES = (roasN × 0.35) + (crN × 0.30) + (cacN × 0.15)
    + (ctrN × 0.15) + (cpcN × 0.05)
```

This mirrors the FastAPI formula exactly, producing consistent PES scores whether the primary or fallback path runs.

---

## API & Integration Contracts

### Spring Boot Public Endpoints (consumed by React frontend)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/analytics/metrics` | `permitAll` | Default demo campaign metrics (`?weeks=4\|8`) |
| `POST` | `/api/analytics/manual` | `permitAll` | Full pipeline: KPI compute + persist + FastAPI PES |
| `GET` | `/api/analytics/history` | `permitAll` | Last N campaign records chronological (`?weeks=4\|8`) |
| `GET` | `/api/analytics/pes/{campaignId}` | `permitAll` | PES breakdown for a campaign ID |
| `POST` | `/api/analytics/report` | `permitAll` | Prescriptive Groq report (funnel diagnostics) |
| `POST` | `/api/analytics/pes-analysis` | `permitAll` | PES deep-analysis via LangGraph agent |
| `GET` | `/api/analytics/report/{id}/pdf` | `permitAll` | Binary PDF download of a generated report |

---

#### `POST /api/analytics/manual`

**Request body**:
```json
{
  "impressions": 95000,
  "clicks": 2800,
  "adSpend": 4000.00,
  "revenue": 35000.00,
  "conversions": 185,
  "bookings": 112,
  "newCustomers": 34
}
```

**Response** `200 OK`:
```json
{
  "metrics": {
    "ctr":      { "value": 2.95, "unit": "%",  "trend": 0.4,   "isPositive": true  },
    "cpc":      { "value": 1.43, "unit": "₱",  "trend": -0.05, "isPositive": true  },
    "roas":     { "value": 8.75, "unit": "x",  "trend": 0.4,   "isPositive": true  },
    "convRate": { "value": 4.00, "unit": "%",  "trend": -0.5,  "isPositive": false },
    "cac":      { "value": 117.65, "unit": "₱", "trend": 5.0,  "isPositive": false }
  },
  "funnel": [
    { "stage": "Impressions", "value": 95000, "dropoff": null    },
    { "stage": "Clicks",      "value": 2800,  "dropoff": "-97.1%" },
    { "stage": "Conversions", "value": 185,   "dropoff": "-93.4%" },
    { "stage": "Bookings",    "value": 112,   "dropoff": "-39.5%" }
  ],
  "pes": {
    "overallScore": 0.67,
    "label": "Good Performance",
    "breakdown": [
      { "metric": "ROAS",       "weight": "35%", "contribution": 0.35 },
      { "metric": "Conv. Rate", "weight": "30%", "contribution": 0.08 },
      { "metric": "CAC (Inv)",  "weight": "15%", "contribution": 0.15 },
      { "metric": "CTR",        "weight": "15%", "contribution": 0.04 },
      { "metric": "CPC (Inv)",  "weight": "5%",  "contribution": 0.05 }
    ]
  }
}
```

---

#### `POST /api/analytics/report`

**Request body** (optional — defaults applied):
```json
{ "weeks": 4 }
```

**Response** `200 OK`:
```json
{
  "executiveSummary": "Your campaign achieved a PES of 0.67 / 1.00 (Good Performance)...",
  "funnelDiagnostics": [
    {
      "stage": "Clicks → Conversions",
      "rank": "Weakest",
      "dropRate": "88.1%",
      "insight": "Visitors who clicked showed initial interest but the landing page failed to sustain engagement — a mismatch between ad promise and destination experience."
    },
    {
      "stage": "Conversions → Bookings",
      "rank": "Moderate",
      "dropRate": "78.8%",
      "insight": "High-intent leads reached the booking step but abandoned due to form friction and insufficient social proof."
    },
    {
      "stage": "Impressions → Clicks",
      "rank": "Alright",
      "dropRate": "95.2%",
      "insight": "Broad audience targeting resulted in a high raw drop but CTR remains within acceptable range for awareness-stage campaigns."
    }
  ],
  "recommendations": [
    { "stage": "Clicks → Conversions",  "urgency": "Most Urgent", "title": "Align Landing Page to Ad Promise", "action": "Mirror headline copy from your best-performing ad..." },
    { "stage": "Conversions → Bookings", "urgency": "Urgent",      "title": "Streamline the Booking Conversion Path", "action": "Add trust signals (reviews, booking counter)..." },
    { "stage": "Impressions → Clicks",   "urgency": "Not Very Urgent", "title": "Sharpen Ad Creative Targeting", "action": "Shift 25% of ad spend from broad audiences..." }
  ],
  "recommendedPlatform": "Naver Blog"
}
```

---

#### `GET /api/analytics/history?weeks=4`

**Response** `200 OK`:
```json
{
  "snapshots": [
    {
      "periodStart": "2026-03-09", "periodEnd": "2026-03-15",
      "pesScore": 0.42, "pesLabel": "Fair Performance",
      "ctr": 2.00, "cpc": 3.75, "roas": 3.20, "convRate": 3.25, "cac": 333.33
    },
    "... 3 more weeks ..."
  ]
}
```

---

### FastAPI SBERT Internal Endpoints (consumed by Spring Boot only)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/internal/pes-compute/analyze` | Full PES pipeline: base metrics → normalize → invert → weighted sum → AI insights |
| `POST` | `/internal/pes-analysis/generate` | LangGraph PES deep-analysis agent (quality-gated) |
| `POST` | `/internal/report/generate` | Groq prescriptive report (funnel diagnostics + recommendations) |
| `POST` | `/internal/report/pdf` | Render the prescriptive report as a binary PDF |

**`POST /internal/pes-compute/analyze`** — full response schema:
```json
{
  "base_metrics":       { "CTR": 2.947, "CPC": 1.429, "CR": 4.0, "ROAS": 8.75, "CAC": 117.65 },
  "normalized_metrics": { "CTR": 0.2947, "CPC": 0.9972, "CR": 0.2667, "ROAS": 1.0, "CAC": 0.9767 },
  "pes_score":          0.6706,
  "pes_label":          "Good Performance",
  "breakdown": [
    { "metric": "ROAS",       "weight": "35.0%", "contribution": 0.35 },
    { "metric": "Conv. Rate", "weight": "30.0%", "contribution": 0.08 },
    { "metric": "CAC (Inv)",  "weight": "15.0%", "contribution": 0.1465 },
    { "metric": "CTR",        "weight": "15.0%", "contribution": 0.0442 },
    { "metric": "CPC (Inv)",  "weight": "5.0%",  "contribution": 0.0499 }
  ],
  "flagged_metrics":    [],
  "effective_weights":  { "ROAS": 0.35, "CR": 0.30, "CAC": 0.15, "CTR": 0.15, "CPC": 0.05 },
  "ai_report": {
    "weakest_funnel_stage": "Clicks → Bookings",
    "recommendations": [
      "Prioritise the 'Clicks → Bookings' funnel stage...",
      "Implement retargeting campaigns targeting visitors who clicked but did not book...",
      "Add social proof elements — verified guest reviews, a live booking counter..."
    ],
    "executive_summary": "Your campaign's Promotional Effectiveness Score is 0.67 / 1.00 (Good Performance)...",
    "source": "groq"
  }
}
```

**`POST /internal/pes-analysis/generate`** — request/response:
```json
// Request
{
  "metrics_data": {
    "CTR":  [4.50, 4.11, 3.72, 3.375],   // index 0 = current week
    "CPC":  [0.41, 0.49, 0.57, 0.62],
    "ROAS": [23.33, 19.07, 16.00, 11.82],
    "CR":   [7.00, 6.50, 6.00, 5.50],
    "CAC":  [34.29, 38.51, 45.76, 58.82]
  },
  "weeks": 4
}

// Response (final_ui_payload)
{
  "report_data": {
    "metric_conditions": [
      {
        "metric_name": "CTR",
        "current_status": "CTR has improved from 3.38% at campaign start to 4.50% this week...",
        "trend": "up",
        "peak_value": 4.50,
        "low_value": 3.375
      },
      "... 4 more metrics ..."
    ],
    "cross_metric_logic": {
      "relationships": "The improving CTR drove higher-quality traffic to the booking page...",
      "insights": "The operator should scale spend on Naver Blog retargeting to sustain this trajectory."
    },
    "ranked_weaknesses": [
      {
        "metric_name": "CR",
        "rank": 1,
        "weakness_meaning": "Despite improving CTR, a 7% booking conversion still means 93% of ad clickers leave without booking — losing ₱4,000 of ad spend potential per week.",
        "recommendation": "Add a 'Heal now, pay later' instalment option above the booking CTA on the resort landing page..."
      }
    ]
  },
  "metadata": {
    "final_score": 92,
    "total_iterations": 1,
    "needs_human_review": false,
    "warning_message": "Report passed quality checks."
  }
}
```

---

### Database Schema — Module 4 Tables

| Table | Key Columns | Purpose |
|-------|-------------|---------|
| `tbl_campaign_records` | `campaign_id UUID PK`, `impressions BIGINT`, `clicks BIGINT`, `ad_spend DOUBLE`, `revenue DOUBLE`, `conversions BIGINT`, `bookings BIGINT`, `new_customers BIGINT`, `ctr DOUBLE`, `cpc DOUBLE`, `conv_rate DOUBLE`, `roas DOUBLE`, `cac DOUBLE`, `pes_score DOUBLE`, `pes_label VARCHAR(50)`, `analysis_weeks INT`, `period_start VARCHAR(20)`, `period_end VARCHAR(20)`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ` | Every operator-submitted campaign ingestion. Populated in three stages: (1) raw inputs on insert, (2) derived KPIs after `MetricsCalculationService`, (3) PES result after FastAPI or FR4.26 fallback |

**Column lifecycle:**
```
Insert:    campaign_id, impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers, created_at
Update 1:  ctr, cpc, conv_rate, roas, cac, updated_at     ← after MetricsCalculationService.compute()
Update 2:  pes_score, pes_label, updated_at               ← after FastAPI pes-compute/analyze (or fallback)
```

**Key indexes:**
- `idx_campaign_records_created_at DESC` — supports `findAllByOrderByCreatedAtDesc(PageRequest)` for history queries
- `idx_campaign_records_pes_score WHERE pes_score IS NOT NULL` — partial index for score-tier filtering

**Seed data (V15)**: 10-week traction progression (Mar–May 2026) simulating a Cebu MSME resort Korean-market campaign:
- Weeks 1–3: **Fair Performance** (PES 0.42–0.57) — cold start, broad audience
- Week 4: **Good Performance** (PES 0.67) — KOL collaboration spike
- Weeks 5–8: **Good Performance** (PES 0.69–0.78) — retargeting + lookalike scaling
- Weeks 9–10: **Excellent Performance** (PES 0.80–0.83) — peak Korean summer season

---

## Technology Stack & Infrastructure

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend framework** | React 18 + TypeScript, Vite | Single-view dual-state design (`dashboardActive` toggle); `ManualIngestResponse` typed DTO passed as prop eliminates redundant API calls |
| **Data ingestion form** | Controlled React form + `api.analyticsManual()` | Validates non-negative inputs client-side; fires the full Spring Boot pipeline on submit; the response contains KPIs, funnel, and PES in one round-trip |
| **Chart library** | Recharts (`LineChart`, `Line`, `ReferenceLine`, `Dot`) | PES trend chart with four reference bands (0.4/0.6/0.8); custom `Dot` component for tier-colored data points; `CustomerJourneyFunnel` two-panel efficiency vs. cost split |
| **PES formula display** | Monospace span in `PESComputationBoard` header | `PES = ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05` rendered as formula label for operator transparency |
| **Spring Boot pipeline** | `MetricsCalculationService` → `CampaignRecord.from()` → `enrichWithKpis()` → `campaignRepo.save()` → `ai.computePesFromRaw()` → `enrichWithPes()` → `campaignRepo.save()` | Two-write lifecycle: raw data persisted before AI call (prevents data loss on timeout); PES enriched after FastAPI response |
| **FR4.26 fallback** | Spring Boot `PESComputationService` + `buildRuleBasedReport()` | Identical formula to FastAPI; campaign record always saved with a valid PES score; prescriptive report always returns contextual diagnostics |
| **PES computation** | FastAPI `pes_compute_service.py` — pure Python, no ML model | Deterministic weighted-sum formula; Min-Max normalization with Cebu MSME-calibrated bounds; proportional weight recalibration for missing metrics |
| **AI insights (PES compute)** | Groq API (`llama-3.3-70b-versatile`) via `gemini_client.pes_compute_insights()` | Single LLM call to identify weakest funnel stage and generate 3 ranked recommendations from the PES breakdown |
| **AI prescriptive report** | Groq API via `gemini_client.performance_report()` with business-impact-ranked funnel transitions | Pre-ranked transitions injected into Groq prompt (`Rank 1 = Weakest, do NOT re-order`); `recommendedPlatform` derived from market key before LLM call |
| **PES deep-analysis agent** | LangGraph `pes_report_agent` — 3-node quality-gated workflow | `generate_report → evaluate_report → [conditional] → finalize_response`; retries up to 3× when evaluator score < 85; evaluator feedback injected into generator prompt on retry |
| **Agent LLM** | `AgentLLMModel` singleton (`ChatGroq`, `llama-3.3-70b-versatile`) | Shared singleton with Module 3 caption agent; `with_structured_output(ReportOutput)` and `with_structured_output(EvaluationResult)` enforce Pydantic schemas on Groq JSON responses |
| **Synthetic time series** | `MetricsCalculationService.buildTimeSeries()` — linear interpolation | Generates reverse-chronological `weeks`-length series from aggregate period metrics; positive metrics baseline at 75% of current; cost metrics baseline at 130% of current |
| **Analysis windows** | `weeks: 4 | 8` binary toggle | 4-week default for near-term optimization; 8-week for trend visibility; history query uses `PageRequest.of(0, limit)` where `limit = weeks` |
| **Persistence** | `tbl_campaign_records` — three-stage write lifecycle | Raw inputs → KPIs → PES; `pes_score DOUBLE` and `pes_label VARCHAR(50)` added in V14; partial index on `pes_score` for score-tier queries |
| **Containerization** | Docker Compose — `fastapi-sbert` port 8000 (same as Modules 1, 3) | Module 4 FastAPI routes registered in `app.main` alongside Module 1 classification and Module 3 compliance routes |
| **Observability** | `[Module4]` and `[Module4 FR4.26]` log prefixes, MDC `X-Trace-Id` | Every pipeline step (campaign record saved, FastAPI PES result, fallback trigger) logged with structured context for operational monitoring |
