# Software Test Document

**CeView**

CEBU INSTITUTE OF TECHNOLOGY - UNIVERSITY

COLLEGE OF COMPUTER STUDIES

Document version: **1.1**

Test execution and review date: **27 October 2026 (Asia/Manila)**

Repository baseline: `1d5664b82946881c11bcb27996c3eec38905047f`

Prepared for: Cebu Institute of Technology - University, College of Computer Studies

This revision replaces the September 26 execution snapshot with current test evidence. It retains the original test-case identifiers and inherited requirements mapping, and adds the implemented publishing, attribution, voucher, and public-demo surfaces.

**Release assessment: Final acceptance is not yet supported.** Reproduced automated test failures and unmeasured acceptance criteria remain. Environment installation problems are excluded from defect findings and reported test totals.

<!-- PAGE -->

## Change history

| Version | Date | Description |
|---|---|---|
| 1.0 | 26 September 2026 | Original supplied PDF; historical frontend/Spring failures and blocked Python execution. |
| 1.1 | 27 October 2026 | Dependencies installed; current suites rerun; old incidents reassessed; new feature coverage and evidence indexed; setup failures excluded from findings. |

## Contents

1. Document purpose
2. Scope and test basis
3. Test strategy and status definitions
4. Test environment and execution summary
5. Test-case specification and current results
6. Requirements traceability matrix
7. Incident and defect log
8. Evidence index
9. Coverage assessment and release recommendation
10. Required regression and completion plan
11. Approval record

### Reading the results

A passing component or mocked integration test establishes the behavior asserted by that test. It does not establish successful live AI inference, real social-platform delivery, model accuracy, production security, or complete user acceptance.

Only the dependency-complete executions in Section 4 contribute to current results. Focused reruns are corroborating evidence and are not added to full-suite totals. Test inventory and historical verification records are not executions.

<!-- PAGE -->

## 1. Document purpose

This document records the current test status of CeView and connects product features, test cases, executions, findings, and supporting evidence. It updates the supplied Software Test Document rather than treating its September failures or totals as current.

The intended traceability is: requirements baseline → implemented feature → test scenario → execution result → evidence and outstanding acceptance work.

## 2. Scope and test basis

CeView is a browser-based, multi-tenant tourism-demand intelligence and AI-assisted marketing platform for Cebu tourism MSMEs. Testing covers its active React frontend, Spring Boot orchestration API, classification/content FastAPI service, demand FastAPI service, and selected browser workflows.

The four modules are business classification and uniqueness; market intelligence and alerts; localized content, compliance, and publishing; and campaign performance and reporting. Cross-cutting scope includes authentication, email verification, password reset, tenancy, attribution, and public screens.

The current basis is the repository at the revision printed on the cover, including ARCHITECTURE.md, ARCHITECTURE_SPEC.md, backend/CONTRACT.md, service configurations, and executable tests. The frozen ceview/ frontend is excluded.

The supplied PDF contains the FR1.1–FR4.27 and FR3.25.1–FR3.25.5 mapping and quantitative NFR targets. Separate approved SRS/SDD files were not supplied for this revision. Those identifiers and targets are retained as inherited traceability, not represented as independently revalidated requirements. New features use extension case IDs until the requirements owner assigns formal identifiers.

### 2.1 Baseline discrepancies and implementation changes

- Forecasting selects `stub`, `groq`, or `bilstm`. The local default is a deterministic placeholder; passing adapter tests does not validate demand-prediction accuracy.
- The content/report implementation and tests reject fabricated fallback output. The original PDF attributes rule-based fallback requirements to FR3.30 and FR4.26. Approval of the requirements reconciliation is still needed; this is a baseline issue, not a newly reproduced runtime failure.
- OMCS now uses a 0–100 scale, weighted profile/rubric/consistency scores (35%/45%/20%), and a pass threshold of 70. The original 0.60/0.80 band scenario no longer describes the implemented calculation. Current rubric and threshold tests replace that execution expectation; requirements reconciliation remains explicit.
- Classification uniqueness uses a reference cohort and percentile-based behavior. Reference profiles must be usable as comparison material without entering operator-facing jobs.
- Publishing now includes media storage, Meta Page/Instagram connections, TikTok inbox handoff, scheduling, durable job checkpoints, and post insights. Meta ads are created paused for operator review; TikTok inbox delivery is not equivalent to a public post.
- Attribution now includes tracked links, hosted enquiries, booking outcomes, manually logged evidence, statistical lift, and walk-in vouchers. Workspace membership/invitations still lack a backend.

<!-- PAGE -->

## 3. Test strategy and status definitions

### 3.1 Test levels

| Level | Scope and evidence |
|---|---|
| Unit/component | Vitest, pytest, and JUnit validate rendering, validation, formulas, state transitions, and error handling. |
| API/integration | Spring MockMvc/H2 and Python integration tests exercise contracts and services. Dedicated PostgreSQL checks cover migrations, locking, and reference-corpus queries. |
| Browser | Selected Chromium desktop/mobile/alternate-environment tests exercise public pages and publishing UI. Publishing tests intercept platform/API responses; they do not contact real platforms. |
| Static/build | TypeScript checking and a Vite production build validate compilation and packaging. |
| Acceptance/non-functional | Existing security and UI checks are reviewed; model accuracy, live delivery, load, formal usability, and production operations need separate acceptance evidence. |

### 3.2 Scenario selection

Scenarios include valid/invalid/missing data; score boundaries and zero denominators; unauthorized/cross-tenant access; stale cache and provider failure; replayed OAuth state; duplicate publishing requests; partial delivery and retry; missing insights; booking provenance; and simulated demo behavior. All automated suite counts are case counts, not requirements-coverage percentages.

### 3.3 Status definitions

| Status | Meaning in this revision |
|---|---|
| Pass | Fresh execution satisfies the cited assertions within the stated test scope. |
| Fail | A current dependency-complete run reproduces an assertion failure or behavioral mismatch. A test defect remains distinguishable from a product defect. |
| Partial | Automated evidence exists, but failure, live integration, or an unmeasured criterion prevents full acceptance. |
| Not executed | The acceptance scenario was not run in this audit. This is not an application defect. |
| Skipped | The runner explicitly skipped a case. Skipped cases are never counted as passed. |
| Gap | No sufficient acceptance evidence was established for the stated criterion. |
| Baseline conflict | The inherited requirement differs from current intentional implementation and needs owner review. |
| Historical | A previous run or narrative record; excluded from current pass/fail totals. |

### 3.4 Evidence policy

Installed dependencies and runtime setup are prerequisites, not findings. Superseded runs made before installation are excluded. Missing live-account or quantitative acceptance evidence is recorded as scope/coverage, not disguised as a failing implementation test. No production deployment, real social post, paid-ad launch, or live acceptance certification was performed.

<!-- PAGE -->

## 4. Test environment and execution summary

| Item | Executed configuration |
|---|---|
| Host | macOS / Darwin arm64; zsh; Node.js 24.18.0 |
| Frontend | React 19; TypeScript 5.8.3; Vite 6.4.3; Vitest 4.1.11; jsdom |
| Java | OpenJDK 21.0.13.0.2; Maven Wrapper; Spring Boot 3.3; default H2 test suite |
| Python | Separate Python 3.12.13 environments; declared service and test requirements installed; resolved packages recorded |
| Model | Public multilingual-e5-base downloaded into a temporary cache; hosted inference replaced by test doubles where defined by tests |
| Database | Disposable pgvector/PostgreSQL 16 container; Flyway V56; checked-in reference embedding dump loaded for cohort checks |
| Browser | Playwright 1.62.1; configured Chromium desktop/mobile/alternate frontend projects; platform responses mocked in publishing specs |
| Build | Production Vite output written to a temporary audit directory; no deployment |

### 4.1 Current execution results

| Run | Activity | Actual result | Status |
|---|---|---|---|
| EX-01 | Full default Vitest suite | 148 files: 145 passed, 3 failed. 1,281 cases: 1,272 passed, 9 failed. | Fail |
| EX-01R | Three failing frontend files | 85 cases: 76 passed, same 9 failed. | Fail (repeat) |
| EX-02 | TypeScript and production build | Both commands exit 0. | Pass |
| EX-03 | Full Java/H2 suite | 913 cases: 911 passed, 1 failed, 1 optional PostgreSQL case skipped. | Fail |
| EX-03R | Forecast controller reproduction | 4 cases: 3 passed, same timestamp-format failure reproduced. | Fail (repeat) |
| EX-04 | Classification/content pytest | 161 collected: 151 passed, 10 seeded-cohort cases skipped. | Pass for executed cases |
| EX-04P | Seeded PostgreSQL cohort tests | All 10 previously skipped cases passed. | Pass |
| EX-05 | Demand-service pytest | 81 passed; no failures or skips. | Pass |
| EX-06 | Selected public/publishing browser cases | 63 cases: 60 passed, 3 failed, no skips. | Fail |
| EX-07 | Optional PostgreSQL publishing test | 1 failed: current migration V56 differs from hardcoded V52 expectation. | Fail |

Across distinct executed cases: **2,485 passed and 14 failed (2,499 total)**. Focused repeats are excluded. The ten Python skips were subsequently passed in EX-04P; the optional Java skip was subsequently executed and failed in EX-07. No passing status is inferred for unselected E2E or live-contract cases.

### 4.2 Inventory and selection limits

Source inventory: **152 frontend test files** (148 in the default suite and 4 live-contract files), **127 Java test classes**, **25 classification/content Python test files**, **11 demand Python test files**, and **46 Playwright spec files**. These are file counts, not executed cases.

Playwright discovery lists **498 project cases**: 475 Chromium, 22 mobile Chromium, and 1 alternate-environment Chromium. **38 are declared skipped**. Discovery's `expectedStatus=passed` is an expectation, not an observed pass. The optional degraded-service project is excluded from this default inventory.

Only the selected browser cases in the execution table were run. Live authenticated browser journeys, the four frontend contract files (14 declared test cases), and the full browser matrix are not claimed as passed. No latest GitHub Actions run was fetched or certified.

### 4.3 Historical comparison

The supplied PDF recorded 589 frontend passes/3 failures and 351 Spring passes/8 failures/4 errors on September 26. The repository's October 20 social-publishing verification note records 988 Vitest passes/14 skips, 737 ordinary Java passes plus one optional PostgreSQL pass, and six browser passes. These records show prior progress but are excluded from the current totals and do not close a current failure.

<!-- PAGE -->

## 5. Test-case specification and current results

Case identifiers from version 1.0 are retained. A Pass below applies to the cited automated scenario, while live-model and end-to-end acceptance limits are stated separately. Detailed case-level results are included in the evidence files.

### 5.1 Authentication, authorization, and tenancy

| ID | Scenario and expected behavior | Current result / evidence |
|---|---|---|
| TC-SEC-01 | Valid/invalid sign-in, missing JWT, email verification, reset and profile gates; reject unauthorized access. | Pass: current authentication/security JUnit classes pass in EX-03, and frontend auth/verification tests pass in EX-01. |
| TC-SEC-02 | Access another operator's data; exclude reference profiles from operator-facing jobs. | Pass: ReferenceProfileIsolationTest and tenant-scoping tests pass in EX-03; the scheduler uses findAllNonReference(). Reference cohort query checks pass in EX-04P. |
| TC-SEC-03 | CORS, token encryption, required secrets, OAuth state ownership/replay, connection persistence. | Pass: current security/CORS/crypto/OAuth assertions pass in EX-03. Live provider consent is outside this result. |
| TC-SEC-04 | Dynamic injection/XSS/CSRF and a complete role matrix across user inputs. | Gap: control-level tests do not constitute a comprehensive dynamic security assessment. No such acceptance run was completed. |

Additional source coverage includes AuthControllerEmailVerificationTest, EmailVerificationFlowIntegrationTest, PasswordPolicyTest, AuthRateLimiterTest, ProfileCompletionFilterTest, RequiredSecretsEnvironmentPostProcessorTest, TokenCipherTest, AdCallbackSecurityTest, and SocialConnectionServiceTest. Frontend auth, password-policy, verification, and profile-gate suites are included in EX-01.

All public traveler, OAuth callback, authentication, and development-media routes must be assessed according to their explicit access model. The statement “every route requires a JWT” is not a valid test expectation for this application.

### 5.2 Module 1 — business classification and uniqueness

| ID | Scenario and expected behavior | Current result / evidence |
|---|---|---|
| TC-M1-01 | Submit valid business data; classify and persist under the authenticated business. | Partial: profile/classification controllers pass in EX-03 and Python classification/uniqueness tests pass in EX-04; no live hosted-classifier end-to-end run. |
| TC-M1-02 | Reject missing/empty onboarding data and invalid step advancement. | Pass: onboarding validation/component suites in EX-01. |
| TC-M1-03 | Display and adjust inferred categories; retain operator selections. | Pass for component/contract assertions in EX-01/EX-04; live onboarding/classifier journey not executed. |
| TC-M1-04 | Compute cohort-based scores without leaking reference rows into operator workflows. | Pass for automated scope: reference isolation/uniqueness controllers in EX-03, semantic/percentile tests in EX-04, and all ten seeded-cohort query tests in EX-04P. |
| TC-M1-05 | Distinguish generic/specific descriptions and support valid score boundaries. | Partial: semantic/percentile and real-encoder characterization tests pass in EX-04; no live hosted-classifier onboarding acceptance run. |
| TC-M1-06 | Download a readable uniqueness report with score/comparison data. | Gap: no sufficient executable download acceptance evidence established. |
| TC-M1-07 | Achieve classifier accuracy ≥85% on a versioned labeled Philippine-tourism set. | Gap: unit/encoder tests are not a scored classifier-accuracy evaluation. |

<!-- PAGE -->

### 5.3 Module 2 — ingestion, forecasting, scoring, and alerts

| ID | Scenario and expected behavior | Current result / evidence |
|---|---|---|
| TC-M2-01 | Ingest weekly/category data with correct normalization, statistics, provenance and persistence. | Pass: cadence, category, backfill, provenance and schema suites in EX-03; seasonality/contract tests in EX-05. |
| TC-M2-02 | Preserve last-known-good macro data and label its origin correctly when live retrieval fails. | Pass: EconomicLastKnownGoodTest and related macro-provenance tests in EX-03; old failure not reproduced. |
| TC-M2-03 | Report unavailable macro inputs explicitly instead of inventing data. | Pass: missing-input/provenance and explicit unavailable-error assertions in EX-03/EX-05. |
| TC-M2-04 | Produce valid forecast contracts, rankings and chart data from adequate history. | Partial: core forecast assertions pass; one JWT controller response assertion expects timestamp seconds while the response omits zero seconds. EX-03/EX-03R; INC-018. |
| TC-M2-05 | Refresh stale data and avoid unnecessary recalculation for fresh data. | Pass for EnsureFreshForecastTest in EX-03. The separate JWT ensure-response format assertion fails (INC-018); freshness calculations are not shown to fail. |
| TC-M2-06 | Show honest confidence/model provenance and required disclaimer when quality is unverified. | Partial: contract/no-fabrication tests pass in EX-05; full acceptance of the inherited MAPE/disclaimer criterion is unmeasured. |
| TC-M2-07 | Detect first threshold crossing and handle exact numerical boundaries. | Pass: DemandAlertRulesTest uses floating-point tolerance and passes in EX-03; September boundary failure not reproduced. |
| TC-M2-08 | Render alerts/rankings/charts and preserve state on refresh/read failures. | Fail: six forecastStore assertions expect five alerts but the fixture supplies eight; reproduced by EX-01R. Other dashboard/radar assertions pass. See INC-012. |
| TC-M2-09 | Continue scheduled ingestion when one profile fails and log forecast attempts/outcomes. | Pass: MarketDataIngestionJobForecastTriggerTest and related scheduling assertions pass in EX-03. |
| TC-M2-10 | Forecast MAPE ≤15% on a held-out series, or fulfill the approved disclaimer rule. | Gap: no held-out model evaluation was performed; adapter tests do not establish accuracy. |

EX-05 exercises forecast contracts, stub determinism, seasonality, imputed-history handling, forex scoring, unavailable errors, no trend stubs, and the hosted BiLSTM adapter with a fake Gradio client. That avoids consuming live inference quota and validates serialization/normalization, not the hosted model's statistical quality.

The six cache-related failures share an observable fixture-count mismatch. They do not by themselves prove missing live alerts or incorrect forecast values. Resolve the intended fixture/test contract before changing product logic.

<!-- PAGE -->

### 5.4 Module 3 — content, creative direction, compliance and publishing

| ID | Scenario and expected behavior | Current result / evidence |
|---|---|---|
| TC-M3-01 | Generate localized captions/direction using business and market context without fabricated sources. | Partial: Python generation/input/no-fallback tests pass in EX-04; frontend assertions run in EX-01. Live model quality remains unmeasured. |
| TC-M3-02 | Regenerate/edit/approve/save content; preserve and update saved work correctly. | Fail: two saved-draft UI cases cannot find “Save changes”; draft JSON round-trip also fails. EX-01 and EX-01R; INC-013/014. |
| TC-M3-03 | Generate/refine creative direction and display actionable guidance. | Pass for automated frontend/Python assertions in EX-01/EX-04; live creative-direction acceptance not executed. |
| TC-M3-04 | Validate media and compliance input; show scores and explanations. | Partial: rubric, profile alignment, rate-limit/input handling, and UI assertions pass; full live multimodal acceptance not executed. |
| TC-M3-05 | Validate current 0–100 OMCS weighting and pass boundary at 70. | Pass: test_omcs_rubric_scoring.py checks scale, clamp, mean, weights, ≥70 pass and 69 fail in EX-04. Original 0.60/0.80 bands need baseline review. |
| TC-M3-06 | Content/compliance provider unavailable: disclose error, do not fabricate output. | Pass against implemented no-fallback policy in EX-04; Baseline conflict with inherited FR3.30 remains. |
| TC-M3-07 | Upload/complete media; enforce ownership, supported formats and stored size. | Pass: media/storage/ownership tests in EX-03 and frontend upload/composer tests in EX-01. Live public media serving still requires deployment verification. |
| TC-M3-08 | Connect Meta Page/Instagram and TikTok; enforce ownership and honest provider states. | Partial: automated client/controller/UI tests exist; browser reconnect/unconfigured-provider case fails its TikTok locator (EX-06, INC-017). No live consent certification. |
| TC-M3-09 | Publish/schedule/cancel idempotently; persist delivery checkpoints and handle ambiguous writes. | Partial: Java publishing-service/client tests and routed scheduling/failed/inbox browser scenarios pass. EX-07 fails its migration-version assertion before the concurrent dispatcher claims run. |
| TC-M3-10 | Prepare paid ads with valid budgets/owned attribution; keep remote objects paused. | Partial: browser paid-ad scenario cannot enable the paid-ad checkbox (EX-06, INC-016); live Meta acceptance remains unverified. |
| TC-M3-11 | Translate captions while preserving source and platform behavior. | Pass: translation/API contract component tests in EX-01 and Python translation tests in EX-04. Live linguistic quality not evaluated. |
| TC-M3-12 | Serialize/reload saved drafts, media and audits; require renewed publish authorization. | Partial: most payload tests pass; one JSON round-trip equality case fails in EX-01/EX-01R (INC-014). |

TC-M3-07–12 extend version 1.0. Publishing browser cases use intercepted API responses. TikTok inbox confirmation and paused Meta ad creation are intentionally different from public delivery and ad launch.

<!-- PAGE -->

### 5.5 Module 4 — analytics, PES, reporting and attribution

| ID | Scenario and expected behavior | Current result / evidence |
|---|---|---|
| TC-M4-01 | Load/manual-submit campaign data and render KPI/funnel results. | Pass for current frontend ingestion/KPI tests in EX-01; September manual-ingestion timeouts did not recur. |
| TC-M4-02 | Reject invalid values; handle zero denominators and missing metrics honestly. | Pass for frontend validation, no-data and metric calculations in EX-01. |
| TC-M4-03 | Sync ad insights; expose empty/error states and preserve typed input on errors. | Pass for mocked client/controller/sync assertions in EX-03 and frontend error-preservation tests in EX-01. Real account insight availability is not certified. |
| TC-M4-04 | Normalize/weight PES and recalculate for changed data/date windows. | Pass for current frontend PES/calculation/date-range tests in EX-01. Quantitative model/report validity is separate. |
| TC-M4-05 | Build report context including funnel, campaign metrics and booking provenance. | Partial: report/no-fabrication/provenance Python tests pass in EX-04; no scored live recommendation-quality run. |
| TC-M4-06 | Download a readable report and regenerate it with current data. | Gap: current unit tests do not establish end-to-end downloaded-file correctness and replacement behavior. |
| TC-M4-07 | Report provider unavailable: disclose failure without invented recommendations. | Pass against no-fallback implementation in EX-04; Baseline conflict with inherited FR4.26 remains. |
| TC-M4-08 | Diagnostic alignment ≥90% on standardized marketing scenarios. | Gap: no scored scenario set or acceptance result produced. |
| TC-M4-09 | Track links/clicks, receive enquiries, log outcomes and aggregate tenant-owned evidence. | Pass for tenant-scoped link/enquiry/outcome/rollup assertions in EX-03 and frontend evidence views in EX-01. Full live traveler journey not executed. |
| TC-M4-10 | Redeem walk-in vouchers safely and show attribution separately from surge codes. | Pass: VoucherRedemptionServiceTest/CvLaunchVoucherTest in EX-03 and voucher/overlay UI tests in EX-01. |
| TC-M4-11 | Sync post insights; preserve unavailable metrics as unavailable rather than invented zeroes. | Pass: PostMetricsClient/Controller/SyncJob tests in EX-03 and post-analytics UI tests in EX-01; actual platform insight availability remains a live check. |

### 5.6 Public experience and unfinished collaboration

| ID | Scenario and expected behavior | Current result / evidence |
|---|---|---|
| TC-PUB-01 | Public landing/legal/lead-form routes render and validate correctly across selected layouts. | Partial: EX-06 passes most public-page cases; mobile menu expects an absent “Request a Demo” link (INC-015). |
| TC-PUB-02 | Public demo uses isolated sample state and blocks backend/publishing side effects. | Pass for DemoRoot and demoMode component/service tests in EX-01. A full dedicated demo browser tour was not run. |
| TC-PUB-03 | Workspace membership/invitations have a functional backend and role controls. | Gap: backend implementation remains absent; unavailable-state tests do not establish feature completion. |

<!-- PAGE -->

## 6. Requirements traceability matrix

The identifiers and meanings below are inherited from the supplied PDF. They preserve traceability without claiming access to an independently approved current SRS. Status summaries refer to Section 5 and the fresh evidence in Section 4.

### 6.1 Functional requirements — Modules 1 and 2

| Requirement(s) | Feature / case mapping | Current assessment |
|---|---|---|
| FR1.1 | Business input — TC-M1-01/02 | Automated validation evidence; live end-to-end acceptance partial. |
| FR1.2–FR1.4 | Categories/adjustment — TC-M1-01/03/07 | Component/API evidence; ≥85% accuracy remains a gap. |
| FR1.5–FR1.8 | Uniqueness/comparison — TC-M1-04/05 | Current cohort/semantic evidence; live comparison acceptance partial. |
| FR1.6 | Tenant persistence — TC-M1-01, TC-SEC-02 | Isolation assertions pass in EX-03; live end-to-end acceptance not claimed. |
| FR1.9 | Uniqueness download — TC-M1-06 | Gap. |
| FR2.1–FR2.7 | Ingestion/statistics/provenance — TC-M2-01/02/03/09 | Current relevant Java/Python assertions pass; September failures not reproduced. |
| FR2.8–FR2.10 | On-demand forecasts — TC-M2-04/05 | Adapter/contract coverage; live prediction quality partial. |
| FR2.11 | Confidence/disclaimer — TC-M2-06/10 | Quantitative acceptance gap. |
| FR2.12–FR2.13 | Score/rank — TC-M2-04/08 | Partial; forecast cache fixture assertions fail. |
| FR2.14 | Demand alert — TC-M2-07/08 | Boundary/regression evidence; UI/cache assertion mismatch remains. |
| FR2.15 | Interactive chart — TC-M2-08 | Chart component assertions pass; full live browser path not certified. |
| FR2.16 | Persistence — TC-M2-04/09 | Persistence/scheduling tests pass; ensure response timestamp assertion fails (INC-018). |

### 6.2 Functional requirements — Module 3

| Requirement(s) | Feature / case mapping | Current assessment |
|---|---|---|
| FR3.1–FR3.7 | Context/market/localized generation — TC-M3-01 | Partial; live quality unmeasured. |
| FR3.8–FR3.10 | Regenerate/edit/approve/store — TC-M3-02/12 | Fail in saved-draft tests. |
| FR3.11–FR3.17 | Creative direction — TC-M3-03 | Automated evidence; live acceptance partial. |
| FR3.18–FR3.19 | Refine/persist direction — TC-M3-03 | Automated evidence; full live path not executed. |
| FR3.20–FR3.24 | Media/alignment — TC-M3-04/07 | Automated evidence; live multimodal acceptance partial. |
| FR3.25.1–FR3.25.5 | Compliance scores/bands — TC-M3-04/05 | Current 0–100/70 boundary tested; inherited score model needs reconciliation. |
| FR3.26–FR3.29 | Explanation/revision/history — TC-M3-04/05/12 | Partial; draft persistence failure and live audit/history acceptance gap. |
| FR3.30 | Rule-based fallback — TC-M3-06 | Baseline conflict; no-fabrication tests pass. |

<!-- PAGE -->

### 6.3 Functional requirements — Module 4 and extensions

| Requirement(s) | Feature / case mapping | Current assessment |
|---|---|---|
| FR4.1–FR4.5 | Existing data, KPIs, funnel — TC-M4-01/03 | Automated evidence; real insight availability not certified. |
| FR4.6–FR4.8 | Manual data/date filtering — TC-M4-01/02/04 | Frontend assertions pass. |
| FR4.9–FR4.14 | Normalization/PES/gauge — TC-M4-04 | Frontend calculation/display assertions pass. |
| FR4.15–FR4.17 | Missing/zero/recalculation — TC-M4-02/04 | Frontend assertions pass. |
| FR4.18–FR4.24 | Report payload/diagnosis/recommendations — TC-M4-05/08 | Partial; report-quality evaluation missing. |
| FR4.25 | Download report — TC-M4-06 | Gap. |
| FR4.26 | Rule-based report fallback — TC-M4-07 | Baseline conflict. |
| FR4.27 | Regenerate/overwrite report — TC-M4-06 | Full acceptance evidence gap. |
| Extension: publishing | TC-M3-07/08/09/10/11/12 | Implemented and tested at several layers; browser regressions and live-account checks remain. |
| Extension: attribution | TC-M4-09/10/11 | Tracking, vouchers and post insights now included in scope. |
| Extension: public experience | TC-PUB-01/02 | Component/public browser coverage; mobile navigation finding remains. |
| Extension: workspace | TC-PUB-03 | Backend feature gap. |

### 6.4 Non-functional requirements — quality, security and performance

| Inherited criterion | Evidence and acceptance status |
|---|---|
| AI tasks average ≤8 seconds | Gap: no controlled warm/cold latency benchmark. Unit-test duration is not model response latency. |
| Classifier accuracy ≥85% | Gap: no versioned labeled-set accuracy report. |
| Forecast MAPE ≤15% or disclaimer | Gap: no held-out forecasting evaluation. Stub/adapter success is not accuracy. |
| Report diagnostic alignment ≥90% | Gap: no scored standardized scenarios. |
| Five concurrent sessions without degradation | Gap: no workload/baseline load test. PostgreSQL job-claim concurrency is not a user-load benchmark. |
| Dashboard ≤2 seconds after API response | Gap: no instrumented render-performance acceptance measurement. |
| TLS 1.2+ | Not executed: requires deployed endpoint verification. |
| Adaptive password hashing; no plaintext | Partial: password/auth controls have automated tests; no independent hash-strength and deployed-data audit. |
| Injection/XSS/CSRF protection | Gap: no comprehensive dynamic malicious-input assessment. |
| Operator/admin RBAC | Gap: operator tenancy is tested, but a complete production role matrix and workspace backend are not established. |
| Availability ≥95% | Gap: no representative monitoring observation window. |

<!-- PAGE -->

### 6.5 Non-functional requirements — reliability, usability and operations

| Inherited criterion | Evidence and acceptance status |
|---|---|
| External API retries up to three times | Partial: delivery retry/error tests exist; a universal three-retry rule is not established across services. Ambiguous writes must not be blindly retried. |
| Graceful recovery and persisted-data consistency | Partial: cached-state, error preservation, delivery and database tests cover specific paths; current draft/cache assertions still fail. |
| Backup/retention | Not executed: no backup restoration drill. |
| Core tasks within three interactions | Gap: no instrumented task-path measurement. |
| Tooltips/simplified onboarding | Partial: component assertions pass; full live onboarding/usability acceptance not executed. |
| SUS ≥70 | Gap: no formal scored user study. |
| Marketing preparation time reduced ≥40% | Gap: no controlled baseline/time trial. |
| Modular structure | Pass by inspection: four product modules across separate frontend, orchestration and Python services. The original “five-phase” label needs requirements clarification. |
| API/service documentation | Pass by inspection for existence: README/developer guide, architecture, module guides and API contract. Completeness/accuracy of every historical doc is not certified. |
| Independent deployment/scaling | Partial: service/Docker definitions exist; scaling acceptance not run. |
| Horizontal/load-balanced compatibility | Not executed: requires infrastructure and concurrency exercises. |
| Browser-based, no client install | Pass by inspection and selected browser execution. |
| Latest two Chrome/Edge/Firefox/Safari | Gap: this audit used Chromium desktop/mobile emulation, not all browser products and versions. |
| Linux deployment | Partial: Docker PostgreSQL exercised; no full Linux application deployment acceptance. |

## 7. Incident and defect log

Findings below are test-observed behavioral or specification mismatches after installation. A failing test may be stale or may reveal a product regression; probable causes are labeled rather than treated as proven. Dependency installation and absent live services are not product findings.

### 7.1 September incidents reassessed

| Version 1.0 incident | Current disposition |
|---|---|
| INC-001: manual ingestion timeouts | Not reproduced: all five IngestionForm.test.tsx cases pass in EX-01, including the prior submission/PES paths. |
| INC-002: reference-profile sweep | Closed for the cited regression: ReferenceProfileIsolationTest passes; scheduler now uses findAllNonReference(). |
| INC-003: macro provenance | Cited last-known-good/missing-source regression suites pass in EX-03. |
| INC-004: scheduled ingestion trigger/log | Cited scheduling/forecast-trigger suite passes in EX-03. |
| INC-005: floating-point boundary | Cited boundary suite passes with a tolerance comparison in EX-03. |
| INC-006: null flight-reference fixture | EnsureFreshForecastTest passes; the current separate JWT timestamp mismatch is INC-018. |
| INC-007: live hosted classifier unavailable | No new live quota/availability finding: hosted-classifier acceptance not rerun. This historical external-service event is not counted as a current defect. |
| INC-008: old full-stack journey locator | That full-stack scenario was not rerun; no claim of closure. Current selected browser failures have separate IDs. |
| INC-009: Python environment | Retired from findings: dependencies installed and both Python suites executed. |
| INC-010: fallback requirements conflict | Remains a requirements-owner decision; successful no-fallback tests do not resolve the inherited requirement. |
| INC-011: test-harness warnings | Console output alone is not a new application defect; assess only with a reproduced failed assertion or documented test-quality concern. |

<!-- PAGE -->

### 7.2 Current reproducible findings

| ID / severity | Observed mismatch and affected scope | Disposition |
|---|---|---|
| INC-012 / Medium | Six forecastStore cases expect five alerts; actual fixture response has eight. EX-01 and focused EX-01R reproduce it. | Open test/fixture contract mismatch. Inspect intended fixture cardinality before changing application behavior. No demonstrated loss of live alerts. |
| INC-013 / Medium | Two ContentStudioView saved-draft scenarios cannot find the “Save changes” button after editing. | Open: determine whether accessible-label/workflow expectations drifted or saved-draft state regressed. Update and rerun both update-existing and deleted-elsewhere paths. |
| INC-014 / Low | Draft JSON round-trip adds posterDataUrl=null to image media where the original object has no such property, failing deep equality. | Open normalization/test-contract mismatch, confirmed in a diagnostic rerun. No lost caption or media content is demonstrated by this assertion. |
| INC-015 / Medium | Mobile landing-menu scenario expects a “Request a Demo” link inside the Menu dialog; locator finds no element. | Open browser/accessible-navigation mismatch; compare current intended CTA and test expectation. |
| INC-016 / Medium | Paid-ad browser scenario cannot check “Run as Paid Ad” because the checkbox is disabled under its mocked configuration. | Open browser-fixture/precondition mismatch. Verify ad account, budget/spending-limit and campaign-link prerequisites. This does not demonstrate a failed real Meta call. |
| INC-017 / Medium | Unconfigured-provider browser scenario expects a disabled “Connect TikTok” button that is not found. | Open provider-state/locator mismatch; align the expected unavailable presentation with the intended UI. |
| INC-018 / Low | ForecastingControllerJwtVariantTest.ensureReportsThatThePipelineRan expects generatedAt=2026-10-22T07:00:00Z; actual is 2026-10-22T07:00Z. Reproduced in EX-03R. | Open exact wire-format assertion mismatch. Both identify the same instant; determine the intended serialization contract. No demonstrated forecast arithmetic error. |
| INC-019 / Medium | SocialPublishingPostgresTest expects current Flyway version 52; migrations successfully reach 56. | Open stale schema-version expectation. Boot/schema validation completes, but the early assertion prevents concurrent-claim/API assertions from executing. Do not report those later checks as passed. |

No application code or test expectation was changed merely to make this audit pass. The document records the current behavior and remaining regression work.

<!-- PAGE -->

## 8. Evidence index

All deliverable evidence paths are relative to this document's folder. Case-level results retain test names, statuses, failure messages, and repository-relative source paths. Installation attempts and preliminary dependency-incomplete test runs are excluded.

| Evidence | Artifact under evidence/2026-10-27/ | Contents |
|---|---|---|
| EV-01 | frontend.json; frontend-focused.json; draft-diff.log | Fresh frontend results, focused rerun, and exact INC-014 normalization diff. |
| EV-02 | typecheck.log; build.log | Successful type/build output. |
| EV-03 | spring.json; spring-focused.json | Full Java case inventory/results and timestamp-failure reproduction. |
| EV-04 | sbert.json; sbert-cohort.json | Classification/content results and completion of all ten cohort cases. |
| EV-05 | transformer.json | All 81 demand-service results. |
| EV-06 | browser.json | Selected 63 browser results, projects and failure details. |
| EV-07 | postgres.json | Opt-in PostgreSQL failure at schema-version expectation. |
| EV-08 | INC-015/016/017.png and corresponding -context.md files | Browser failure screenshots and page snapshots. |
| EV-09 | inventory.json; manifest.json | Source/discovery inventory, exact commands, runtime versions, counts, source hashes and revision. |
| EV-10 | failures.md | All 14 unique executed failing cases, without duplicate reruns or setup errors. |
| EV-11 | sbert-packages.txt; transformer-packages.txt | Resolved Python package versions for reproducibility. |

The original PDF is the version 1.0 baseline. Its September logs and screenshots are not treated as fresh artifacts. The October 20 social-publishing verification note remains a historical narrative reference at `docs/superpowers/plans/2026-10-20-social-publishing-verification.md`.

### 8.1 Reproduction

Use the installed Java 21 and Python 3.12 runtimes, the checked-in npm lockfiles, and each Python service's requirements plus requirements-dev file. The evidence manifest records actual versions. Python requirements are ranges; the captured package lists identify the tested resolution.

- Frontend: `npm ci`, then `npm test`, `npm run typecheck`, and `npm run build` from frontend/.
- Focused frontend reproduction: run Vitest on services/forecastStore.test.tsx, ContentStudioView.test.tsx, and contentDraftPayload.test.ts.
- Spring: use Java 21, then `sh ./mvnw -B test` from backend/spring-boot/.
- Python: run `python -m pytest tests/ -q --junitxml=<report>` in each isolated service environment. Classification tests load the public E5 encoder; cohort tests need the seeded PostgreSQL reference data.
- Browser: use the existing Playwright configuration and run social-publishing plus public landing/legal/lead-form specs, excluding the signed-in cases for the standalone frontend selection. The evidence manifest preserves the exact selection.
- PostgreSQL: follow the disposable database procedure in the October 20 verification record. Never point the opt-in database test at a production or shared development database.

For wider reproduction, see DEVELOPER_README.md, RUNNING.md, docs/SOCIAL_PUBLISHING_SETUP.md, and backend/docker-compose.e2e.yml. Full authenticated E2E needs the configured backend/test hooks; model and provider acceptance requires separate controlled access.

<!-- PAGE -->

## 9. Coverage assessment and release recommendation

The repository has substantially broader automated coverage than the September PDF: email flows, saved drafts, caption translation, media storage, social delivery, paused ad creation, attribution/enquiry outcomes, walk-in vouchers, post metrics, and the public demo now have explicit suites.

Fresh execution supports the results in Section 4. It does not support unconditional sign-off. The nine frontend failures, one Java response-format failure, one PostgreSQL test-version failure, and three selected browser failures remain actionable regression findings. Outstanding live-platform checks and quantitative/non-functional acceptance criteria remain separately documented coverage gaps.

**Recommendation: continue internal regression and validation; do not mark final acceptance approved.** Close current reproduced failures, reconcile the requirements baseline, and supply the live-model, full-stack, security, operational, and user-study evidence required for acceptance.

A green type check, successful production build, passing mocked APIs, or historical successful run cannot override current failing scenarios. Conversely, a stale test fixture or locator is not automatically proof of a production defect; triage it against intended behavior.

## 10. Required regression and completion plan

1. Resolve INC-012–019. Distinguish test maintenance from product fixes, preserve the intended assertions, then rerun the affected suites and full relevant regression.
2. Reconcile FR3.30/FR4.26 fallback expectations, the current OMCS score/threshold model, live campaign data, and new publishing/attribution features with the approved SRS/SDD.
3. Run the full authenticated Playwright and frontend live-contract suites against an isolated configured backend; record actual skips as well as passes and failures.
4. Verify real tester-account consent, public callbacks, Meta account-specific paid-ad rules, Instagram delivery, TikTok media-prefix/inbox behavior, and real insight availability. Keep Meta ads paused until a separately authorized operator launch.
5. Evaluate ≥85% classifier accuracy, ≤15% forecast MAPE/disclaimer behavior, and ≥90% diagnostic alignment using versioned datasets/scenarios and recorded model versions.
6. Measure AI latency, post-response dashboard render time, five-session concurrency and service availability with explicit protocols and observation windows.
7. Complete dynamic security/role assessment, deployment TLS checks, backup/restore validation, and the required cross-browser/platform matrix.
8. Conduct formal usability acceptance with SUS and task-time baselines; evaluate SUS ≥70 and preparation-time reduction ≥40%.
9. Update this document and evidence manifest after reruns. Approvals require named reviewers and dated decisions; none are inferred from automated tests.

## 11. Approval record

| Role | Name | Decision | Signature / date |
|---|---|---|---|
| Test lead | Pending | Pending review | Pending |
| Development lead | Pending | Pending review | Pending |
| Product / requirements owner | Pending | Pending baseline reconciliation | Pending |
| Academic adviser / evaluator | Pending | Pending evaluation | Pending |
