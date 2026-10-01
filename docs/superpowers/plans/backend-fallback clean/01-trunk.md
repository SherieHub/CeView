# Trunk — Clear the One Shared File Before the Lanes Start

> **REQUIRED SUB-SKILL:** superpowers:test-driven-development for the code steps below.

**Goal:** remove Naver as a generation/publish target from the frontend —
`PlatformId` narrows from four platforms to three, and every component that
special-cased Naver stops doing so. This is the one task in the whole
remaining 30 whose files another lane also needs to touch
(`obDraft.tsx`, via Lane C's Task 31), so it runs first and alone.

**Prerequisite:** none. This is the first thing anyone does.

**Blocks:** [`04-lane-c-fixtures.md`](04-lane-c-fixtures.md) (Task 31 there
copies `obDraft.tsx`'s `DEV_SEED_DRAFT`, "minus the naver key... removed
[here]" — it reads this task's result, not just avoids a merge conflict with
it). Does **not** block [`02-lane-a-forecasting.md`](02-lane-a-forecasting.md)
or [`03-lane-b-content-and-reports.md`](03-lane-b-content-and-reports.md) —
start those immediately, in parallel with this.

**Companion, not a dependency:** Lane B's Tasks 26–27 remove Naver from the
*backend* (`fastapi-sbert`, Spring). Neither this task nor those two needs
the other to go first — they delete different things in different codebases.
Naver is only fully gone once both are merged, but correctness of either
alone doesn't require the other.

---

## Running

Frontend dev server, from `frontend/`:

```bash
npm run dev
```

Type-check as you go — this repo has one pre-existing, unrelated error in
`components/module-3/3.2-calendar/CalendarView.tsx` (`GOLD` token). Confirm
you introduce **no new** errors, don't try to fix that one:

```bash
npx tsc --noEmit
```

## Testing

```bash
cd frontend && npm test
```

Full suite, not a subset — this task touches enough files (`types.ts`,
`obDraft.tsx`, and every component that special-cased Naver) that a narrow
test run could miss a regression in an untouched-by-you but affected file.

## The task

### Task 28: Remove Naver from the frontend

Narrowing `PlatformId` first makes `tsc` enumerate every remaining reference, so this
cannot be half-done silently.

**Files:**
- Modify: `frontend/types.ts:78`
- Modify: `frontend/components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx:11,18,189-191`
- Modify: `frontend/components/module-3/3.1-content-studio/PublishComposer.tsx:6,7`
- Modify: `frontend/components/module-3/3.1-content-studio/VisualDirectionBoard.tsx:29`
- Modify: `frontend/components/module-3/3.1-content-studio/ContentBoard.tsx:11`
- Modify: `frontend/components/module-1/onboarding/steps/AssetsLinksStep.tsx:19,46`
- Modify: `frontend/components/module-1/onboarding/obDraft.tsx:54`
- Modify: `frontend/components/shared/PlatformGlyphs.tsx:34`
- Modify: `frontend/components/module-1/onboarding/steps/AssetsLinksStep.test.tsx:65`
- Modify: `frontend/components/module-3/3.1-content-studio/testFixtures.ts:39`
- Modify: `frontend/components/module-4/4.1-campaign-analytics/PreviouslyPublished.test.tsx:14,43-50`

- [ ] **Step 1: Narrow the type**

In `frontend/types.ts`, replace :78:

```typescript
/**
 * The platforms CeView generates for and publishes to.
 *
 * Naver Blog was removed as a generation target (spec §2a) — its captions were
 * hardcoded Korean text injected on the success path, not model output. The AI
 * may still *recommend* Naver as a channel; it is simply not something this app
 * writes copy for.
 */
export type PlatformId = 'instagram' | 'tiktok' | 'facebook';
```

- [ ] **Step 2: Let the type checker enumerate the damage**

```bash
cd frontend && npx tsc --noEmit
```

Expected: FAIL with an error per remaining `'naver'` reference. Record the list —
Steps 3-5 clear it.

- [ ] **Step 3: Clear the Module 3 references**

`AIContentMatrixPanel.tsx` — delete the `naver: 5000` entry at :11 with its
two-line comment at :9-10, the `{ id: 'naver', label: 'Naver Blog' }` tab at :18,
and the whole `{platform === 'naver' && (...)}` disclaimer block at :189-191.

`PublishComposer.tsx` — delete `naver: 'Naver Blog'` from `PLATFORM_LABELS` at :6
and `'naver'` from `CONNECTED` at :7.

`VisualDirectionBoard.tsx:29` — replace
`{activePlatform === 'naver' ? 'Naver Blog' : activePlatform}` with `{activePlatform}`.

`ContentBoard.tsx:11` — replace
`{post.platform === 'naver' ? 'Naver Blog' : post.platform}` with `{post.platform}`.

- [ ] **Step 4: Clear the Module 1 and shared references**

`AssetsLinksStep.tsx` — delete the `{ platform: "naver", label: "Naver Blog", icon:
NaverGlyph }` entry at :46 and drop `NaverGlyph` from the import at :19. Update the
comment at :33 to name only TikTok.

`obDraft.tsx:54` — `socials: { instagram: '', tiktok: '', facebook: '' }`.

`PlatformGlyphs.tsx` — delete the `NaverGlyph` component at :34 and update the
file-header comment at :4 to mention TikTok only.

- [ ] **Step 5: Update the tests**

`AssetsLinksStep.test.tsx:65` — remove `'Naver Blog handle or page name'` from the
expected field list.

`testFixtures.ts:39` — remove `naver: platformCaptions('Naver'),`.

`PreviouslyPublished.test.tsx:14` — the `p6` fixture uses `platform: 'naver'`;
change it to `'facebook'` (it exists to give the "draft" status a row, and the
platform is incidental).

`PreviouslyPublished.test.tsx:43-50` — the test asserting *"no Naver tab"* is now
trivially true and misleading, since Naver cannot exist. Replace it with the
assertion that actually has content:

```typescript
  it('shows exactly the filter tabs All / TikTok / Instagram / Facebook', async () => {
    render(<PreviouslyPublished posts={POSTS} />);

    for (const label of ['All', 'TikTok', 'Instagram', 'Facebook']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });
```

- [ ] **Step 6: Verify the type checker is clean**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no output

- [ ] **Step 7: Confirm no reference survives**

```bash
cd frontend && grep -rn -i "naver" --include=*.ts --include=*.tsx . | grep -v node_modules
```

Expected: no output.

- [ ] **Step 8: Run the suite**

```bash
cd frontend && npm test
```

Expected: PASS

- [ ] **Step 9: Commit** *(operator runs this)*

```bash
git add frontend/
git commit -m "feat(module-3): remove Naver from the frontend"
```

---

## Finished state

- [ ] `cd frontend && npx tsc --noEmit` — clean except the pre-existing `CalendarView.tsx` error
- [ ] `cd frontend && npm test` — all pass
- [ ] `grep -rni "naver" frontend --include=*.ts --include=*.tsx | grep -v node_modules` — no output
- [ ] `PlatformId` in `frontend/types.ts` is `'instagram' | 'tiktok' | 'facebook'`
- [ ] `git log` shows this merged to the integration branch before Lane C starts
- [ ] Tell whoever owns Lane C that this is merged — they're blocked until they see it
