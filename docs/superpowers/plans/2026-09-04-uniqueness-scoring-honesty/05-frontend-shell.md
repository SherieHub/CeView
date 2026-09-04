# Frontend Shell — Hierarchy, States, Accessibility, Coverage (Tasks 18–21)

**Owner:** Dev E, alone.
**Prerequisite:** `01-prerequisites.md` merged, dump imported.
**Runs in parallel with:** 02, 03, 04. Touches no file they touch.

**Files owned by this task — no other task edits them:**
- `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`
- `frontend/components/module-1/onboarding/steps/analysis/CategoryPicker.tsx`
- `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`
- `e2e/tests/onboarding-uniqueness.spec.ts`

Dev D owns `ScoreTiles.tsx` and `CohortContext.tsx` — their labels and copy. This task owns the frame
around them: what dominates, what happens in each state, and whether any of it works without a mouse.

Consult the `tourism-app-branding` skill before changing markup. This directory uses the shared brand
primitives (`.card`, `.banner`, `.heading-xl`, `.eyebrow`) rather than ad-hoc Tailwind; see the
precedence note in `docs/superpowers/plans/2026-08-15-frontend-branding-alignment.md`.

---

### Task 18: Visual hierarchy — the composite dominates

Three identically-sized `.card` tiles give a derived percentile exactly the same visual weight as the
two diagnostics beside it. The layout says "three equal metrics"; the truth after Task 9 is "one
score, and two things that explain it." Readers trust layout over labels, so Dev D's honest copy is
undermined until this changes.

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx:228-250`

- [ ] **Step 1: Promote the percentile** to a full-width primary card above the other two, at
      `.heading-xl` or larger, with the diagnostics rendered beneath at reduced weight.

- [ ] **Step 2: Make the relationship legible** — a short line stating that the two below explain the
      score above rather than combining into it. Task 15 supplies the tile-level wording; this is the
      structural grouping that supports it.

- [ ] **Step 3: Keep the grid responsive.** The current `md:grid-cols-3` must not leave the
      diagnostics cramped on narrow screens; stack them.

- [ ] **Step 4: Do not edit `ScoreTiles.tsx`.** Pass layout intent as a prop or wrap the component.
      Reaching into Dev D's file is what this split exists to prevent.

**Milestone:** a reader who never reads a label still understands there is one score and two
explanations.

---

### Task 19: Recompute and insufficient-cohort states

Two gaps in the current phase machine (`Phase = 'idle' | 'analyzing' | 'categories' | 'computing' |
'scored'`):

- After scoring, the primary button still reads "Compute uniqueness score" as though nothing has
  happened.
- `sufficientCohort: false` has no rendering at all — the screen would show whatever `overallScore`
  arrived, which is precisely the silent-100 problem Task 10 fixed in the backend. Fixing it there
  and not here just moves the lie.

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`
- Modify: `frontend/components/module-1/onboarding/steps/analysis/CategoryPicker.tsx`

- [ ] **Step 1: Flip the button to "Recompute score"** once `phase === 'scored'`, and keep the
      existing behaviour where changing a category invalidates the score and returns to `categories`
      (`AnalysisStep.tsx:104-112` — that logic is already correct, do not disturb it).

- [ ] **Step 2: Add an `insufficient-cohort` branch** that renders `CohortContext`'s small-cohort
      copy (Task 16) instead of the score tiles. No number, no percentile, no banner implying
      success.

- [ ] **Step 3: Keep Finish enabled in that state.** `stepValid` case 4 gates on `uniquenessScore !=
      null`, so decide deliberately what gets written to the draft when there is no defensible score —
      and write a test pinning that decision, since it is the one place this task can accidentally
      trap an operator on Step 5.

- [ ] **Step 4: Preserve the existing `ApiErrorPanel` path.** `sufficientCohort: false` is a valid
      response, not an error; it must not render as a red failure panel.

**Milestone:** every backend response has exactly one honest rendering.

---

### Task 20: Accessibility and the explicit proceed affordance

The tiles are bare numbers inside `<p>` elements. A screen reader announces "68" with no scale, no
direction, and no indication of which of the three it belongs to.

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`

- [ ] **Step 1: Give each score an accessible description** — its scale (0–100), its direction
      (higher is better), and what it measures. Use the existing `aria-describedby` pattern from the
      onboarding steps rather than a new convention.

- [ ] **Step 2: Announce phase transitions.** `analyzing` and `computing` already use `role="status"`
      on the banner; extend that to the arrival of results so the score is announced rather than
      silently replacing the spinner.

- [ ] **Step 3: Make proceeding visibly available.** A low score already never blocks Finish; the
      screen has simply never said so. Dev D supplies the sentence in Task 17 — this task makes sure
      it sits where an operator looking at a disappointing number will actually see it, adjacent to
      the score rather than at the bottom of the page.

- [ ] **Step 4: Check keyboard traversal** through the category chips, the recompute button, and
      Finish. The chips are `aria-pressed` buttons already; confirm the split in Task 5 did not break
      focus order.

**Milestone:** the screen is usable and comprehensible without sight or a mouse.

---

### Task 21: Unit and end-to-end coverage

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`
- Create: `e2e/tests/onboarding-uniqueness.spec.ts`

- [ ] **Step 1: Unit-test each phase** including the two new branches — `scored` with a sufficient
      cohort, and `insufficient-cohort`. Assert the recompute label flips and that changing a category
      invalidates the score.

- [ ] **Step 2: Assert Finish is reachable at a low score.** This is the plan's core user-facing
      promise; it deserves a test that fails loudly if a future change gates on a threshold.

- [ ] **Step 3: Write the Playwright spec** walking onboarding Steps 1–5 against the seeded corpus
      with an Adventure & Nature profile, asserting the cohort disclosure names a real size and that
      Finish completes.

- [ ] **Step 4: Add the regression that started this plan** — score a profile, rewrite its UVP to be
      materially more specific, rescore, and assert the number **changed**. If the frontend cannot
      observe movement, the calibration did not work end to end, and this is the test that catches it
      before an operator does.

- [ ] **Step 5: Run everything.**
      ```bash
      cd frontend && npm run test:unit
      npx playwright test e2e/tests/onboarding-uniqueness.spec.ts
      ```

**Milestone:** the behaviours this plan promises are pinned by tests, not by intent.

---

## Definition of Done

- [ ] The percentile is visually dominant; the diagnostics read as subordinate
- [ ] `sufficientCohort: false` renders its own state, never a bare number
- [ ] The button reads "Recompute score" after the first run
- [ ] Every score carries an accessible description of scale and direction
- [ ] Finish is reachable at every score, with a test proving it
- [ ] The UVP-specificity regression test passes end to end
- [ ] Only this task's owned files are modified
- [ ] Code review approved

## Verification

```bash
cd frontend && npm run test:unit && npx tsc --noEmit
npx playwright test e2e/tests/onboarding-uniqueness.spec.ts
```

Manually, with the stack running and the dump imported: complete onboarding, then tab through Step 5
from the category chips to Finish without a mouse.

## Commit — **a human runs this**

```bash
git add frontend/components/module-1/onboarding/steps e2e/tests/onboarding-uniqueness.spec.ts
git commit -m "feat(module-1): rework the uniqueness score screen's hierarchy, states and a11y"
```
