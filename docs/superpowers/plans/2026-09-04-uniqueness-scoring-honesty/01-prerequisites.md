# Prerequisites — Shared Data, Representation, and Interfaces (Tasks 1–5)

> ## ✅ COMPLETED 2026-09-04 — read this before starting Tasks 6–21
>
> All five tasks are implemented and verified. Four things differ from what is written below;
> the reasons are recorded so nobody re-litigates them.
>
> 1. **The E5 prefix premise was wrong, and is corrected in [`00-index.md`](00-index.md).**
>    Prefixing does not widen the score band — measured, it leaves the spread unchanged
>    (0.0907 → 0.0901) and only shifts distances down. The prefix was kept for correctness.
>    **Percentile ranking (Task 6) is doing 100% of the work.**
> 2. **More dead code was removed than Task 1 lists.** `predict_all` and `compute_category_score`
>    were equally dead and shared `_predict_probs`, and `BertModel` no longer exposes
>    `.classifier`, so the whole local Keras path had been raising `AttributeError` on every call.
>    Deleting it orphaned `ml_stubs.py`, which went too — it was runtime mock data, which this
>    plan forbids.
> 3. **The dump is embeddings-only.** V26 already seeds the profile text through Flyway; dumping it
>    again would create two sources of truth that could disagree. Import order is migrate, then
>    import.
> 4. **`--all` was added to the generator.** Applying a scheme change to a machine that already has
>    saved profiles produces a *mixed* corpus — this actually happened here (64 prefixed reference
>    rows against 130 unprefixed tenant rows). Mixed schemes do not error; they silently produce
>    distances driven by the scheme rather than the businesses. `--all` re-embeds everything from
>    stored text.
>
> **Open item for Dev B (Task 7):** cohort composition is still undecided. This machine holds 130
> tenant profiles alongside the 64 reference rows, and tenant rows differ per machine — so
> including them breaks the cross-machine reproducibility the dump exists to provide. Scoring
> against `is_reference = TRUE` rows only would be reproducible but excludes real operators from
> each other's cohorts. **Decide this explicitly in Task 7 and write down why.**

**Owner:** Dev A, alone.
**Prerequisite:** none.
**Blocks:** every task in `02-` … `05-`. Nothing else starts until this merges.

This task exists so the other four never wait on each other. It owns the three things they all share
— how text becomes a vector, what data everyone scores against, and the interfaces they code to —
plus the file split that lets two frontend developers work without colliding.

Everything here is working code and real seeded data. **No stubs, no placeholders, no runtime mock
data.** The reference corpus is reference data loaded by a normal Flyway migration, flagged so
tenant-scoped queries can exclude it.

---

### Task 1: E5 prefixes, and delete the dead Keras path

`intfloat/multilingual-e5-base` is trained with `"query: "` / `"passage: "` prefixes. `_build_text`
omits them, which compresses unrelated text into a narrow high-similarity band and is the root cause
of the unreachable score ceiling.

This belongs in the prerequisite task, not in Task 6, because **the seeded corpus must be generated
with exactly the scheme runtime uses.** If prefixes changed after seeding, every seeded vector would
be silently invalid.

**Files:**
- Modify: `backend/fastapi-sbert/app/services/ml_classifier.py:35-38` (`_build_text`), `:135-161`
  (`embed_business`)
- Delete: `predict_top3` (`:57-93`) and `_predict_probs` (`:41-52`) from the same file
- Modify: `backend/fastapi-sbert/app/services/embedding_store.py:76` — bump
  `embedding_model_version`
- Test: `backend/fastapi-sbert/tests/unit/test_ml_classifier_text.py`

- [ ] **Step 1: Write the failing test** — assert `_build_text` emits the E5 passage prefix, that the
      services/uvp/description ordering is unchanged, and that two unrelated tourism descriptions
      produce a *larger* cosine distance with prefixes than without. That last assertion is the point
      of the change; without it this is a cosmetic edit.

- [ ] **Step 2: Run it and watch it fail.**

- [ ] **Step 3: Add the prefix** to `_build_text`. Keep the existing field order — the format is
      shared with the classifier's training-time input and the ordering is load-bearing.

- [ ] **Step 4: Bump `embedding_model_version`** to `intfloat/multilingual-e5-base+e5prefix` in
      `upsert_embedding`. Vectors written under the two schemes are not comparable; the column is how
      a mixed corpus becomes detectable instead of silently wrong.

- [ ] **Step 5: Delete `predict_top3` and `_predict_probs`.** Confirm zero callers first —
      `grep -rn "predict_top3" backend/ --include=*.py` should return only the definition. The router
      uses `hf_space_classifier.predict_categories`. Leaving dead code that consumes the local encoder
      guarantees it diverges from the prefixed scheme later.

- [ ] **Step 6: Run the tests.**
      ```bash
      cd backend/fastapi-sbert && pytest tests/unit/ -v
      ```

**Milestone:** two unrelated Cebu tourism descriptions measurably further apart than before, and the
local encoder has exactly one consumer — embeddings.

---

### Task 2: `V26` — reference-corpus flag and profiles

`V2__module1_profile_multi_category.sql` already seeds 9 Cebu MSME profiles with real descriptions,
UVPs and `categories`. Their per-category counts are too thin for a category-scoped cohort (Adventure
& Nature has exactly one, and the cohort floor is three), and none of them have embeddings.

**Files:**
- Create: `backend/spring-boot/src/main/resources/db/migration/V26__module1_reference_corpus.sql`
- Related: `backend/spring-boot/src/main/resources/db/migration/V2__module1_profile_multi_category.sql`
  (the 9 existing profiles and the fixed-UUID convention), `V1__init_schema.sql:16-38` (schema)

- [ ] **Step 1: Add `is_reference BOOLEAN NOT NULL DEFAULT FALSE`** to `tbl_business_profile`.
      Reference rows are corpus material, not tenants. Every tenant-scoped read must exclude them —
      Task 12 adds the test that proves it.

- [ ] **Step 2: Backfill the 9 existing seed profiles** as `is_reference = FALSE`. They belong to real
      demo operators with login credentials (`SEED_CREDENTIALS.md`) and must keep behaving as tenants.

- [ ] **Step 3: Seed reference profiles** with `user_id NULL`, `is_reference = TRUE`, and fixed UUIDs
      in a new `25000000-…` block (following the existing convention documented at the top of `V2`).
      Target **at least 8 per category across all 7 categories**, with density deliberately uneven so
      the density messaging has real data behind it:
      - *dense*: Coastal & Island, Adventure & Nature, Culinary & Gastronomy (12+ each)
      - *moderate*: Accommodation & Staycation, Cultural & Heritage (8–10 each)
      - *sparse*: Urban & City, Theme Parks / Entertainment (4–6 each)

      Write descriptions and UVPs at the length real onboarding produces — the ≥50-word description
      and ≥30-word UVP that `MIN_WORDS` in
      [`obDraft.tsx:111-119`](../../../../frontend/components/module-1/onboarding/obDraft.tsx)
      enforces. A corpus of one-line summaries would make every real operator look artificially
      unique.

- [ ] **Step 4: Verify the migration applies to a fresh database.**
      ```bash
      cd backend/spring-boot && ./mvnw flyway:clean flyway:migrate
      psql "$DATABASE_URL" -c "SELECT categories, COUNT(*) FROM tbl_business_profile WHERE is_reference GROUP BY categories ORDER BY 2 DESC;"
      ```

**Milestone:** every category has a cohort above the floor, and three density tiers exist in real
data.

---

### Task 3: Generate the embeddings and export the shared dump

The migration seeds *text*. Vectors must be produced by the same code path runtime uses, which is why
this is a script rather than literals baked into SQL.

**Files:**
- Create: `scripts/generate-reference-corpus.py`
- Create: `backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql`
- Modify: `RUNNING.md` — an "Importing the uniqueness corpus" section

- [ ] **Step 1: Write the generator.** It reads every `is_reference = TRUE` profile, calls
      `ml_classifier.embed_business` (the real function, post-Task-1) and `embedding_store.
      upsert_embedding`, then dumps `tbl_business_embedding` plus the reference rows of
      `tbl_business_profile` to `uniqueness-corpus.sql`. It must be idempotent — safe to re-run after
      a corpus edit.

- [ ] **Step 2: Run it and commit the dump.** The dump is the contract between the five developers;
      regenerating it locally instead of importing it defeats the purpose.

- [ ] **Step 3: Document the import in `RUNNING.md`,** including the count check from `00-index.md`
      and the warning that a dump generated under a different `embedding_model_version` must not be
      mixed with one generated after Task 1.

- [ ] **Step 4: Verify reproducibility.** Import on a second machine, score the same profile, confirm
      an identical number. This is the acceptance criterion for the whole task file.

**Milestone:** any developer reaches an identical corpus with one `psql` command.

---

### Task 4: Freeze the uniqueness response contract

Tasks 6–21 all code against this shape. Freezing it here is what makes them parallel.

**Files:**
- Modify: `backend/spring-boot/src/main/java/com/ceview/module1/uniquenessscoring/dto/UniquenessDtos.java`
- Modify: `frontend/types.ts:70-76` (`UniquenessResult`)
- Modify: `frontend/services/apiClient.ts:114-132` (the dev-only `USE_FIXTURES` branch)
- Modify: `backend/CONTRACT.md:17`

- [ ] **Step 1: Extend `UniquenessResponse`** with the fields listed under "The frozen contract" in
      [`00-index.md`](00-index.md): `semanticPercentile`, `cohortSize`, `cohortMedianScore`,
      `cohortCategories`, `categoryDensity`, `sufficientCohort`. Keep `descriptionFeedback` and
      `categoryFeedback` — they already exist end-to-end and are always empty today; Task 10 finally
      populates them.

- [ ] **Step 2: Mirror the shape in `UniquenessResult`** in `types.ts`, with a doc comment stating
      plainly that `overallScore === semanticPercentile` and that `categoryScore` is **not** a
      component of it. That comment is the thing that stops the tautology being reintroduced.

- [ ] **Step 3: Update the `USE_FIXTURES` branch** to the new shape. This is a dev-only flag, not a
      production path; it must still compile and must not invent plausible-looking cohort statistics
      that could be mistaken for real ones. Use obviously-synthetic values (`cohortSize: 0`,
      `sufficientCohort: false`).

- [ ] **Step 4: Update the `CONTRACT.md` row** for `POST /api/classification/uniqueness`.

- [ ] **Step 5: Verify it all still compiles.**
      ```bash
      cd frontend && npx tsc --noEmit
      cd backend/spring-boot && ./mvnw -q compile
      ```

**Milestone:** the contract is settled in all three languages; no later task renegotiates it.

---

### Task 5: Extract `AnalysisStep.tsx` into three components

[`AnalysisStep.tsx`](../../../../frontend/components/module-1/onboarding/steps/AnalysisStep.tsx) is
~280 lines holding phase state, the category picker, the score tiles and the banner. Tasks 15–17 and
18–21 both need to work in it. Splitting it here is the only way they run in parallel.

**This is a behaviour-preserving extraction. No copy changes, no layout changes, no new props beyond
what the split requires.** The honest-copy work is Task 15; doing it here would collide with Dev D.

**Files:**
- Create: `frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.tsx` — the three tiles
- Create: `frontend/components/module-1/onboarding/steps/analysis/CohortContext.tsx` — the pass/warn
  banner as it exists today, ready to become the disclosure + reassurance surface
- Create: `frontend/components/module-1/onboarding/steps/analysis/CategoryPicker.tsx` — the inferred
  chips, including the "at least one must stay selected" toast rule
- Modify: `AnalysisStep.tsx` — reduced to phase state, data fetching, and composition
- Related: `AnalysisStep.test.tsx` — **must pass unchanged**; that is the proof the split is behaviour-preserving

- [ ] **Step 1: Run the existing tests and record the baseline.**
      ```bash
      cd frontend && npm run test:unit -- AnalysisStep
      ```

- [ ] **Step 2: Extract the three components,** each taking its data as props. Keep `phase` and the
      `apiClient` calls in `AnalysisStep` — the children stay presentational so Dev D and Dev E can
      reason about them independently.

- [ ] **Step 3: Re-run the same tests unchanged.** Any edit needed to `AnalysisStep.test.tsx` means
      behaviour moved; revert and redo the split.

- [ ] **Step 4: Confirm ownership boundaries** for the parallel phase: Dev D owns `ScoreTiles.tsx` and
      `CohortContext.tsx`; Dev E owns `AnalysisStep.tsx` and `CategoryPicker.tsx`. Note this in a
      file-header comment in each, matching the existing convention in this directory.

**Milestone:** four files where there was one, existing tests green with no edits, and two disjoint
frontend ownership sets.

---

## Definition of Done (all of Tasks 1–5)

- [ ] `V26` applies cleanly to a fresh database and every category clears the cohort floor
- [ ] The dump imports on a second machine and reproduces an identical score for an identical profile
- [ ] `grep -rn "predict_top3" backend/ --include=*.py` returns nothing
- [ ] `AnalysisStep.test.tsx` passes **with no edits**
- [ ] `npx tsc --noEmit` and `./mvnw -q compile` both clean
- [ ] Code review approved

## Verification

```bash
cd backend/fastapi-sbert && pytest tests/unit/ -v
cd backend/spring-boot && ./mvnw flyway:clean flyway:migrate && ./mvnw -q compile
cd frontend && npx tsc --noEmit && npm run test:unit -- AnalysisStep
```

## Commit — **a human runs this**

```bash
git add backend/fastapi-sbert/app/services backend/spring-boot/src/main/resources/db \
        scripts/generate-reference-corpus.py frontend/types.ts frontend/services/apiClient.ts \
        frontend/components/module-1/onboarding/steps backend/CONTRACT.md RUNNING.md
git commit -m "feat(module-1): seed reference corpus, prefix E5 embeddings, freeze uniqueness contract"
```

**Announce the merge to Devs B–E and tell them to re-import the dump before starting.**
