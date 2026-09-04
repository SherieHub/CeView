# Uniqueness Scoring — Honest Math, Honest Screen (Index)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The uniqueness score on Onboarding Step 5 measures one thing, computed against a real and
disclosed cohort, and the screen states what it actually measured. An operator in a crowded category
sees that context up front — reframed, never hidden — and proceeds without feeling penalised.

**Architecture:** One prerequisite task freezes everything the other four share — the embedding
representation, a seeded reference corpus exported as an importable database dump, the response
contract, and a behaviour-preserving split of `AnalysisStep.tsx`. The remaining four tasks then run
fully in parallel with **no shared files**: FastAPI scoring math, Spring passthrough plus calibration
evidence, frontend copy, frontend shell.

**Tech Stack:** React 19 + TypeScript + Vite + Vitest (frontend), Spring Boot 3.3 / Java 21
(orchestration API), FastAPI + Python 3.12 + pytest (AI services), PostgreSQL 16 + pgvector +
Flyway, Playwright (e2e).

---

## Why this work exists

Four defects, each verified in code, make the current score misleading:

1. **The composite is half tautology.** `overallScore = round((categoryScore + semanticsScore) / 2)`
   ([`classification.py:66`](../../../../backend/fastapi-sbert/app/routers/classification.py)). But
   `category_score` averages *normalised allocation shares* that sum to 100 across the selected set
   ([`hf_space_classifier.py:49-66`](../../../../backend/fastapi-sbert/app/services/hf_space_classifier.py)).
   Keeping one chip yields ~100; keeping three yields ~33 each. Half the headline number measures how
   many chips the operator left selected.

2. **The semantic half is floor-bound and mislabeled.** `semanticsScore` scales mean cosine distance
   by `min(mean_dist / 0.5, 1) × 100`, treating a mean distance of 0.5 as a perfect score. Real
   profiles sit nowhere near it. The UI labels this "Description strength"; it is a corpus-relative
   position, not a judgment of writing.

   **MEASURED (Task 1, on the seeded corpus — this supersedes the original premise):** within-category
   pairwise distances and what the old formula makes of them:

   | Category | n | min | median | max | old-formula score range |
   |---|---|---|---|---|---|
   | Coastal & Island | 12 | 0.0833 | 0.1209 | 0.1438 | 16.7 – 28.8 |
   | Adventure & Nature | 12 | 0.0851 | 0.1273 | 0.1547 | 17.0 – 30.9 |
   | Culinary & Gastronomy | 12 | 0.0997 | 0.1272 | 0.1610 | 19.9 – 32.2 |
   | Accommodation & Staycation | 9 | 0.0852 | 0.1269 | 0.1523 | 17.0 – 30.5 |
   | Cultural & Heritage | 9 | 0.0813 | 0.1203 | 0.1453 | 16.3 – 29.1 |
   | Urban & City | 5 | 0.1089 | 0.1216 | 0.1317 | 21.8 – 26.3 |
   | Theme Parks / Entertainment | 5 | 0.0807 | 0.1216 | 0.1302 | 16.1 – 26.0 |

   **No business in any category can score above ~32 against its own cohort.** The compression is
   worse than this plan originally assumed.

   **CORRECTION — the E5 prefix is not the cause.** This plan was written assuming the missing
   `"query: "` / `"passage: "` prefix compressed the band and that adding it would widen the range.
   Measured over representative profiles, the prefix shifts every distance down by ~0.02 and leaves
   the *spread* unchanged (0.0907 → 0.0901), preserving rank ordering (Spearman 0.93). The narrow
   band is inherent to this encoder on same-domain text. The prefix was still added — it is the
   model's documented usage and cost nothing while the corpus was being generated fresh — but it is
   there for correctness, **not** for range. Consequence for Task 6: **percentile ranking is doing
   100% of the work.** Nothing downstream may assume the prefix widened anything.
   Pinned by `backend/fastapi-sbert/tests/unit/test_ml_classifier_text.py`.

3. **There is no corpus.** No migration inserts into `tbl_business_embedding` — rows appear only as
   profiles are saved through the app, so scores are computed against an arbitrary, machine-specific
   set. `fetch_others` compares against *all* of it regardless of category while the screen claims
   comparison "against the local cohort in those categories." Below 3 rows the score silently becomes
   100, indistinguishable on screen from a genuine 100.

4. **The advice is unactionable.** "A more specific UVP usually raises this score" — but specificity
   barely moves a floor-bound metric. An operator who rewrites their UVP three times and watches the
   number stay flat learns to distrust the product.

## Design decisions

| Decision | Rationale |
|---|---|
| Fix the math **and** the screen | Either alone leaves the product lying, just in a different place. |
| Seed a curated reference corpus **and** filter comparisons by category | Percentile ranking needs something real to rank against, and the screen already claims a category-scoped cohort. |
| Drop `categoryScore` from the composite | It is near-tautological; keeping it in the average means the headline number moves ~35 points based on chip selection. It stays on screen as a separate classification-confidence indicator. |
| Reassurance is **data-driven and always visible** | Shown only on low scores, it reads as consolation. Always visible with the cohort's real density and spread, it is context. |
| **No stubs, no mock data on any production path** | All five developers import one database dump, so scores are reproducible across machines. Reference profiles are seeded through a normal Flyway migration and flagged, never faked at runtime. |

**De-risking finding:** `predict_top3` — the local Keras head — has **no callers**; classification
now goes to the hosted HF Space. The local E5 encoder is used *only* for embeddings, so adding the
missing prefixes needs no retraining and no change to the hosted Space.

## ⚠️ Commits are the operator's to run

`.claude/CLAUDE.md` forbids Claude from running `git commit` or `git push` in this repository under
any circumstances. Each task ends with a **Commit** step showing the exact command, but **a human
runs it**. An agent executing this plan stops at each commit step, reports the task ready to commit,
and hands the command back.

## ⚠️ Every task needs the shared database

Tasks 2–5 are meaningless against an empty or divergent corpus. After Task 1 merges, every developer
runs:

```bash
cd backend && docker compose up -d
cd backend/spring-boot && ./mvnw flyway:migrate       # applies V26
psql "$DATABASE_URL" -f backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql
```

Wait for `fastapi-sbert` to report healthy before running any verification — its lifespan hook
downloads a ~1.1GB E5 encoder on first start (`start_period: 600s`). PostgreSQL is the only supported
database; `application-h2.yml` has no pgvector and is out of scope.

**Sanity check that the dump took:** the same profile must produce the same score on two machines.

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM tbl_business_embedding;"   # expect the seeded count
```

## Execution order

```
01-prerequisites.md    Tasks 1–5    ← must complete and merge first; blocks everything
        │
        ├── 02-scoring-math.md        Tasks 6–10    (FastAPI)
        ├── 03-spring-calibration.md  Tasks 11–14   (Spring Boot + calibration report)
        ├── 04-frontend-copy.md       Tasks 15–17   (ScoreTiles, CohortContext)
        └── 05-frontend-shell.md      Tasks 18–21   (AnalysisStep, CategoryPicker, tests)
```

The four branches touch **disjoint file sets** and depend only on Task 1's output, so they can be
assigned to four developers and merged in any order. Task 3's calibration report deliberately reads
only Task 1's seeded corpus — it validates Task 2's thresholds without importing Task 2's code.

## Task inventory

| # | Task | File | Owner |
|---|---|---|---|
| 1 | E5 prefixes + delete the dead Keras path | 01-prerequisites.md | Dev A |
| 2 | `V26` — `is_reference` flag + reference corpus profiles | 01-prerequisites.md | Dev A |
| 3 | Corpus embedding generation + database dump | 01-prerequisites.md | Dev A |
| 4 | Freeze the uniqueness response contract | 01-prerequisites.md | Dev A |
| 5 | Extract `AnalysisStep.tsx` into three components | 01-prerequisites.md | Dev A |
| 6 | Percentile ranking replaces the 0.5 constant | 02-scoring-math.md | Dev B |
| 7 | Category-filtered cohort in `fetch_others` | 02-scoring-math.md | Dev B |
| 8 | Cohort statistics (size, median, density) | 02-scoring-math.md | Dev B |
| 9 | Composite becomes the semantic percentile alone | 02-scoring-math.md | Dev B |
| 10 | Explicit insufficient-cohort state, no silent 100 | 02-scoring-math.md | Dev B |
| 11 | Spring DTO + controller pass the new fields through | 03-spring-calibration.md | Dev C |
| 12 | Gateway mapping + multi-tenant scoping test | 03-spring-calibration.md | Dev C |
| 13 | `CONTRACT.md` prose for the new response | 03-spring-calibration.md | Dev C |
| 14 | Calibration report over the seeded corpus | 03-spring-calibration.md | Dev C |
| 15 | Relabel the score tiles honestly | 04-frontend-copy.md | Dev D |
| 16 | Cohort disclosure line | 04-frontend-copy.md | Dev D |
| 17 | Data-driven density reassurance, replacing the warn banner | 04-frontend-copy.md | Dev D |
| 18 | Visual hierarchy — composite dominates | 05-frontend-shell.md | Dev E |
| 19 | Recompute state + insufficient-cohort empty state | 05-frontend-shell.md | Dev E |
| 20 | Accessibility + explicit proceed affordance | 05-frontend-shell.md | Dev E |
| 21 | Unit + Playwright coverage | 05-frontend-shell.md | Dev E |

## The frozen contract (Task 4 defines it; Tasks 6–21 consume it)

Every task codes against this shape. It is settled in Task 1 and does not change afterwards.

```jsonc
{
  "overallScore":      68,        // == semanticPercentile. The headline.
  "semanticsScore":    37,        // raw distinctiveness 0-100, retained for continuity
  "categoryScore":     100,       // classification confidence — NOT part of overallScore
  "semanticPercentile": 68,       // rank against the cohort's own distance distribution
  "cohortSize":        34,        // businesses actually compared against
  "cohortMedianScore": 41,        // median semanticsScore within that cohort
  "cohortCategories":  ["Adventure & Nature"],
  "categoryDensity":   "dense",   // "dense" | "moderate" | "sparse"
  "sufficientCohort":  true,      // false when cohortSize < 3
  "descriptionFeedback": "…",     // populated at last — empty string today
  "categoryFeedback":    "…"
}
```

## File structure

### Created

| File | Responsibility | Task |
|---|---|---|
| `backend/spring-boot/src/main/resources/db/migration/V26__module1_reference_corpus.sql` | `is_reference` flag + reference business profiles across all 7 categories | 2 |
| `backend/spring-boot/src/main/resources/db/dump/uniqueness-corpus.sql` | Importable dump — the shared data every developer works from | 3 |
| `scripts/generate-reference-corpus.py` | Embeds the reference profiles and exports the dump | 3 |
| `scripts/uniqueness-calibration-report.py` | Per-category distance distributions over the seeded corpus | 14 |
| `frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.tsx` | The three score tiles | 5 |
| `frontend/components/module-1/onboarding/steps/analysis/CohortContext.tsx` | Cohort disclosure + density reassurance | 5 |
| `frontend/components/module-1/onboarding/steps/analysis/CategoryPicker.tsx` | Inferred-category chips | 5 |

### Modified

| File | Change | Task |
|---|---|---|
| `backend/fastapi-sbert/app/services/ml_classifier.py` | E5 prefixes; delete `predict_top3` / `_predict_probs`; percentile scoring | 1, 6 |
| `backend/fastapi-sbert/app/services/embedding_store.py` | Category-filtered fetch + cohort statistics | 7, 8 |
| `backend/fastapi-sbert/app/routers/classification.py` | Composite change + new response fields | 9, 10 |
| `backend/spring-boot/.../uniquenessscoring/dto/UniquenessDtos.java` | New response fields | 4, 11 |
| `backend/spring-boot/.../uniquenessscoring/UniquenessScoringController.java` | Pass the new fields through | 11 |
| `frontend/types.ts` | `UniquenessResult` gains the new fields | 4 |
| `frontend/services/apiClient.ts` | Dev-only `USE_FIXTURES` branch matches the new shape | 4 |
| `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx` | Reduced to composition + phase state | 5, 18–20 |
| `backend/CONTRACT.md` | Uniqueness response documented | 4, 13 |
| `RUNNING.md` | Dump import instructions | 3 |

## Out of scope

- **The hosted HF Space.** `category_score` keeps returning normalised shares; this plan stops
  *averaging it into the headline* rather than redefining it. Changing the Space's output contract is
  separate work — see the note at the end of `02-scoring-math.md`.
- **Re-scoring existing saved profiles.** `tbl_business_profile.uniqueness_score` holds values from
  the old formula. This plan does not backfill them; Module 2/3/4 do not read that column today.
- **The `ceview/` frozen build.** Its Module 1 screens are not touched.
