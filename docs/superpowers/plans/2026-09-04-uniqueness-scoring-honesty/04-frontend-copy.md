# Frontend Copy — Say What Was Actually Measured (Tasks 15–17)

**Owner:** Dev D, alone.
**Prerequisite:** `01-prerequisites.md` merged, dump imported.
**Runs in parallel with:** 02, 03, 05. Touches no file they touch.
**Purpose:** Make the words around the number true — every label names what the API actually measured,
the comparison cohort is disclosed next to the percentile, and a crowded category is reframed from
real data instead of warned about.

**Files owned by this task — no other task edits them:**
- `frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.tsx`
- `frontend/components/module-1/onboarding/steps/analysis/CohortContext.tsx`

Dev E owns `AnalysisStep.tsx` and `CategoryPicker.tsx`. If a change here seems to need an edit there,
it belongs to Task 18–21 — raise it rather than reaching across.

This task is where the screen stops overclaiming. The backend work makes the number correct; this
makes the words around it true. Consult the `tourism-app-branding` skill before writing any markup —
this directory follows the brand form rhythm (`.ob-step-intro`, `.field-hint`, `.banner`), not
ad-hoc Tailwind.

---

### Task 15: Relabel the score tiles honestly

Three labels are currently wrong or misleading:

- **"Description strength"** renders `semanticsScore`, which is corpus-relative position. It is not a
  judgment of the operator's writing, and reading it as one is exactly the wrong lesson — an operator
  with an excellent description in a crowded category sees a low number and concludes their writing
  is bad.
- **"Category fit"** renders a normalised allocation share. It is not comparable across different
  numbers of selected categories and, after Task 9, is not part of the headline at all.
- **"Overall uniqueness"** is now specifically a percentile, which is a much more interpretable thing
  than the label admits.

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.tsx`
- Test: `frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.test.tsx` (create)

- [ ] **Step 1: Write the failing tests** — the rendered tiles name a percentile, describe the
      comparison rather than the operator's writing, and mark category fit as a classification
      indicator rather than a score component.

- [ ] **Step 2: Relabel.**
      - `overallScore` → **"Distinctiveness percentile"**, with a one-line subtitle stating what it
        ranks against: *"You rank above 68% of the businesses you were compared with."*
      - `semanticsScore` → **"Raw distinctiveness"**, subtitled as the underlying distance measure,
        visually subordinate to the percentile.
      - `categoryScore` → **"Classification confidence"**, with a subtitle saying plainly that it
        does not affect the score above. Without that sentence, three tiles in a row read as three
        components of one number, which is the misreading this plan exists to fix.

- [ ] **Step 3: Do not add layout or hierarchy changes.** Task 18 owns visual weight. Keep this diff
      to text, subtitles, and the props needed to render them.

**Milestone:** no label on the screen claims something the API did not measure.

---

### Task 16: Cohort disclosure

A percentile is unreadable without its comparison set. "68" means nothing until the reader knows
whether it is against 4 businesses or 400, and whether they were in the same line of work.

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/analysis/CohortContext.tsx`
- Test: `frontend/components/module-1/onboarding/steps/analysis/CohortContext.test.tsx` (create)

- [ ] **Step 1: Write the failing test** — the rendered output names the cohort size and the
      categories it was drawn from, sourced from `cohortSize` and `cohortCategories`, never
      hardcoded.

- [ ] **Step 2: Render the disclosure line** directly beneath the tiles: *"Compared against 34
      Adventure & Nature businesses in Cebu. The median score in this group is 41."*

- [ ] **Step 3: Handle `sufficientCohort: false` with honest copy** — *"Only 2 comparable businesses
      are on record, too few to rank against. Your score will sharpen as more operators in your
      category join."* Never a number. Dev E builds the surrounding empty state in Task 19; this task
      supplies the sentence.

- [ ] **Step 4: Pluralise properly** (1 business, 2 businesses) and handle multiple categories in
      `cohortCategories` — an operator who keeps two chips gets a two-category cohort, and "34
      Adventure & Nature, Coastal & Island businesses" must read correctly.

**Milestone:** the number on screen is never presented without the set it was measured against.

---

### Task 17: Data-driven density reassurance, replacing the warn banner

Today's banner says *"Room to sharpen your positioning. A more specific UVP usually raises this
score."* For an operator in a saturated category this is both wrong and demoralising: the score is
low because the category is crowded, and rewriting the UVP moves it very little. Worse, it only
appears when the score is low, so it reads as a reprimand.

The replacement is **always visible** and quotes the category's real density — context for everyone,
consolation for no one.

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/analysis/CohortContext.tsx`
- Related: `docs/module-1/uniqueness-calibration.md` (Task 14) — quote its measured ranges, do not
  invent typical values

- [ ] **Step 1: Write the failing tests** — the density explainer renders at a high score as well as
      a low one, and its wording changes with `categoryDensity` rather than with the score.

- [ ] **Step 2: Write the three density variants,** each naming the real cohort size:
      - **dense** — *"Adventure & Nature is one of Cebu's most crowded categories (34 businesses on
        record). Scores here cluster lower than in quieter categories, because you are being compared
        against many similar operators. A 45 here is not the same as a 45 in a sparse category."*
      - **moderate** — *"Cultural & Heritage has a mid-sized cohort (9 businesses on record), so
        scores here spread fairly evenly."*
      - **sparse** — *"Urban & City has few businesses on record (5), so scores here run high and
        will settle as more operators join."* Saying this out loud matters: an operator in a sparse
        category deserves to know their high score is partly an artifact of a thin cohort.

- [ ] **Step 3: Add the proceed reassurance,** always visible and unconditional: *"This score does not
      gate anything. You can finish setting up and refine your profile later from Settings."* It is
      already true in code — `stepValid` case 4 only checks that a score exists — and has simply
      never been said.

- [ ] **Step 4: Delete the old warn banner's advice.** If a "sharpen my UVP" affordance is kept, it
      must be framed as an option, not a remedy for a low score, and must still deep-link to Step 3.
      Dev E owns the `onGoToStep` wiring in `AnalysisStep.tsx` — coordinate on the prop, do not edit
      that file.

- [ ] **Step 5: Run the tests.**
      ```bash
      cd frontend && npm run test:unit -- analysis/
      ```

**Milestone:** an operator with a 37 in a crowded category understands why, is not told to rewrite
something that will not help, and knows they can proceed.

---

## Definition of Done

- [ ] No tile label describes something the API did not measure
- [ ] Cohort size and categories are always disclosed alongside the score
- [ ] The density explainer renders at every score, driven by `categoryDensity`
- [ ] Reassurance copy quotes measured ranges from `uniqueness-calibration.md`, not invented ones
- [ ] The old "a more specific UVP usually raises this score" string is gone from the codebase
- [ ] Only `ScoreTiles.tsx` and `CohortContext.tsx` (and their new tests) are modified
- [ ] Code review approved

## Verification

```bash
cd frontend && npm run test:unit -- analysis/ && npx tsc --noEmit
grep -rn "more specific UVP usually raises" frontend/    # must return nothing
```

Manually, with the stack running: complete onboarding as an Adventure & Nature business and confirm
the density explainer appears at a *high* score too. If it only shows up when the score is low, it
has been rebuilt as a consolation message and the task is not done.

## Commit — **a human runs this**

```bash
git add frontend/components/module-1/onboarding/steps/analysis
git commit -m "feat(module-1): disclose the cohort and explain category density on the score screen"
```
