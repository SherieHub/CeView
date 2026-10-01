# Scoring Math — Percentile Ranking Against a Real Cohort (Tasks 6–10)

**Owner:** Dev B, alone.
**Prerequisite:** `01-prerequisites.md` merged, dump imported.
**Runs in parallel with:** 03, 04, 05. Touches no file they touch.
**Purpose:** Make the number mean something — replace the unreachable 0.5-distance constant with a
percentile rank against the operator's own category cohort, publish the cohort statistics that make
that rank readable, and refuse to score at all when the cohort is too small to rank against.

**Files owned by this task — no other task edits them:**
- `backend/fastapi-sbert/app/services/ml_classifier.py`
- `backend/fastapi-sbert/app/services/embedding_store.py`
- `backend/fastapi-sbert/app/routers/classification.py`

This is the task that makes the number mean something. Today the score is a raw distance divided by a
constant that cosine similarity on this encoder never reaches; after this task it is the operator's
rank within their own category's real distribution.

---

### Task 6: Percentile ranking replaces the 0.5 constant

`min(mean_dist / 0.5, 1) × 100` assumes a mean cosine distance of 0.5 is attainable. It is not.
Measured on the seeded corpus in Task 1, within-category distances run **0.08–0.16**, so the old
formula caps every business in every category at roughly **16–32 out of 100** — see the table in
[`00-index.md`](00-index.md). Ranking against the cohort's own distribution is self-calibrating: it
needs no magic constant and cannot go stale when the encoder or the corpus changes.

**Read the correction in `00-index.md` before starting.** This plan originally assumed the missing
E5 prefix caused the compression and that adding it would widen the range. It does not — measured,
the prefix leaves the spread unchanged and only shifts distances down. **Percentile ranking is doing
100% of the work here**, so do not expect any help from the Task 1 prefix change, and do not
reintroduce an absolute-distance threshold on the assumption that the band widened. There is a test
that fails if you do: `test_same_domain_distances_are_compressed_far_below_the_old_threshold`.

**Files:**
- Modify: `backend/fastapi-sbert/app/services/ml_classifier.py:164-238`
  (`compute_semantic_uniqueness`)
- Test: `backend/fastapi-sbert/tests/unit/test_semantic_uniqueness.py`

- [ ] **Step 1: Write the failing tests.**
      - A business whose mean distance exceeds every cohort member's scores near 100.
      - A business at the cohort median scores near 50.
      - A near-duplicate of a cohort member scores near 0.
      - The full 0–100 range is reachable — the regression that motivated this plan.

- [ ] **Step 2: Run them and watch them fail** against the current formula (the first and last will
      fail; the median case may pass by coincidence).

- [ ] **Step 3: Implement.** Compute the candidate's mean distance to the cohort, compute each cohort
      member's mean distance to the rest of the cohort, and return the candidate's percentile rank in
      that distribution. Keep the raw 0–100 distance figure as `semanticsScore` for continuity — the
      contract carries both, and Task 15 shows only one of them.

- [ ] **Step 4: Keep the function pure.** It receives vectors and returns numbers; the database query
      lives in Task 7. That boundary is what lets this be unit-tested without Postgres.

**Milestone:** a synthetic cohort with a known spread produces scores across the full range.

---

### Task 7: Category-filtered cohort in `fetch_others`

The screen says "against the local cohort in those categories." The query compares against every
stored embedding regardless of category. One of the two has to change; the screen's claim is the
right one.

Note the data shape: `tbl_business_profile.categories` is **comma-joined TEXT**, not a join table
(`V2__module1_profile_multi_category.sql:44-45`). Matching is a containment test against that column,
not an `IN` clause.

**Files:**
- Modify: `backend/fastapi-sbert/app/services/embedding_store.py:92-130` (`fetch_others`)
- Test: `backend/fastapi-sbert/tests/integration/test_embedding_store_cohort.py`

- [ ] **Step 1: Write the failing integration test** against the seeded corpus: requesting the
      Adventure & Nature cohort returns only Adventure & Nature profiles, excludes the caller's own
      row, and returns a count matching the migration's seeded total for that category.

- [ ] **Step 2: Add a `categories: list[str]` parameter,** joining `tbl_business_embedding` to
      `tbl_business_profile` and filtering to rows sharing at least one category. Preserve the
      existing `exclude_profile_id` behaviour.

- [ ] **Step 3: Include reference rows, exclude nothing by tenant.** The corpus is deliberately
      cross-tenant — an operator is being compared against the Cebu market, not against their own
      account. This is the one place `is_reference = TRUE` rows are *wanted*; Task 12 asserts every
      other read excludes them.

- [ ] **Step 4: Keep the empty-parameter path working** — no categories means the old unfiltered
      behaviour, so nothing else that calls this breaks.

**Milestone:** the cohort on screen is the cohort in the query.

---

### Task 8: Cohort statistics

Tasks 16 and 17 need real numbers to disclose and to reassure with. They come from the same query
that builds the cohort, so they cost almost nothing here and are impossible to compute in the
frontend.

**Files:**
- Modify: `backend/fastapi-sbert/app/services/embedding_store.py` — add `fetch_cohort_stats`
- Test: same integration test module as Task 7

- [ ] **Step 1: Write the failing test** — for a seeded dense category, assert the returned size
      matches the migration's count and that the density tier is `"dense"`.

- [ ] **Step 2: Return `cohortSize`, `cohortMedianScore`, and `categoryDensity`.** Derive density
      from the category's share of the total corpus rather than a hardcoded list of category names —
      hardcoding would go stale the first time the corpus grows.

- [ ] **Step 3: Compute the median from the same distance matrix** Task 6 already builds. Do not
      issue a second pass over the corpus.

**Milestone:** "34 Adventure & Nature businesses, median 41, dense" is a fact the API can state.

---

### Task 9: The composite becomes the semantic percentile alone

`category_score` averages normalised allocation shares that sum to 100 across the selected set
(`hf_space_classifier.py:49-66`). Selecting one category yields ~100 mechanically. Averaging that
into the headline means the number moves ~35 points based on how many chips an operator left
selected — an artifact, not a signal.

**Files:**
- Modify: `backend/fastapi-sbert/app/routers/classification.py:39-71`
- Test: `backend/fastapi-sbert/tests/unit/test_uniqueness_router.py`

- [ ] **Step 1: Write the failing test** — the same profile scored with one selected category and
      with three produces the **same** `overallScore`. Today it differs by tens of points. This test
      is the whole point of the task.

- [ ] **Step 2: Set `overallScore = semanticPercentile`.** Keep returning `categoryScore` — it stays
      on screen as a classification-confidence indicator (Task 15 labels it as such) and is still
      genuinely useful for spotting a misclassified profile.

- [ ] **Step 3: Update the docstring** at `classification.py:41-47`, which currently documents the
      average. A stale docstring here is how the tautology gets reintroduced.

**Milestone:** chip selection no longer moves the headline number.

---

### Task 10: Explicit insufficient-cohort state, and populated feedback

Below three corpus rows, `compute_semantic_uniqueness` returns `None` and the router substitutes
`100` (`classification.py:58`) — indistinguishable on screen from a genuinely outstanding score. With
category filtering this case becomes *more* likely, not less, so it has to stop being silent.

**Files:**
- Modify: `backend/fastapi-sbert/app/routers/classification.py`
- Test: `backend/fastapi-sbert/tests/unit/test_uniqueness_router.py`

- [ ] **Step 1: Write the failing test** — a cohort of two returns `sufficientCohort: false` and does
      **not** return `overallScore: 100`.

- [ ] **Step 2: Return `sufficientCohort: false`** with the real (small) `cohortSize` and no
      fabricated headline score. Task 19 renders the matching empty state.

- [ ] **Step 3: Populate `descriptionFeedback` and `categoryFeedback`** — the fields have existed
      end-to-end since the DTO was written and have always been empty strings. Feedback is derived
      from the cohort statistics (where the operator sits relative to the median, and how dense their
      category is), not generated by an LLM. Deterministic text keeps this reproducible across the
      shared dump, which is the property the whole plan rests on.

- [ ] **Step 4: Full suite.**
      ```bash
      cd backend/fastapi-sbert && pytest -v
      ```

**Milestone:** no code path returns a number the data does not support.

---

## Definition of Done

- [ ] Scores span the full 0–100 range on the seeded corpus
- [ ] Identical profile, one vs. three categories selected → identical `overallScore`
- [ ] A cohort below the floor returns `sufficientCohort: false`, never a silent 100
- [ ] `descriptionFeedback` / `categoryFeedback` are non-empty and deterministic
- [ ] No file outside this task's three owned files is modified
- [ ] Code review approved

## Verification

```bash
cd backend/fastapi-sbert && pytest -v
```

Then, against the running stack, confirm the regression that started this plan is fixed:

```bash
curl -s localhost:8000/classification/uniqueness -H 'Content-Type: application/json' \
  -d @sample-adventure-profile.json | jq '{overallScore, cohortSize, categoryDensity}'
```

Rewrite the profile's UVP to be materially more specific, re-run, and confirm **the number moves.**
A flat number means the percentile transform did not take.

## Commit — **a human runs this**

```bash
git add backend/fastapi-sbert
git commit -m "fix(module-1): percentile-rank uniqueness against a category-scoped cohort"
```

## Note for whoever picks up the follow-up

`category_score` still returns normalised shares. This plan stops averaging it into the headline
rather than redefining it, because raw per-category confidences would have to come from the hosted HF
Space (`JamJamzz/ceview_sbert`) and changing that output contract is out of scope here. If the Space
is ever revised to return raw confidences, `categoryScore` becomes genuinely informative and Task 15's
label should be revisited.
