# Spring Passthrough and Calibration Evidence (Tasks 11–14)

**Owner:** Dev C, alone.
**Prerequisite:** `01-prerequisites.md` merged, dump imported.
**Runs in parallel with:** 02, 04, 05. Touches no file they touch.

**Files owned by this task — no other task edits them:**
- `backend/spring-boot/src/main/java/com/ceview/module1/uniquenessscoring/**`
- `backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java`
- `backend/spring-boot/src/test/java/com/ceview/module1/**`
- `scripts/uniqueness-calibration-report.py`
- `backend/CONTRACT.md`

Two halves. The first carries the new fields through the orchestration layer without losing tenant
isolation. The second produces the evidence that Dev B's percentile thresholds are defensible — and
deliberately reads only Task 1's seeded corpus, so it does not import Dev B's code and does not wait
on it.

---

### Task 11: Pass the new fields through

`UniquenessScoringController` builds its response by hand-mapping keys out of a `Map`
(`UniquenessScoringController.java:28-36`), defaulting each to `0` or `""`. New fields that nobody
maps become silent zeros — a `cohortSize: 0` reaching the frontend would render as "compared against
0 businesses" with no error anywhere.

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module1/uniquenessscoring/UniquenessScoringController.java`
- Related: `dto/UniquenessDtos.java` (shape frozen by Task 4 — do not renegotiate it)
- Test: `backend/spring-boot/src/test/java/com/ceview/module1/uniquenessscoring/UniquenessScoringControllerTest.java`

- [ ] **Step 1: Write the failing test** — a stubbed gateway response containing every field arrives
      at the caller intact, and a response *missing* a field fails loudly rather than defaulting to
      zero.

- [ ] **Step 2: Map the new fields:** `semanticPercentile`, `cohortSize`, `cohortMedianScore`,
      `cohortCategories`, `categoryDensity`, `sufficientCohort`.

- [ ] **Step 3: Replace the silent `getOrDefault(…, 0)` pattern** for the fields the frontend renders
      as facts. A missing cohort size is an upstream failure, not a zero. Follow the existing
      `DependencyUnavailable` contract from `2026-08-30-remove-synthetic-fallbacks` rather than
      inventing a new error shape.

**Milestone:** every field Dev B returns survives the trip to the browser.

---

### Task 12: Gateway mapping and the multi-tenant guard

Task 2 introduced `is_reference = TRUE` rows with `user_id NULL`. They are corpus material, and the
uniqueness cohort query is the **only** place they should ever appear. Any other query that picks
them up would show one operator another business's data — or show a reference profile as if it were
a tenant.

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/ai/AIInferenceGatewayService.java`
- Test: `backend/spring-boot/src/test/java/com/ceview/module1/ReferenceProfileIsolationTest.java`

- [ ] **Step 1: Write the failing test.** Load every repository method that reads
      `tbl_business_profile` and assert none returns a row with `is_reference = TRUE`. This is the
      guard that makes the seeded corpus safe; write it before touching anything else.

- [ ] **Step 2: Fix whatever it catches.** Expect profile listing and any admin/debug read to need an
      explicit filter. Follow the existing operator-scoping pattern rather than adding a new one.

- [ ] **Step 3: Confirm the gateway forwards `categories`** on the uniqueness call — Dev B's
      category-filtered cohort is inert if the selected categories never reach FastAPI.

**Milestone:** reference rows are invisible to every read except the cohort query.

---

### Task 13: Document the response in `CONTRACT.md`

**Files:**
- Modify: `backend/CONTRACT.md`

- [ ] **Step 1: Replace the bare `DetailedCalibrationResultDTO` reference** at line 17 with the full
      response shape from [`00-index.md`](00-index.md).

- [ ] **Step 2: State the two things that are easy to get wrong** and that the types cannot express:
      `overallScore === semanticPercentile`, and `categoryScore` is **not** a component of it. Note
      that `categoryScore` is a normalised share, so it is not comparable across different numbers of
      selected categories.

- [ ] **Step 3: Document `sufficientCohort: false`** as a legitimate response, not an error — the
      frontend renders an empty state for it rather than an error panel.

**Milestone:** a developer reading only `CONTRACT.md` cannot reintroduce the tautology.

---

### Task 14: Calibration report over the seeded corpus

This is the evidence half. Dev B is choosing a percentile transform; this report measures what the
real per-category distance distributions actually look like, so that choice is grounded rather than
assumed. It reads only the corpus seeded in Task 3, so it neither imports Dev B's code nor waits on
it — and it can be run again after Task 6 lands to confirm the transform worked.

**Files:**
- Create: `scripts/uniqueness-calibration-report.py`
- Create: `docs/module-1/uniqueness-calibration.md` — the committed findings

- [ ] **Step 1: Load every reference embedding**, grouped by category.

- [ ] **Step 2: Compute the pairwise cosine distance distribution per category** — min, median, mean,
      p90, max, plus the count.

- [ ] **Step 3: Report what the old formula would have produced** for each: `min(mean_dist / 0.5, 1)
      × 100`. This quantifies the compression band the plan claims exists. If the observed spread is
      wide rather than compressed, **say so and flag it to Dev B** — the premise of Task 6 would be
      wrong and the plan needs revisiting before it ships.

- [ ] **Step 4: Write the findings to `docs/module-1/uniqueness-calibration.md`,** including the
      density tiers Task 8 derives, so Dev D's reassurance copy quotes measured numbers rather than
      invented ones.

- [ ] **Step 5: Re-run after Task 6 merges** and append a comparison section. The acceptance
      criterion for the whole plan: per-category score distributions span a usable range instead of
      clustering in the old ~20–80 band.

**Milestone:** the calibration claim in this plan is backed by measured numbers in the repo.

---

## Definition of Done

- [ ] Every contract field survives Spring end to end; missing fields fail loudly
- [ ] No repository read outside the cohort query returns `is_reference = TRUE` rows
- [ ] `CONTRACT.md` documents the composite rule and the `sufficientCohort` case
- [ ] `docs/module-1/uniqueness-calibration.md` committed with real measured distributions
- [ ] No file outside this task's owned set is modified
- [ ] Code review approved

## Verification

```bash
cd backend/spring-boot && ./mvnw test -Dtest='Uniqueness*,ReferenceProfileIsolation*'
python scripts/uniqueness-calibration-report.py
```

## Commit — **a human runs this**

```bash
git add backend/spring-boot backend/CONTRACT.md scripts/uniqueness-calibration-report.py \
        docs/module-1/uniqueness-calibration.md
git commit -m "feat(module-1): carry cohort statistics through Spring; add calibration report"
```
