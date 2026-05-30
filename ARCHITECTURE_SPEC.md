# CeView — Architecture Specification

> **Audience:** Senior engineers and technical reviewers.
> **Scope:** A computation-focused deep dive into the CeView platform — its MVP, capabilities, core algorithms, result-generation formulas, and the design rationale behind each. This document complements [ARCHITECTURE.md](ARCHITECTURE.md) (system diagrams/flows) and the per-module docs under [docs/](docs/); it is the single source of truth for *how the numbers are produced and why*.

**CeView** is a full-stack, AI-assisted B2B SaaS platform that helps **Cebu (Philippines) tourism MSMEs** classify their business positioning, read live market demand, generate market-localized marketing content, and measure campaign effectiveness. The system is composed of:

| Tier | Technology | Responsibility |
|------|-----------|----------------|
| Frontend | React 19 + Vite + TypeScript (`ceview/`) | SPA, charts (Recharts), forms, gauges |
| Orchestration API | Spring Boot 3.3 / Java 21 (`backend/spring-boot/`) | REST, persistence, deterministic computation + fallbacks, AI gateway |
| AI microservice — NLP/content/PES | FastAPI (`backend/fastapi-sbert/`) | Modules 1, 3, 4 — SBERT, LangGraph, PES |
| AI microservice — forecasting | FastAPI (`backend/fastapi-transformer/`) | Module 2 — Groq forecasting, seasonality, XGBoost |
| Persistence | PostgreSQL 16 + pgvector (H2 for native dev) | Flyway-migrated relational store + embeddings |

The product is organized into **four decoupled modules** (1 Business Classification & Uniqueness, 2 Market Radar & Forecasting, 3 Content Studio & Compliance, 4 Campaign Analytics & Reporting), each with its own frontend views, Spring controllers/services, database tables, and documentation.

---

## 1. Executive Summary & MVP Definition

### 1.1 Core Problem

Cebu tourism MSMEs (dive shops, island-hopping operators, boutique stays, local eateries) compete for international arrivals but operate without the analytics infrastructure available to large chains. Concretely, they lack:

1. A **quantified** sense of how differentiated their offering is versus the local cohort.
2. **Real-time visibility** into which source markets (e.g., Korea, Japan, USA) are about to surge in travel demand.
3. **Market-localized content** (captions, creative direction) that respects platform and cultural norms — and a way to check that content is on-brand and compliant before publishing.
4. **Data-driven feedback** on campaign spend: which KPI is dragging performance and what to fix first.

### 1.2 MVP Definition

The MVP is the **end-to-end thin slice** that takes a raw business description and walks the operator through all four modules to a prescriptive action plan. It delivers value at each hop and is independently demoable:

```
Module 1            Module 2              Module 3                 Module 4
Classify +    →     Rank markets +   →    Generate localized  →    Ingest campaign +
uniqueness          forecast demand       content + compliance     PES + prescriptive
score                                     audit                    report
```

### 1.3 Minimum Functional Requirements

| Capability | Minimum requirement | Why it is in the MVP |
|-----------|---------------------|----------------------|
| Business profiling | Persist a profile (name, services, description, UVP, categories) | All downstream modules key off `business_profile_id`; nothing runs without it |
| Category & uniqueness | Auto-classify into 7 categories + produce a 0–100 uniqueness score | The product's differentiation thesis; first tangible "insight" the user sees |
| Demand forecasting | 12-week per-market demand trajectory for Korea/Japan/USA, ranked | The core market-intelligence value proposition |
| Demand alerting | Surface "demand window" notifications on the Home view | Converts forecast data into a time-sensitive call to action |
| Content generation | Produce platform-localized captions + creative direction | Turns insight into a publishable artifact |
| Compliance audit (OMCS) | Score a caption+image pair, Pass/Fail at ≥70 | Quality gate before content leaves the platform |
| Campaign analytics | Compute 5 KPIs + funnel + PES (0–100) from raw inputs | Closes the loop: measure what was launched |
| Prescriptive report | Identify weakest metric/funnel stage + ranked fixes | The "so what" — actionable guidance |
| Resilience | Deterministic Spring fallback for every AI call | MVP must demo even when AI quota/network is degraded |

---

## 2. Key Features & System Capabilities

### 2.1 Module 1 — Business Classification & Uniqueness Scoring

| Sub-module | Feature | User flow / trigger | Output |
|-----------|---------|---------------------|--------|
| 1.1 | Business profile capture | User opens **Business Profile** → fills form (word-count-validated) → Save → `PUT /api/v1/business-profile` | Persisted profile + fire-and-forget E5 embedding |
| 1.1 | Category inference | User clicks **Analyze** → `POST /api/v1/classification/analyze` | 7 category allocations summing to 100% |
| 1.2 | Uniqueness scoring | User adjusts category sliders → **Compute** → `POST /api/v1/classification/uniqueness` | `overallScore`, `semanticsScore`, `categoryScore` (0–100) + AI feedback |

### 2.2 Module 2 — Market Radar & Notifications

| Sub-module | Feature | User flow / trigger | Output |
|-----------|---------|---------------------|--------|
| 2.1 | Home demand alerts | Page load → `POST /api/v1/forecasting/ensure/{profileId}?maxAgeHours=12` (staleness-gated live pipeline) | Trend-alert cards for markets with active/upcoming 2σ spikes |
| 2.1 | Scheduled ingestion | Cron / refresh → PyTrends + World Bank + forex fetch → `tbl_market_signal_record` | Enriched weekly signal records (rolling stats, spike, YoY) |
| 2.2 | Market Radar | User opens **Market Radar** → `GET /api/v1/forecasting/markets` (DB read) | 3 ranked market cards + 24-point demand chart + economic insights |
| 2.2 | Refresh forecast | **Refresh** → `POST /api/v1/forecasting/analyze/{profileId}` | Fresh ingestion + Groq batch forecast + re-ranked markets |

### 2.3 Module 3 — Content Studio & OMCS Compliance

| Sub-module | Feature | User flow / trigger | Output |
|-----------|---------|---------------------|--------|
| 3.1 | Content generation | From a market card → `POST /api/v1/content/generate` | Platform-localized caption options (LangGraph) |
| 3.2 | Creative direction | After approval → `POST /api/v1/creative-direction/generate/{profileId}` | Shot list, mood, palette, platform guidance |
| 3.3 | OMCS compliance audit | Upload image + choose caption → `POST /api/v1/compliance/omcs-analyze` | OMCS score (0–100), Pass/Fail (≥70), failure diagnostics |

### 2.4 Module 4 — Campaign Analytics & Reporting

| Sub-module | Feature | User flow / trigger | Output |
|-----------|---------|---------------------|--------|
| 4.1 | KPI ingestion | Submit 7 raw fields → `POST /api/v1/analytics/manual` | CTR, CPC, CR, ROAS, CAC + 4-stage funnel |
| 4.2 | PES computation | Auto on ingest → FastAPI `/internal/pes-compute/analyze` (Spring fallback) | PES 0–100 + per-metric contribution breakdown |
| 4.3 | Prescriptive report | Auto-fetch on mount → `POST /api/v1/analytics/report` | Executive summary, weakest metric/stage, ranked fixes |

---

## 3. Core Algorithms & Data Structures

### 3.1 Seasonal Shift Detection

**Source:** [seasonal_shift_detector.py](backend/fastapi-transformer/app/services/seasonal_shift_detector.py)

Operates on a chronological weekly trend-index series (0–100, PyTrends-normalized). Produces the statistics the forecaster and market scorer consume.

**Constants:** `WINDOW_7D = 7`, `WINDOW_30D = 30`, `YOY_LOOKBACK = 52`, `MIN_HISTORY_FOR_YOY = 59`, `SPIKE_SIGMA_MULTIPLIER = 2.0`.

**Logical flow:**

```
compute(weekly_series):
    if empty: return neutral zeros            # "no data" must be unambiguous
    current        = weekly_series[-1]
    rolling_7d_avg  = mean(last 7)            # short-term momentum
    rolling_30d_avg = mean(last 30)           # long-term baseline
    rolling_7d_std  = population_std(last 7)  # ÷W, not ÷(W-1)
    spike           = current > rolling_7d_avg + 2 * rolling_7d_std
    yoy_ratio = None
    if len >= 59:
        prior = weekly_series[-59:-52]        # the 7 weeks ending 52 wks ago
        if mean(prior) > 0:
            yoy_ratio = rolling_7d_avg / mean(prior)
    seasonality_score = score(rolling_7d_avg, rolling_7d_std, spike, yoy_ratio)
```

**Output structure:**

| Field | Type | Meaning |
|-------|------|---------|
| `rolling_7d_avg` / `rolling_30d_avg` | float | Sliding-window means |
| `rolling_7d_std` | float | Population std-dev over last 7 |
| `spike_indicator` | bool | `TRUE` iff `current > μ + 2σ` |
| `yoy_ratio` | float \| None | `None` when < 59 weeks |
| `seasonality_score` | float 0–1 | Composite (see §4.3) |

### 3.2 LLM Demand Forecasting

**Source:** [gemini_forecaster.py](backend/fastapi-transformer/app/services/gemini_forecaster.py)

Replaces a prior BiLSTM + Transformer model with a **Groq `llama-3.3-70b-versatile`** prompt pipeline (`temperature=0.10`, `response_format=json_object`, 3-attempt exponential back-off). A single **batch** call returns all three markets at once to conserve rate-limit budget.

**Prompt construction** injects the signal series (last 12 points), rolling stats, momentum (`accelerating` if `7d > 30d`), the 2σ spike flag, YoY ratio, seasonality score, and economic context (forex, GDP latest, 5-year GDP direction). It then enforces 8 ordered **guard rules** in natural language:

| Rule | Constraint |
|------|-----------|
| 1 | All 12 weekly values distinct |
| 2 | Continue momentum, dampening toward the 7d average |
| 3 | Hard ceiling: if `current > 65`, no week may exceed 92 |
| 4 | Mean-reversion pressure on weeks 5–12 |
| 5 | If `YoY > 1.2`, apply proportional seasonal uplift |
| 6 | If `spike = YES`, revert toward 7d mean from week 2 |
| 7 | `GDP > 3%` + high seasonality → ~+3% modifier |
| 8 | Declining multi-year GDP → −2% dampener on weeks 5–12 |

**Deterministic post-processing** (in code, not the model) hardens the output:

```
parse 12 weekly values, clamp each to [5.0, 100.0]
missing week → dampened slope extrapolation from prior two values
Guard 1 (flat line): if all 12 identical → apply dampened linear tilt
Guard 2 (ceiling/floor): if >=3 values >=99.5 or <=5.5 →
    re-anchor to a linear path from first valid value toward the 7d mean
demand_4w  = mean(weekly[0:4])
demand_12w = mean(weekly[0:12])
```

### 3.3 XGBoost Economic Viability

**Source:** [xgboost_scorer.py](backend/fastapi-transformer/app/services/xgboost_scorer.py)

Scores the **economic accessibility** of a source market from 5 features. Uses a trained XGBoost `Booster` if `XGBOOST_MODEL_PATH` exists; otherwise a weighted-linear approximation (the weights double as the linear fallback coefficients).

| Feature | Normalization | Weight |
|---------|---------------|--------|
| `gdp_growth_norm` | `clamp(gdp / 5.0, 0, 1)` | 0.30 |
| `forex_norm` | `clamp(forex / 60.0, 0, 1)` (PHP per foreign unit) | 0.30 |
| `direct_flight` | `1.0` if direct else `0.0` | 0.20 |
| `distance_norm` | `max(0, 1 − min(1, dist / 15000))` | 0.10 |
| `flight_frequency_norm` | `clamp(freq / 20.0, 0, 1)` | 0.10 |

### 3.4 Composite Market Score & Chart Assembly

**Source:** [ForecastingService.java](backend/spring-boot/src/main/java/com/ceview/module2/submodule22/ForecastingService.java)

The Spring orchestrator runs the transactional pipeline (`runPipeline`): build per-market sequences → one batched Groq call → per-market XGBoost scoring → persist → rank descending. The final composite is assembled outside the AI service:

```
market_score = 0.40·(predicted_demand/100) + 0.35·seasonality_score + 0.25·economic_viability
```

**Demand-alert trigger:** with `DEMAND_WINDOW_MULTIPLIER = 1.2`, an alert is persisted when `demand_4w > rolling_average_7d × 1.2`.

**Chart assembly** always emits **exactly 24 points** (12 history + 12 forecast). Real `MarketSignalRecord` rows fill history slots newest-last (last labeled `"Current"`); when fewer than 12 exist, synthetic pads back-fill the oldest slots (`max(10, baseDemand − (padsRemaining × 3))`). Forecast slots carry the per-week Groq predictions; seasonality/forex/GDP carry the latest known values forward.

**`ChartDataPointDto` structure:**

| Field | Type | Meaning |
|-------|------|---------|
| `week` | String | `"Wk -11" … "Current" … "Wk +12"` |
| `history` | Double \| null | Observed trend index (null in forecast region) |
| `forecast` | Double \| null | Predicted index (null in history region) |
| `seasonality` | double | 0–100 (DB 0–1 × 100) |
| `forex` | double | PHP per foreign unit |
| `gdp` | double | Annual % growth |
| `spike` | double | `1.0` if spike else `0.0` |

### 3.5 OMCS Compliance Audit (Stateless LangGraph)

**Source:** [omcs_agent/node.py](backend/fastapi-sbert/app/agents/omcs_agent/node.py)

A **stateless** LangGraph DAG using a Groq **vision** model (`meta-llama/llama-4-scout-17b-16e-instruct`). Statelessness: each invocation is self-contained, no session store; nodes return only their computed contributions; routing is deterministic.

```
node_profile_diff      → profile_semantic_score (stub 85.5)
node_evaluate_rubric   → 7-dimension vision rubric → recommendations_picture_score (rubric "total")
node_check_consistency → caption↔image consistency_score (0–100)
node_calculate_omcs    → OMCS, status = Pass if OMCS >= 70 else Fail
route_omcs_outcome     → PASS terminates; FAIL routes to node_generate_feedback
```

The 7 rubric dimensions: `visual_business_context_match`, `visual_intent_consistency`, `tone_visual_mood_alignment`, `psychological_strategy_support`, `target_audience_fit`, `platform_suitability`, `attribute_coverage_consistency`.

### 3.6 PES (Promotional Effectiveness Score)

**Source:** [pes_compute_service.py](backend/fastapi-sbert/app/services/pes_compute_service.py)

A 4-step deterministic pipeline: derive KPIs → Min-Max normalize against Cebu-calibrated bounds → invert cost metrics → weighted sum with edge-case weight recalibration (see §4.2).

### 3.7 Uniqueness / Classification (Module 1)

Business descriptions are embedded (E5/SBERT, 768-dim, stored in `tbl_business_embedding`) and compared by cosine similarity against the Cebu MSME cohort to produce `overallScore` / `semanticsScore` / `categoryScore`. Qualitative feedback is produced by the LLM path when enabled; deterministic numeric stubs back the offline path.

### 3.8 Key Data Structures (Persistence)

| Table | Role | Notable fields |
|-------|------|----------------|
| `tbl_business_profile` | MSME profile | `business_name`, `categories`, `uniqueness_score` |
| `tbl_business_embedding` | Uniqueness corpus | 768-dim pgvector |
| `tbl_market_signal_record` | Weekly ingested signal | `trend_index`, `rolling_average_7d/30d`, `rolling_std_dev`, `spike_indicator`, `yoy_ratio`, `seasonality_score`, `forex_rate`, `gdp_growth` |
| `tbl_forecast_result` | Forecast per horizon | `predicted_demand`, `forecast_confidence`, `mape/mae/rmse`, `forecast_horizon_weeks` (4 or 12), `weekly_forecasts_json` |
| `tbl_market_score` | Composite viability | `market_score`, `seasonality_score`, `spike_indicator`, `gdp_per_capita_growth`, `forex_vs_php`, `market_rank` |
| `tbl_demand_alert` | Home notifications | `alert_level`, `alert_message`, `trend`, `is_read`, `window_open_date` |
| `tbl_compliance_evaluation_result` | OMCS audit | `cas_score`, `vas_score`, `omcs_score`, `revision_number`, `mismatches` |
| `tbl_campaign_records` | Campaign lifecycle | raw inputs → derived KPIs → PES |

---

## 4. Computations & Result Generation

### 4.1 Engagement KPIs (Module 4)

| Metric | Formula | Zero-denominator handling |
|--------|---------|---------------------------|
| CTR | `(clicks / impressions) × 100` | `0.0`, flagged `"CTR (impressions = 0)"` |
| CPC | `ad_spend / clicks` | `0.0`, flagged |
| CR | `(bookings / clicks) × 100` | `0.0`, flagged |
| ROAS | `revenue / ad_spend` | `0.0`, flagged |
| CAC | `ad_spend / new_customers` | `0.0`, flagged |

### 4.2 PES — Promotional Effectiveness Score

**Min-Max bounds (Cebu MSME hospitality, ₱):**

| Metric | Min | Max | Cost-inverted? |
|--------|-----|-----|----------------|
| CTR | 0.0 | 10.0 | No |
| CPC | 0.01 | 500.0 | Yes |
| CR | 0.0 | 15.0 | No |
| ROAS | 0.0 | 8.0 | No |
| CAC | 1.0 | 5,000.0 | Yes |

**Steps:**
```
n = clamp((raw − lo) / (hi − lo), 0, 1)
if metric in {CPC, CAC}: n = 1 − n          # lower cost → higher contribution
```

**Full weighted sum (no flags):**
```
PES = ROAS·0.35 + CR·0.30 + CAC_inv·0.15 + CTR·0.15 + CPC_inv·0.05
```

**Edge-case recalibration (FR4.26):** flagged metrics are excluded and the remaining active weights are renormalized to sum to 1.0:
```
effective_weight(k) = base_weight(k) / Σ(base_weight of active metrics)
```

**Label bands:** `≥0.80` Excellent · `≥0.60` Good · `≥0.40` Fair · else Poor.

| Inputs | Outputs |
|--------|---------|
| impressions, clicks, ad_spend, revenue, conversions, bookings, new_customers | `score` (0–1), `label`, per-metric `breakdown` (metric, weight%, contribution) |

### 4.3 Seasonality Score

```
# YoY available (≥59 weeks):
score_base = clamp(0.82 + (yoy_ratio − 1.0) × 1.0, 0, 1)

# No YoY yet — stability proxy via coefficient of variation cv = σ/μ:
score_base = max(0.25, min(0.65, 0.65 − cv × 0.50))   # capped at "Weak/emerging"

# Spike disambiguation:
spike=FALSE                        → no change
spike=TRUE  and yoy_ratio >= 1.0   → no change (confirmed seasonal inflection)
spike=TRUE  and yoy < 1.0 / None   → score = max(0, score_base − 0.40)  (isolated anomaly)
```

**Bands:** `0.85–1.00` Strong · `0.70–0.84` Moderate · `0.40–0.69` Weak/emerging · `0.00–0.39` None.

### 4.4 Spike & Year-over-Year

```
spike     = current > rolling_7d_avg + 2 · rolling_7d_std         # population σ
yoy_ratio = rolling_7d_avg(t) / rolling_7d_avg(t − 52 weeks)      # requires ≥59 weeks
```

### 4.5 Composite Market Score & Alert

```
market_score = 0.40·(predicted_demand/100) + 0.35·seasonality + 0.25·economic_viability   # clamped [0,1]
match_score  = round(market_score × 100)                                                    # display 0–100
demand alert ⇔ demand_4w > rolling_average_7d × 1.2
```

### 4.6 Forecast Error & Validation Metrics

These are **synthetic confidence proxies** derived from the near-term deviation, not backtested errors:

```
delta      = |demand_4w − current|
MAPE       = min(14.9, 7.0 + delta × 0.08)
MAE        = MAPE × 0.60
RMSE       = MAPE × 0.85
confidence = max(0.70, 1.0 − MAPE/100)
passed     = MAPE <= 15.0   (else low-confidence disclaimer)
```

### 4.7 Economic Viability

```
economic_viability = Σ weight(i) · feature_norm(i)          # linear fallback
                   = Booster.predict(DMatrix(features))     # when XGBoost model present
# clamped to [0, 1]; weights = GDP 0.30, Forex 0.30, Direct 0.20, Distance 0.10, Freq 0.10
```

### 4.8 OMCS Score

```
OMCS = 0.35 · profile_semantic_score
     + 0.45 · (recommendations_picture_score × 100)   # rubric "total", scaled in node_calculate_omcs
     + 0.20 · pubmat_consistency_score
status = Pass if OMCS >= 70 else Fail
```

---

## 5. Design Rationale (The "Why")

### 5.1 LLM-prompt forecasting over BiLSTM/Transformer

- **Why:** Per-MSME, per-market trend series are short and sparse — there is no realistic training set to fit a sequence model that generalizes across thousands of niche operators. A prompted LLM with explicit, ordered guard rules produces a plausible, *interpretable* trajectory without per-tenant training, and the **batch** call (all markets in one request) keeps the free-tier RPM budget viable.
- **Trade-offs:** Accuracy vs. operability. The model can hallucinate flat lines or rail-to-ceiling values, so the output is hardened by two deterministic guards (flat-line tilt, ceiling/floor re-anchoring) and clamping. The reported MAPE/MAE/RMSE are **synthetic proxies** (§4.6), not true holdout errors — an explicit accuracy concession in exchange for zero training infrastructure and sub-10s latency.
- **Discarded:** A trained sequence model (higher peak accuracy) was rejected for cold-start infeasibility and operational weight; a pure statistical extrapolation (ARIMA/Holt-Winters) was rejected because it cannot fuse qualitative economic/seasonal context the way a prompted model can.

### 5.2 2σ population std + 52-week YoY for seasonality

- **Why:** `mean + 2σ` is the conventional statistical outlier boundary — cheap, explainable, and threshold-free to tune. YoY at a 52-week lookback answers the one question that disambiguates a *seasonal* surge from a *viral* one: "did this same calendar window spike last year too?" The `−0.40` penalty when a spike is **not** YoY-confirmed prevents a one-off news/viral event from masquerading as a recurring pattern and polluting forecasting input.
- **Trade-offs:** Cold-start vs. correctness. YoY needs ≥59 weeks; until then the score is derived conservatively from the coefficient of variation and **capped at 0.65** ("Weak/emerging") so the system never over-claims seasonality it cannot yet confirm. Population std (÷W) is used deliberately to match the SDD's calibrated sample values, accepting slight bias on tiny windows for spec fidelity.
- **Discarded:** FFT peak-ratio seasonality (the prior approach) needed long, clean series and produced opaque scores; it was replaced by the YoY-anchored, human-interpretable formula.

### 5.3 Composite weightings (40/35/25, OMCS 35/45/20, PES 35/30/20/15/5)

- **Market score (0.40/0.35/0.25):** Predicted demand dominates because the product's primary promise is "when is this market about to move." Seasonality is the second-strongest signal (recurrence implies confidence), and economic viability is a meaningful but secondary accessibility modifier — it should *tilt*, not *decide*, the ranking.
- **PES (ROAS 0.35, CR 0.30, CAC 0.15, CTR 0.15, CPC 0.05):** Outcome metrics (return and conversion) are weighted far above funnel-top vanity metrics (CTR/CPC), because an MSME's scarce budget should be judged on revenue and bookings, not clicks. **Cost metrics are inverted** so "lower cost ⇒ higher contribution" reads intuitively in a single 0–1 scale. The **proportional weight recalibration** preserves the full 0–1 range when a metric is incalculable (e.g., zero new customers), avoiding an artificially deflated score from a structurally-missing input.
- **OMCS (0.35/0.45/0.20):** The rubric (visual↔recommendation alignment) carries the largest weight because it most directly measures "does the asset execute the strategy"; profile-semantic match and caption↔image consistency are supporting checks.
- **Trade-offs:** All weight vectors are domain-calibrated heuristics, not learned — chosen for transparency and stakeholder defensibility over statistical optimality.

### 5.4 Min-Max over z-score normalization (PES)

- **Why:** Min-Max with **industry-calibrated bounds** yields a bounded, interpretable `[0,1]` contribution per metric and lets domain knowledge ("₱500 CPC is the practical worst case for Cebu MSMEs") set the scale directly. A z-score would require a stable population mean/variance the platform does not yet have and would produce unbounded, less intuitive values.
- **Trade-off:** Hard-coded bounds must be re-tuned as the market shifts; values outside the calibrated range are clamped, compressing extreme performers.

### 5.5 Stateless LangGraph compliance audit

- **Why:** A stateless DAG (no session store, nodes return only their own contributions, deterministic routing) is trivially reproducible and horizontally scalable — any worker can serve any audit, and identical inputs yield identical control flow. Routing terminates immediately on Pass and only spends a feedback-LLM call on Fail.
- **Trade-off:** Statelessness means inputs are re-echoed/recomputed each call rather than cached across a session — a modest compute cost accepted for reproducibility and scaling simplicity. The current `profile_semantic_score` is a node stub (85.5), an explicit MVP placeholder pending the full semantic comparator.

### 5.6 Deterministic Spring fallbacks for every AI call

- **Why:** The MVP must remain demoable when Groq/PyTrends quota or network is degraded. Every AI hop has a Spring-side deterministic counterpart (PES, report, baseline sequences), and the forecasting pipeline degrades to safe baseline cards rather than a 500.
- **Trade-off:** **Availability over peak fidelity** — fallback outputs are intentionally coarser than the AI path, surfaced honestly to the user (low-confidence disclaimers, MAPE warnings) rather than presented as equivalent.

### 5.7 Fixed 24-point chart contract

- **Why:** A stable "12 history + 12 forecast" shape lets the frontend render deterministically regardless of how much real history exists; synthetic pads (gentle declining gradient) avoid a misleading flat baseline on a brand-new profile while keeping the visual honest.
- **Trade-off:** Early-life charts mix synthetic and real points; the `spike` flag is only ever set on real records, so synthetic pads never raise false alerts.

---

*End of specification.*
