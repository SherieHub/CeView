# Frontend Shell (Tasks 18–21) — Corrected Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Onboarding Step 5's frame honest — one score visually dominant over two diagnostics,
every backend state rendered, the screen operable without a mouse, and all of it pinned by tests.

**Architecture:** `AnalysisStep.tsx` keeps phase state and the API calls; the presentational parts
live in `./analysis/`. Dev E owns the frame (`AnalysisStep.tsx`, `CategoryPicker.tsx`) and Dev D owns
the words (`ScoreTiles.tsx`, `CohortContext.tsx`). Two of the four tasks below cannot be completed
without crossing that line, so this plan names the crossings explicitly and pins them to an agreed
contract rather than leaving them to be discovered mid-task.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + @testing-library/react, Playwright.

---

## Review findings — why the original doc is not executable as written

Verified against the code at `ba9758a1`. Ten items, **all now resolved in-plan** — none of them
blocks execution.

Four looked blocking. B8 and B9 dissolved on inspection: the repo had already solved both and the
task doc did not know. B1 and B2 are real ownership crossings, and the decision has been taken —
**Dev E makes both edits directly**, because `CVW-29-Uniqueness-Score-Frontend-1` has **zero commits**
and has not touched either file, so there is no one to coordinate with and nothing to collide with.
Both are flagged in the PR rather than blocked on approval (wording in "PR note" below).

None of the ten is a matter of taste; each is a claim in the doc that the code contradicts.

### 🟢 B1 — DECIDED: Task 18 is impossible under its own ownership rule

Task 18 Step 1 promotes the percentile to a full-width card above the other two. Step 3 restructures
the responsive grid. Step 4 says **"Do not edit `ScoreTiles.tsx`."**

But the grid and all three tiles ARE `ScoreTiles.tsx`'s entire body:

```tsx
// frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.tsx:33
<div className="grid gap-4 md:grid-cols-3">
  <div className="card">…overallScore…</div>
  <div className="card">…semanticsScore…</div>
  <div className="card">…categoryScore…</div>
</div>
```

Step 4's suggested escapes do not work:
- **"Wrap the component"** — a wrapper cannot reorder or reweight another component's internal
  children.
- **"Pass layout intent as a prop"** — `ScoreTiles` has no such prop, and adding one *is* an edit to
  `ScoreTiles.tsx`.

Task 15 Step 3 independently forbids Dev D from doing it ("Do not add layout or hierarchy changes").
So as written, **neither developer can produce the hierarchy.**

**Decision: Dev E restructures `ScoreTiles.tsx` into two exports.** CVW-29 has no commits and has not
touched the file, so the rule guards a collision that does not exist.

**Superseded during execution:** the first attempt added a `variant?: 'grid' | 'hierarchy'` prop.
That was wrong. `AnalysisStep` is the *only* consumer, so once it passes `variant="hierarchy"` the
`grid` branch is dead code — and that dead branch still contained the percentile tile, which Task 15
has to relabel ("Overall uniqueness" → "Distinctiveness percentile"). Task 15 would have edited markup
that no longer rendered, while the live percentile sat duplicated in `AnalysisStep.tsx`.

Shipped instead: `ScoreTiles.tsx` exports `PercentileTile` (the headline) and a default `ScoreTiles`
(the two diagnostics). **Every tile's markup and copy still lives in that one file** — Task 15
relabels all three in place — and only *placement* moved to `AnalysisStep`, which is what Task 18
actually owns. No dead code. Applied in Task 18 Step 0.

### 🟢 B2 — DECIDED: Task 19 Step 3 cannot keep Finish reachable without editing a file Dev E does not own

```ts
// frontend/components/module-1/onboarding/obDraft.tsx:143
case 4:
  return draft.uniquenessScore != null; // Analysis — true once obPhase === 'scored'
```

In the `insufficient-cohort` state there is no defensible score. The three options:

| Option | Consequence |
|---|---|
| Write `uniquenessScore: null` | Finish stays **disabled** — traps the operator on Step 5. Violates the task's own Step 3. |
| Write the raw `overallScore` anyway | Persists the exact silent-100 lie Task 10 fixed in the backend, and it leaks to the dashboard and Settings. |
| Add a draft flag and relax `stepValid` | Correct, but edits `obDraft.tsx` — **not in Dev E's owned-files list.** |

Task 19 Step 3 says "decide deliberately … and write a test pinning that decision" but does not make
the decision, and the only correct option is out of scope.

**Decision: option 3, applied by Dev E.** The edit is purely additive (one field, one `||`) and no
other in-flight work touches `obDraft.tsx`. Applied in Task 19 Step 0, pinned by a test in Step 3.

### 🟡 B3. Landmine: the existing test fixture will silently flip every test into the new branch

```ts
// frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx:65
const SCORES = { overallScore: 72, semanticsScore: 70, categoryScore: 74, … };
```

No cohort fields, and `uniquenessMock` is an untyped `vi.fn()` so TypeScript never caught it. Once
Task 19 branches on `sufficientCohort`, `undefined` is falsy → **all five existing tests render the
insufficient-cohort state and fail.** The fixture must be fixed in the same task that adds the
branch, not deferred to Task 21.

### 🟡 B4. Dev D's Task 17 turns Dev E's test file red

`AnalysisStep.test.tsx:146-163` asserts three strings that live in Dev D's `CohortContext.tsx`:
`Strong differentiation`, `Room to sharpen your positioning`, `Strengthen my UVP`. Task 17 deletes
all three. The "no shared files" claim is true file-by-file and **false behaviourally** — whoever
lands second sees a red suite they did not break. Task 21 Step 5 handles this.

### 🟡 B5. Task 20 Step 2's premise is wrong

> "`analyzing` and `computing` already use `role="status"` on the banner; extend that…"

There is exactly one `role="status"` in the file (line 177, `analyzing`). `computing` renders no
banner at all — only the button's inline spinner. It must be **added**, not extended.

### 🟡 B6. Every line reference is stale (they point at the pre-split file)

| Doc says | Actually |
|---|---|
| `AnalysisStep.tsx:228-250` (tiles) | file is **224 lines**; the block is **216–221** |
| `AnalysisStep.tsx:104-112` (invalidation) | that is the `useEffect` eslint comment; the logic is **110–125** |

### 🟡 B7. Task 21's e2e work has three unmet upstream dependencies

Step 3 asserts "the cohort disclosure names a real size" — that copy is **Dev D's Task 16**. Step 4's
regression needs the seeded corpus **and** working calibration. Task 17 quotes
`docs/module-1/uniqueness-calibration.md` (Task 14) — **that file does not exist yet**. Task 21 is
therefore *not* parallel-safe with 02/03/04 despite the header's claim; it is the join point.

### 🟢 B8 — RESOLVED: no seeded operator can reach `/onboarding` at all

Task 21 Step 3 says "walk onboarding Steps 1–5 against the seeded corpus". That cannot be done with
any seeded account:

```ts
// frontend/services/profileContext.tsx — ProfileGate
if (complete && onOnboardingRoute) return <Navigate to="/dashboard" replace />;
```

`complete` is `profile.uniquenessScore != null`, and **all nine seeded operators have one**
(`V2__module1_profile_multi_category.sql` — 0.74, 0.69, 0.63, 0.71, 0.66, 0.77, 0.68, 0.61, 0.65 …).
Signing in as `SEED_OPERATOR` and navigating to `/onboarding` redirects straight to `/dashboard`, so
the spec would fail on its first assertion.

**Resolution:** register a fresh operator inside the spec. A new account has no business profile →
`uniquenessScore == null` → `ProfileGate` sends it to `/onboarding`. This needs no migration and no
change to shared seed data. Task 21 Step 6 below does it with verified selectors.

### 🟢 B9 — RESOLVED: do not create a new spec file at all

The original doc says *Create: `e2e/tests/onboarding-uniqueness.spec.ts`*. Following that literally
causes a silent failure: `.github/workflows/e2e.yml` derives its matrix from a `dorny/paths-filter`
block where the filter name *is* the spec filename, so a new unregistered spec is **never selected
and never runs** — no error, no warning.

But it should not be a new file. `e2e/tests/onboarding-wizard.spec.ts` already exists, is already
registered in CI, is entirely `test.describe.skip` scaffolding, and **already contains the block this
task owns**:

```ts
test.describe.skip('Step 5 Analysis', () => {
  test('completing analysis and compute reveals three score cards', …);
  test('deselecting the last remaining category is blocked with a toast, …', …);
  test('full journey: register -> complete all 5 steps -> lands on /dashboard …', …);
});
```

Its header states the house convention outright: *"Each starts skipped; the card that owns it
un-skips (and writes) its block as part of that card's own Definition of Done."*

**So Task 21 un-skips and writes `Step 5 Analysis` in that file.** No new file, no workflow edit, no
third coordination point. Note also that the scaffold's own wording — "full journey: **register**" —
independently confirms B8's resolution: registering a fresh operator was always the intended route in.

### 🟡 B9b. The DEV-only shortcut is unavailable in the CI job that runs this

`BasicInfoStep.tsx:101` offers a
"Fill with demo business" button that populates Steps 1–3 in one click — but it is wrapped in
`import.meta.env.DEV`, and the two CI jobs differ:

| Job | Serves the frontend with | `import.meta.env.DEV` | Demo-fill button |
|---|---|---|---|
| per-screen matrix (`:3000`) | `npm run build` + `npm run preview` | **false** | **tree-shaken out** |
| e2e-journey (`:3001`) | `npm run dev` | true | present |

A spec that clicks that button passes locally and on the journey job, and fails in the matrix job.
Task 21 Step 6 therefore fills the fields explicitly, which works in both.

### ✅ Verified sound — build on these without re-checking

- The `01-prerequisites.md` Task 5 split is merged: `analysis/{CategoryPicker,ScoreTiles,CohortContext}.tsx` all exist.
- `UniquenessResult` (`frontend/types.ts:87-111`) already carries `semanticPercentile`, `cohortSize`,
  `cohortMedianScore`, `cohortCategories`, `categoryDensity`, `sufficientCohort`. The contract is frozen.
- `Phase = 'idle' | 'analyzing' | 'categories' | 'computing' | 'scored'` — exactly as documented.
- Category-change invalidation (`toggleCategory`, lines 110–125) is correct. Do not disturb it.
- Chips are already `aria-pressed` buttons.
- `npm run test:unit` exists (`package.json:11`).

---

## Ordering

```
Task 18 ──┐
          ├──> Task 20 ──> Task 21 Steps 1–5   ← all of this is finishable now
Task 19 ──┘
                           Task 21 Steps 6–9   ← write, leave .skip'd, move to a follow-up ticket
                             ⤷ needs the seeded corpus + Task 16's copy + Task 14's doc
```

Nothing waits on another person. Tasks 18 and 19 are independent and may be done in either order;
Task 21's unit work (Steps 1–5) follows 19 and 20.

**Scope for this ticket (CVW-30): Tasks 18, 19, 20 and Task 21 Steps 1–5.** Task 21's live e2e
(Steps 6–9) has three real upstream dependencies that no decision can remove — see B7. Write the
block, leave it `.skip`ped with a comment naming what it waits on, and raise a follow-up ticket. That
lets CVW-30 close on work that is genuinely finished rather than on a test that cannot yet run.

---

### Task 18: Visual hierarchy — the composite dominates

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.tsx` ⚠️ outside stated ownership — see B1, Step 0 only
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx:216-221`
- Test: `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`

- [ ] **Step 0: Split `ScoreTiles.tsx` into two exports yourself.**

  This is the B1 resolution. `ScoreTiles.tsx` keeps every tile's markup and copy; the percentile
  becomes its own export so the parent can place it above the diagnostics. Do **not** use a `variant`
  prop — with one consumer it leaves the unused branch as dead code holding a percentile tile that
  Task 15 still has to relabel.

  You are editing a file the task doc assigns to Dev D. That is deliberate and checked:
  `CVW-29-Uniqueness-Score-Frontend-1` has **zero commits** and has not touched this file, so there is
  nothing to collide with — and the hierarchy cannot be built without it (see B1). Keep the diff to
  exactly what is below: structure only, no label or subtitle changes, so Task 15 merges on top
  cleanly. Put the "PR note" text at the foot of this plan into the PR description.

  Apply to `ScoreTiles.tsx` — two exports, percentile first:

```tsx
interface Props {
  scores: UniquenessResult;
}

/** The headline score. Placed by the parent ABOVE ScoreTiles, at .heading-xl. */
export function PercentileTile({ scores, describedBy }: Props & { describedBy?: string }) {
  return (
    <div className="card">
      <p className="eyebrow">Overall uniqueness</p>
      <p
        className="heading-xl mt-2"
        role="img"
        aria-label={`Overall uniqueness ${Math.round(scores.overallScore)}`}
        aria-describedby={describedBy}
      >
        {Math.round(scores.overallScore)}
      </p>
    </div>
  );
}

/** The two diagnostics, subordinate: .heading-md, and one column when narrow. */
export default function ScoreTiles({ scores }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="card">
        <p className="eyebrow">Description strength</p>
        <p className="heading-md mt-2">{Math.round(scores.semanticsScore)}</p>
        {scores.descriptionFeedback && (
          <p className="body-xs mt-2 text-[var(--color-text-muted)]">{scores.descriptionFeedback}</p>
        )}
      </div>
      <div className="card">
        <p className="eyebrow">Category fit</p>
        <p className="heading-md mt-2">{Math.round(scores.categoryScore)}</p>
        {scores.categoryFeedback && (
          <p className="body-xs mt-2 text-[var(--color-text-muted)]">{scores.categoryFeedback}</p>
        )}
      </div>
    </div>
  );
}
```

  `role="img"` + `aria-label` land here rather than in Task 20 because they are inseparable from this
  markup; `describedBy` points at the scale sentence, which the parent owns. Add
  `data-testid="cohort-context"` to **both** banner roots in `CohortContext.tsx` in the same commit —
  same reason, one attribute, no copy touched.

  Note `heading-md` on the diagnostics in both branches — that demotion is the "reduced weight" half
  of Step 1 and it can only happen in this file. **Labels and subtitles are still not yours to
  touch**: leave "Overall uniqueness", "Description strength" and "Category fit" exactly as they are,
  wrong as they read. Task 15 fixes the words; this step only moves boxes.

  Commit this on its own so the structural change is reviewable in isolation:

```bash
git add frontend/components/module-1/onboarding/steps/analysis/ScoreTiles.tsx
git commit -m "refactor(module-1): split ScoreTiles so the parent can own score hierarchy"
```

- [ ] **Step 1: Write the failing test**

  Add to `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`, inside
  `describe('AnalysisStep', …)`:

```tsx
  // Readers trust layout over labels: three equal cards say "three components
  // of one number", which is the misreading this whole plan exists to fix.
  it('renders the percentile as a primary card above the two diagnostics', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const primary = await screen.findByTestId('score-primary');
    expect(primary).toHaveTextContent('72');
    // The primary carries the largest type on the screen; the diagnostics do not.
    expect(primary.querySelector('.heading-xl')).not.toBeNull();

    const diagnostics = screen.getByTestId('score-diagnostics');
    expect(diagnostics.querySelector('.heading-xl')).toBeNull();
    // ...and it sits above them in DOM order, which is also reading order.
    expect(primary.compareDocumentPosition(diagnostics))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('states that the diagnostics explain the score rather than combining into it', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByText(/These two explain the score above/i)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && npm run test:unit -- AnalysisStep
```

  Expected: both new cases FAIL — `Unable to find an element by: [data-testid="score-primary"]`.

- [ ] **Step 3: Implement the hierarchy in `AnalysisStep.tsx`**

  Replace the `phase === 'scored'` block (currently lines 216–221):

```tsx
      {phase === 'scored' && scores && (
        <div className="mt-6">
          {/* One score, two explanations. The percentile gets its own full-width
              card and the largest type on the screen; the diagnostics sit below
              at .heading-md. Layout has to say this on its own — a reader who
              never reads a label still has to get it right. ScoreTiles renders
              The tiles and their copy stay in ScoreTiles.tsx (Dev D); only
              their placement is decided here. */}
          <div className="card" data-testid="score-primary">
            <p className="eyebrow">Overall uniqueness</p>
            <p className="heading-xl mt-2">{Math.round(scores.overallScore)}</p>
          </div>

          <p className="body-xs mt-4 mb-2 text-[var(--color-text-muted)]">
            These two explain the score above — they are not added into it.
          </p>

          <div data-testid="score-diagnostics">
            <ScoreTiles scores={scores} />
          </div>

          <CohortContext scores={scores} onGoToStep={onGoToStep} />
        </div>
      )}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd frontend && npm run test:unit -- AnalysisStep
```

  Expected: PASS, and the five pre-existing cases still pass.

- [ ] **Step 5: Verify the responsive stack by hand**

  With `npm run dev`, at a 375px-wide viewport confirm the two diagnostics stack in one column and
  neither truncates its feedback text.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-1/onboarding/steps/AnalysisStep.tsx \
        frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx
git commit -m "feat(module-1): make the percentile visually dominant over its two diagnostics"
```

**Milestone:** a reader who never reads a label still understands there is one score and two
explanations.

---

### Task 19: Recompute and insufficient-cohort states

**Files:**
- Modify: `frontend/components/module-1/onboarding/obDraft.tsx:143` ⚠️ outside stated ownership — see B2
- Modify: `frontend/services/fixtures/demoBusiness.ts` — `tsc` requires the new `ObDraft` field
- Modify: `frontend/components/module-1/onboarding/OnboardingWizard.test.tsx` — **B3 strikes twice**:
  this file has its own partial `uniquenessMock` with no cohort fields, so `sufficientCohort:
  undefined` makes the wizard save `uniquenessScore: null` and its Finish/DTO assertion fails. Found
  only by running the whole suite; `AnalysisStep.test.tsx` alone stays green.
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`
- Test: `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`

`CategoryPicker.tsx` is listed in the original doc but needs no change — the ">=1 selected" rule and
its hint already live there and are correct.

- [ ] **Step 0: Note the `obDraft.tsx` scope expansion in the PR, then proceed.**

  You are editing a file outside this task's stated ownership. That is the decided B2 resolution: the
  two in-scope alternatives either trap the operator on Step 5 or persist a score that was never
  computed. No other in-flight work touches `obDraft.tsx`.

  No approval gate — record it in the PR description (see "PR note" at the foot of this plan) and
  carry on. The change itself lands in Step 5 and is pinned by the test in Step 3.

- [ ] **Step 1: Fix the test fixture first — this is the B3 landmine**

  In `AnalysisStep.test.tsx`, replace `SCORES` (line 65) with the full contract, and add a
  small-cohort variant:

```tsx
const SCORES: UniquenessResult = {
  overallScore: 72,
  semanticsScore: 70,
  categoryScore: 74,
  semanticPercentile: 72,
  cohortSize: 34,
  cohortMedianScore: 41,
  cohortCategories: ['Coastal & Island'],
  categoryDensity: 'dense',
  sufficientCohort: true,
  descriptionFeedback: 'Solid.',
  categoryFeedback: 'Good fit.',
};

/** The backend's valid "too few to rank against" response — not an error. */
const SMALL_COHORT: UniquenessResult = {
  ...SCORES,
  overallScore: 0,
  semanticPercentile: 0,
  cohortSize: 2,
  cohortMedianScore: 0,
  categoryDensity: 'sparse',
  sufficientCohort: false,
};
```

  Add the import at the top of the file:

```tsx
import type { UniquenessResult } from '../../../../types';
```

  Typing `SCORES` is what stops this drifting again: an untyped literal is how the cohort fields went
  missing in the first place.

- [ ] **Step 2: Run the suite to confirm the fixture change alone is green**

```bash
cd frontend && npm run test:unit -- AnalysisStep && npx tsc --noEmit
```

  Expected: PASS. `tsc` proves the fixture now satisfies `UniquenessResult`.

- [ ] **Step 3: Write the failing tests**

```tsx
  it('flips the button to "Recompute score" once scored', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByRole('button', { name: /Recompute score/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compute uniqueness score/ })).toBeNull();
  });

  // sufficientCohort: false is a VALID response, not an error. Rendering the
  // number anyway is the silent-100 problem the backend already fixed; showing
  // ApiErrorPanel would call a correct answer a failure.
  it('renders the small-cohort state instead of a number, and never as an error', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SMALL_COHORT);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    await waitFor(() => expect(screen.queryByTestId('score-primary')).toBeNull());
    expect(screen.queryByTestId('score-diagnostics')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // The one place this task can accidentally trap an operator on Step 5.
  it('leaves Finish reachable when the cohort is too small to rank against', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SMALL_COHORT);
    fireEvent.click(screen.getByRole('button', { name: /Recompute score|Compute uniqueness score/ }));

    await waitFor(() => expect(latestDraft?.cohortInsufficient).toBe(true));
    // No defensible number, so none is written — the flag is what unblocks Finish.
    expect(latestDraft?.uniquenessScore).toBeNull();
    expect(stepValid(latestDraft!, 4)).toBe(true);
  });
```

  Add to the file's imports:

```tsx
import { stepValid } from '../obDraft';
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
cd frontend && npm run test:unit -- AnalysisStep
```

  Expected: three FAILs — the button name never changes, `score-primary` is still rendered, and
  `cohortInsufficient` does not exist.

- [ ] **Step 5: Add the draft flag and relax `stepValid`**

  In `frontend/components/module-1/onboarding/obDraft.tsx`, add to the `ObDraft` interface beside
  `uniquenessScore`:

```ts
  /**
   * True when the backend answered `sufficientCohort: false` — a valid response
   * meaning the cohort was too small to rank against. Finish must stay reachable
   * in that state, but writing a number to satisfy `stepValid` would persist a
   * score that was never computed. This flag carries "we asked and got a real
   * answer" without inventing one.
   */
  cohortInsufficient: boolean;
```

  Add `cohortInsufficient: false` to `EMPTY_OB_DRAFT`, and change case 4:

```ts
    case 4:
      // Either a real score, or an explicit "no rankable cohort" answer. Both
      // mean the operator has finished this step; only one has a number.
      return draft.uniquenessScore != null || draft.cohortInsufficient;
```

- [ ] **Step 6: Implement both states in `AnalysisStep.tsx`**

  Add a derived flag after the `scores` state is available (below `computeUniqueness`):

```tsx
  // A valid backend answer, not an error — see the CohortContext docblock.
  const insufficientCohort = phase === 'scored' && scores != null && !scores.sufficientCohort;
```

  In `computeUniqueness`'s `.then`, replace the single `setDraft` call:

```tsx
      .then((result) => {
        setScores(result);
        setPhase('scored');
        setDraft({
          ...draft,
          categories: selected,
          // No rankable cohort means no number to write. `cohortInsufficient`
          // is what keeps Finish reachable — see stepValid case 4.
          uniquenessScore: result.sufficientCohort ? result.overallScore : null,
          cohortInsufficient: !result.sufficientCohort,
        });
      })
```

  Reset the flag in `toggleCategory`'s invalidation branch so a stale "insufficient" cannot outlive
  the selection that produced it:

```tsx
    if (phase === 'scored') {
      setScores(null);
      setDraft({ ...draft, categories: next, uniquenessScore: null, cohortInsufficient: false });
      setPhase('categories');
    }
```

  Flip the button label:

```tsx
            {phase === 'computing' ? (
              <>
                <span className="spinner spinner--inverse" aria-hidden="true" /> Computing…
              </>
            ) : (
              <>
                <Sparkles size={16} aria-hidden="true" />
                {phase === 'scored' ? 'Recompute score' : 'Compute uniqueness score'}
              </>
            )}
```

  And gate the score block on a sufficient cohort, rendering `CohortContext` alone otherwise:

```tsx
      {phase === 'scored' && scores && !insufficientCohort && (
        /* …the Task 18 hierarchy block, unchanged… */
      )}

      {insufficientCohort && scores && (
        /* No number, no percentile, no success banner. CohortContext supplies
           the small-cohort sentence (Task 16); this is only the frame. */
        <div className="mt-6">
          <CohortContext scores={scores} onGoToStep={onGoToStep} />
        </div>
      )}
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd frontend && npm run test:unit -- AnalysisStep && npx tsc --noEmit
```

  Expected: PASS. `tsc` will also flag any other construction of `ObDraft` that now needs
  `cohortInsufficient` — fix those by adding the field, not by loosening the type.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/module-1/onboarding/obDraft.tsx \
        frontend/components/module-1/onboarding/steps/AnalysisStep.tsx \
        frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx
git commit -m "feat(module-1): render the small-cohort state and flip the button to Recompute"
```

**Milestone:** every backend response has exactly one honest rendering.

---

### Task 20: Accessibility and the explicit proceed affordance

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`
- Test: `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
  // "72" alone tells a screen-reader user nothing: no scale, no direction, and
  // no idea which of the three numbers on screen it is.
  it('describes the primary score with its scale and direction', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const score = await screen.findByRole('img', { name: /Overall uniqueness/i });
    expect(score).toHaveAccessibleDescription(/0 to 100.*higher is better/i);
  });

  // Results replacing a spinner is a silent swap for anyone not watching.
  it('announces the arrival of the result', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const live = await screen.findByTestId('score-primary');
    expect(live).toHaveAttribute('role', 'status');
  });

  it('announces the computing phase, which had no live region at all', async () => {
    await reachCategories();
    let resolve!: (v: unknown) => void;
    uniquenessMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByText(/Scoring against the local cohort/i)).toBeInTheDocument();
    resolve(SCORES);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && npm run test:unit -- AnalysisStep
```

  Expected: three FAILs — no accessible name on the score, no `role="status"`, no computing banner.

- [ ] **Step 3: Add the computing live region**

  In `AnalysisStep.tsx`, directly after the existing `analyzing` banner block (line 176–183). B5:
  this region does not exist today, contrary to the original doc.

```tsx
      {phase === 'computing' && (
        <div className="banner banner--info" role="status">
          <Loader2 className="animate-spin" aria-hidden="true" />
          <div>
            <b>Scoring against the local cohort…</b> Comparing your profile with similar businesses.
          </div>
        </div>
      )}
```

- [ ] **Step 4: Describe the primary score and announce its arrival**

  Update the Task 18 primary card. `role="img"` with an `aria-label` is what lets a screen reader
  read the number as one labelled value instead of a bare digit string:

```tsx
          <div className="card" data-testid="score-primary" role="status">
            <p className="eyebrow" id="score-primary-label">Overall uniqueness</p>
            <p
              className="heading-xl mt-2"
              role="img"
              aria-label={`Overall uniqueness ${Math.round(scores.overallScore)}`}
              aria-describedby="score-primary-desc"
            >
              {Math.round(scores.overallScore)}
            </p>
            <p id="score-primary-desc" className="body-xs mt-1 text-[var(--color-text-muted)]">
              Scored 0 to 100, where higher is better — how distinct your profile is from the
              businesses you were compared with.
            </p>
          </div>
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd frontend && npm run test:unit -- AnalysisStep
```

  Expected: PASS.

- [ ] **Step 6: Place the proceed reassurance next to the score**

  Dev D writes the sentence in Task 17 inside `CohortContext`. Dev E's job is only that it renders
  **adjacent to the score, not at the foot of the page** — which the Task 18 block already does, since
  `CohortContext` sits inside the same `mt-6` group. Confirm visually and record it; no code change
  if it already reads that way.

- [ ] **Step 7: Check keyboard traversal by hand**

  With `npm run dev`, from the first category chip press `Tab` and confirm the order is: chips (in
  DOM order) → Compute/Recompute → any link inside `CohortContext` → Finish. Confirm `Space` and
  `Enter` both toggle a chip, and that focus is visible on every stop.

- [ ] **Step 8: Commit**

```bash
git add frontend/components/module-1/onboarding/steps/AnalysisStep.tsx \
        frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx
git commit -m "feat(module-1): announce scoring phases and describe the score for screen readers"
```

**Milestone:** the screen is usable and comprehensible without sight or a mouse.

---

### Task 21: Unit and end-to-end coverage

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`
- Modify: `e2e/tests/onboarding-wizard.spec.ts` (un-skip its `Step 5 Analysis` block)

- [ ] **Step 1: Assert Finish is reachable at a low score**

  The plan's core user-facing promise. It deserves a test that fails loudly if anyone ever gates on a
  threshold.

```tsx
  it('leaves Finish reachable at a low score — nothing gates on a threshold', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue({ ...SCORES, overallScore: 3, semanticPercentile: 3 });
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    await waitFor(() => expect(latestDraft?.uniquenessScore).toBe(3));
    expect(stepValid(latestDraft!, 4)).toBe(true);
  });
```

- [ ] **Step 2: Assert a category change still invalidates the score**

  Pins the behaviour the original doc flagged as "already correct, do not disturb" — after Task 19
  rewrote the branch it touches, that is no longer self-evident.

```tsx
  it('invalidates the score and returns to the picker when a category changes', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));
    await screen.findByTestId('score-primary');

    fireEvent.click(screen.getByRole('button', { name: /Adventure & Nature/ }));

    expect(screen.queryByTestId('score-primary')).toBeNull();
    expect(latestDraft?.uniquenessScore).toBeNull();
    expect(latestDraft?.cohortInsufficient).toBe(false);
    expect(screen.getByRole('button', { name: /Compute uniqueness score/ })).toBeInTheDocument();
  });
```

- [ ] **Step 3: Run the unit suite**

```bash
cd frontend && npm run test:unit -- AnalysisStep && npx tsc --noEmit
```

  Expected: PASS.

- [ ] **Step 4: Prove each new test actually bites**

  Break each one deliberately and confirm it fails, then revert:

  | Mutation | Test that must go red |
  |---|---|
  | `phase === 'scored' ? 'Recompute score' : …` → always `'Compute uniqueness score'` | "flips the button to Recompute score" |
  | `!scores.sufficientCohort` → `false` | "renders the small-cohort state" |
  | `cohortInsufficient: !result.sufficientCohort` → `false` | "leaves Finish reachable when the cohort is too small" |
  | drop `role="status"` from the primary card | "announces the arrival of the result" |

  A test that stays green under its mutation is not testing what its name claims. Fix it before
  moving on.

- [ ] **Step 5: Reconcile the two banner tests Dev D's Task 17 deletes**

  This is B4. `AnalysisStep.test.tsx:146-163` asserts `Strong differentiation`, `Room to sharpen your
  positioning` and `Strengthen my UVP` — all three are deleted by Task 17. Once Dev D's work is on
  the branch, replace both cases with one that asserts the frame rather than Dev D's wording:

```tsx
  // Deliberately asserts PRESENCE, not copy. These used to pin the 70-threshold
  // pass/warn strings; Task 17 replaced them with an always-visible density
  // explainer, and re-pinning Dev D's exact sentences here would just recreate
  // the cross-ownership coupling that broke this file.
  it('renders the cohort context beneath the score at every score', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue({ ...SCORES, overallScore: 3 });
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const primary = await screen.findByTestId('score-primary');
    const context = screen.getByTestId('cohort-context');
    expect(primary.compareDocumentPosition(context)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
```

  `data-testid="cohort-context"` does not exist yet — add it to `CohortContext.tsx`'s root element
  yourself, in the same commit as the ScoreTiles split and for the same reason (B1). One attribute,
  changes no copy, so Task 16–17's rewrite of that file merges straight over it. Both branches of that
  component need it, since the small-cohort state renders the other one:

```tsx
// CohortContext.tsx — on BOTH returned <div className="banner …"> elements
<div className="banner banner--info mt-4" role="status" data-testid="cohort-context">
```

- [ ] **Step 6: Write the Playwright spec — but leave it `.skip`ped**

  Write the `Step 5 Analysis` block in the EXISTING `e2e/tests/onboarding-wizard.spec.ts`, replacing
  its `test.fixme()` placeholders with the cases below — but **keep `test.describe.skip`** and add a
  comment naming what it waits on:

```ts
// Un-skip once the seeded reference corpus is imported (01-prerequisites.md) and
// Task 16's cohort disclosure has landed — the assertions below read the cohort
// size out of copy that does not exist yet. Tracked in <follow-up ticket>.
test.describe.skip('Step 5 Analysis', () => {
```

  Writing it now is still worth it: the selectors were verified against the components in this pass,
  and re-deriving them later costs more than leaving them here. Do not un-skip. Do not create a new file (B9). Every selector was read off the
  components, not guessed — the notes say which, because three are not what you would reach for first.

```ts
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { requireBackend } from './support/stack';

// Screen: /onboarding Step 5 — docs/superpowers/plans/2026-09-04-uniqueness-scoring-honesty/
//
// Runs against the REAL stack with the seeded reference corpus imported
// (01-prerequisites.md). Without that dump the cohort is empty and every
// assertion here is meaningless, so this spec is only honest once it is loaded.
//
// Registers a FRESH operator rather than using SEED_OPERATOR: ProfileGate
// redirects any profile with a uniquenessScore away from /onboarding, and all
// nine seeded operators have one (V2__module1_profile_multi_category.sql). A
// new account has no profile, so it lands on the wizard. See B8 in the plan.
test.describe('Onboarding — uniqueness score', () => {
  test.beforeEach(async () => {
    await requireBackend();
  });

  /** Unique per run — re-registering a fixed address would 409 on the second run. */
  function freshEmail() {
    return `e2e-uniqueness-${Date.now()}-${Math.floor(Math.random() * 1e6)}@ceview.local`;
  }

  async function registerAndReachStepFive(page: Page) {
    await page.goto('/');
    // Both the tab and the submit button are named "Create account"; the role
    // is what separates them.
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('Contact number').fill('+63 917 000 0000');
    await page.getByPlaceholder('you@example.com').fill(freshEmail());
    await page.getByPlaceholder('••••••••').fill('MoalboalDive2024!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });

    // Step 1. These use <span class="field-label">, NOT <label for>, so
    // getByLabel finds nothing — placeholders are the only stable handle.
    // The DEV-only "Fill with demo business" shortcut is deliberately not used:
    // it is tree-shaken out of the production build the matrix job serves (B9).
    await page.getByPlaceholder('e.g. Sunset Cove Beach Resort').fill('E2E Reef Expeditions');
    await page.locator('select').selectOption('Adventure & Nature');
    await page.getByPlaceholder('One line that captures what you offer').fill('Dive the wall at dawn.');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 2 — vibes are aria-pressed buttons; core services take Enter.
    await page.getByRole('button', { name: 'Adventurous' }).click();
    await page.getByRole('button', { name: 'Eco-Conscious' }).click();
    const service = page.getByPlaceholder('Type a service and press Enter…');
    await service.fill('Guided reef dives');
    await service.press('Enter');
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 3 — stepValid gates on word count: description >= 50, uvp >= 30
    // (obDraft.tsx MIN_WORDS). Both strings below clear those floors; shortening
    // them silently disables Continue.
    await page
      .getByPlaceholder('What is the property, where exactly is it, what does a guest actually experience?')
      .fill(
        'A small freediving and snorkelling outfit on the Moalboal shoreline in Cebu, running two '
        + 'daily boat trips out to the resident sardine ball and the turtle sanctuary just south of '
        + 'Panagsama Beach. Groups are capped at six guests so every diver gets individual attention '
        + 'from an instructor, and every booking includes full gear rental, a shore briefing, and an '
        + 'underwater photo review back at the shop afterwards over coffee.',
      );
    await page
      .getByPlaceholder('What can a guest get here that they genuinely cannot get from the business next door?')
      .fill(
        'We are the only operator on this stretch of coast that logs the sardine ball position every '
        + 'morning before any group leaves the shore, so guests are taken to where the shoal actually '
        + 'is that day rather than to where it usually sits.',
      );
    await page.getByRole('button', { name: 'Continue' }).click();

    // Step 4 — Assets & Links, every field optional.
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Categories and uniqueness' })).toBeVisible();
  }

  test('discloses a real cohort and completes onboarding at any score', async ({ page }) => {
    // Analyze plus a live scoring call, both through the embedding pipeline.
    test.setTimeout(180_000);

    await registerAndReachStepFive(page);
    await page.getByRole('button', { name: 'Compute uniqueness score' }).click();

    // Either a ranked score or the honest small-cohort state — both are valid
    // backend answers, and the screen must render exactly one of them.
    const primary = page.getByTestId('score-primary');
    const cohort = page.getByTestId('cohort-context');
    await expect(primary.or(cohort).first()).toBeVisible({ timeout: 90_000 });

    // The cohort size must be a real number from the corpus, never a placeholder.
    await expect(cohort).toContainText(/\d+\s+\S+.*business/i);
    await expect(cohort).not.toContainText('undefined');
    await expect(cohort).not.toContainText('NaN');

    // The plan's core promise: the score never gates Finish.
    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled();
  });
```

- [ ] **Step 7: Write the UVP-specificity regression**

  The test that started the plan: if the frontend cannot observe movement, the calibration did not
  work end to end. Append inside the same `describe`:

```ts
  test('a materially more specific UVP moves the score', async ({ page }) => {
    test.setTimeout(240_000);

    await registerAndReachStepFive(page);
    await page.getByRole('button', { name: 'Compute uniqueness score' }).click();

    const primary = page.getByTestId('score-primary');
    await expect(primary).toBeVisible({ timeout: 90_000 });
    const before = await primary.innerText();

    // Back to Step 3 — the wizard's back control is "Back", its forward one is
    // "Continue" (OnboardingWizard.tsx:153,168). It is NOT "Next".
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Back' }).click();

    await page
      .getByPlaceholder('What can a guest get here that they genuinely cannot get from the business next door?')
      .fill(
        'We are the only PADI five-star centre in Moalboal with a resident marine biologist on staff, '
        + 'running dawn sardine-run dives from a private shore entry thirty metres from the reef wall, '
        + 'with every dive logged against a twelve-year record of shoal movement along this coast.',
      );

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    // The score is invalidated by leaving Step 5, so this reads "Compute" again;
    // the regex covers both in case that changes.
    await page.getByRole('button', { name: /Recompute score|Compute uniqueness score/ }).click();
    await expect(primary).toBeVisible({ timeout: 90_000 });
    await expect(primary).not.toHaveText(before);
  });
});
```

- [ ] **Step 8: Confirm the block actually runs**

  No workflow edit is needed — `onboarding-wizard` is already a matrix entry, and removing
  `.skip` is what makes the block execute. Verify it is no longer skipped:

```bash
cd e2e && npx playwright test tests/onboarding-wizard.spec.ts --list
```

  Expected: the three `Step 5 Analysis` tests are listed. Then run them; with no backend they must
  report **skipped** (via `requireBackend()`), not passed — a silent pass means `requireBackend()` was
  left out and the spec is asserting nothing.

  Remember the job this runs in serves a **production build** (`npm run build` + `npm run preview`),
  which is why Step 6 fills every field by hand instead of using the DEV-only demo-fill button (B9b).

- [ ] **Step 9: Run everything**

```bash
cd frontend && npm run test:unit && npx tsc --noEmit
cd ../e2e && npx playwright test tests/onboarding-wizard.spec.ts
```

  Expected: unit PASS; e2e PASS with the stack up and the dump imported, or **3 skipped** without a
  backend (that skip is the house behaviour, not a pass).

- [ ] **Step 10: Commit**

```bash
git add frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx \
        e2e/tests/onboarding-wizard.spec.ts
git commit -m "test(module-1): pin the score screen's states, a11y and the UVP regression"
```

**Milestone:** the behaviours this plan promises are pinned by tests, not by intent.

---

## Definition of Done

- [ ] The percentile is visually dominant; the diagnostics read as subordinate
- [ ] `sufficientCohort: false` renders its own state, never a bare number, never an error panel
- [ ] The button reads "Recompute score" after the first run
- [ ] Every score carries an accessible description of scale and direction
- [ ] `computing` has a live region (it had none)
- [ ] Finish is reachable at every score **and** when the cohort is insufficient, with a test each
- [ ] Both out-of-ownership edits are in the PR description (`ScoreTiles.tsx` split,
      `obDraft.tsx` `cohortInsufficient`), each with its one-line reason
- [ ] `ScoreTiles.tsx` exports `PercentileTile` + `ScoreTiles` and `CohortContext.tsx` carries its
      `data-testid="cohort-context"` — and **no copy in either file was changed**, so CVW-29's
      Tasks 15–17 still merge cleanly on top
- [ ] Task 21 Steps 6–9 are written but `.skip`ped, with a follow-up ticket raised
- [ ] Code review approved

**Deferred to the follow-up ticket, not done here:**
- [ ] ~~The UVP-specificity regression passes end to end~~ — needs the seeded corpus (B7)

## Verification

```bash
cd frontend && npm run test:unit && npx tsc --noEmit
cd ../e2e && npx playwright test tests/onboarding-wizard.spec.ts
```

Manually, with the stack running and the dump imported: complete onboarding, then tab through Step 5
from the category chips to Finish without a mouse.

## Commit — **a human runs this**

Commits are staged per task above. Nothing here runs `git commit` on the operator's behalf.

---

## PR note — paste this into the CVW-30 description

Both Step 0s reference this. It is the whole coordination cost of the plan.

> **Three edits outside this ticket's stated file ownership.** `05-frontend-shell.md` assigns
> `ScoreTiles.tsx` and `CohortContext.tsx` to CVW-29 and lists `obDraft.tsx` under no task at all.
> Taking them here deliberately:
>
> - **`ScoreTiles.tsx`** — split into `PercentileTile` (headline) and the default export (the two
>   diagnostics). Task 18 requires the percentile to sit above the diagnostics, and that grid *is*
>   this file's whole body, so the hierarchy cannot be built from outside it. Every tile's markup and
>   copy stays here, so Task 15 relabels all three in place; only placement moved to AnalysisStep.
> - **`CohortContext.tsx`** — added `data-testid="cohort-context"` to both banner roots, so the
>   frame's tests can assert placement without pinning CVW-29's wording.
> - **`obDraft.tsx`** — added a `cohortInsufficient` flag and widened `stepValid` case 4. When the
>   backend answers `sufficientCohort: false` there is no defensible score; without this, Finish stays
>   disabled and traps the operator on Step 5, and the only in-scope alternative is to persist a score
>   that was never computed.
>
> **No copy was changed in either of CVW-29's files** — structure and one test hook only — so Tasks
> 15–17 merge on top without conflict. CVW-29 has no commits at time of writing, so nothing collides.
>
> **Task 21 Steps 6–9 (live e2e) are written but `.skip`ped.** They need the seeded reference corpus
> and Task 16's cohort copy, neither of which exists yet. Follow-up: <ticket>.

## Follow-up ticket to raise

**Title:** CVW-3x — un-skip the Step 5 uniqueness e2e block

**Blocked on:** `01-prerequisites.md` corpus dump imported · Task 16 cohort disclosure copy ·
Task 14 `docs/module-1/uniqueness-calibration.md`

**Work:** remove `.skip` from `Step 5 Analysis` in `e2e/tests/onboarding-wizard.spec.ts`, run it
against the real stack, and fix whatever the two unverified assumptions below turn out to be.

## What I did not verify

- **The registration → `/onboarding` redirect chain.** I confirmed `ProfileGate` sends a
  scoreless profile to `/onboarding`, and that a fresh account has no profile. I did **not** run the
  registration flow against a live backend, so whether `ProfileCompletionGate` interposes a
  `/complete-profile` step first is unconfirmed. If it does, Step 6's helper needs one more page
  between "Create account" and Step 1. Check this first when you execute Task 21.
- **Whether the scoring endpoint returns `sufficientCohort: false` for a brand-new operator.** The
  fresh-registration approach means the e2e operator is not in the seeded corpus. If the backend
  compares against category peers only, the cohort is the seeded corpus and this is fine; if it
  requires the subject itself to be embedded first, Step 7's regression may need a save between
  scorings.
