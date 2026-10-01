# Content Studio merge repair — recovering the `fix/module-3-ui-ux` UI/UX

**Date:** 2026-09-05
**Branch:** `fix/ph1-dev-module3` (HEAD = `07778bb5`, the merge of `fix/module-3-ui-ux` into `ph1-dev`)
**Scope:** frontend only — Module 3.1 Content Studio, its dev-preview route, and two stale test files.

---

## 1. Diagnosis

### 1.1 The headline finding

**Your UI/UX work is not lost.** Every visual change from `fix/module-3-ui-ux` is present in the
working tree. Verified:

| Artefact | `9fb6c975` (branch tip) → `HEAD` |
|---|---|
| `frontend/styles/index.css` | **+8 lines only** (a `.btn-primary--sm` size modifier from ph1-dev). The whole Content Studio / shot-list / publish-modal CSS block is byte-identical. |
| `AIContentMatrixPanel.tsx`, `PublishComposer.tsx`, `CampaignBriefDrawer.tsx`, `CompliancePanel.tsx`, `ContentBoard.tsx`, `PublishModal.tsx`, `DevicePreview.tsx`, `StudioStepRail.tsx` | unchanged, or one unused `import PanelHead` added |
| `previewFixtures.ts`, `creativeDirection.ts` | unchanged |

Nothing needs to be recovered from `stash@{0}` or from a re-run of the aborted rebase.

### 1.2 What actually breaks the screen

`frontend/components/module-3/3.1-content-studio/ContentStudioView.tsx` is a **broken hybrid of two
different versions of the same component**. It references symbols that are never declared:

```
ContentStudioView.tsx(96,12)  TS2304: Cannot find name 'onDisconnect'.
ContentStudioView.tsx(104,7)  TS2304: Cannot find name 'onDisconnect'.
ContentStudioView.tsx(115,26) TS2304: Cannot find name 'markets'.
ContentStudioView.tsx(115,55) TS2304: Cannot find name 'selectedMarketId'.
ContentStudioView.tsx(215,11) TS2304: Cannot find name 'markets'.
ContentStudioView.tsx(220,24) TS2304: Cannot find name 'selectedMarketId'.
ContentStudioView.tsx(221,38) TS2304: Cannot find name 'setSelectedMarketId'.
ContentStudioView.tsx(223,18) TS2304: Cannot find name 'markets'.
ContentStudioView.tsx(232,8)  TS2304: Cannot find name 'marketsError'.
```

Two independent designs for "which market is this content for" were spliced together, and both
halves lost a piece:

- **ph1-dev's design** (PR #20 — `TargetSelectionProvider` + `ContentTargetPicker`): the screen has
  no market selector of its own; it gates behind an explicit surge + market pick held in a shared
  store. Its `useConnections()` destructure — which supplies `onDisconnect` — **did not survive**.
- **`fix/module-3-ui-ux`'s design**: the screen fetches ranked markets itself and puts a
  `Target market` `<select>` in the `PageHead` actions slot (the one visible in your screenshots).
  Its `useState` declarations for `markets` / `selectedMarketId` / `marketsError` **did not
  survive**, but the JSX that reads them did.

`vite build` still succeeds (esbuild does not scope-check), so this fails only at **runtime**.

### 1.3 Why the error message says `useTargetSelection`

`/preview/content` throws *before* it ever reaches the undeclared variables. `App.tsx` mounts the
`/preview` subtree as:

```tsx
<ProfileProvider initial={DEMO_PROFILE}>
  <PostStoreProvider>
    <ConnectionsStoreProvider>
      <AppShell />        // <- no TargetSelectionProvider
```

but `ContentStudioView.tsx:72` calls `useTargetSelection()`, which throws when no provider sits
above it. The merge added `TargetSelectionProvider` to the **two other** mount points —
`DashboardPreviewShell` and the authenticated `AppShell` — and missed the `/preview` one.

So there are **two bombs stacked**: the missing provider throws first (what the error boundary
shows), and `ReferenceError: markets is not defined` is waiting immediately behind it.

### 1.4 Root cause — where the corruption entered

It was **not** your `fix/module-3-ui-ux` branch, and **not** your rebase. Scanning every commit that
touched the file:

```
FIRST BROKEN: 6918944a  2026-09-04  austi | Merge branch 'ph1-dev' of ...SherieHub/CeView into ph1-dev
```

| commit | declares `markets` | uses `markets` | state |
|---|---|---|---|
| `fc1e8948` (parent A — old studio) | 2 | 7 | consistent |
| `5adb2f86` (parent B — PR #20, target-picker studio) | 0 | 0 | consistent |
| **`6918944a`** (their merge) | **0** | **7** | **broken** |
| `de9781ab` (ph1-dev tip) | 0 | 7 | broken |
| `9fb6c975` (**your branch tip**) | 2 | 7 | **clean** |
| `07778bb5` (HEAD) | 0 | 7 | broken |

`6918944a` is a `ph1-dev` → `ph1-dev` pull that resolved a conflict by taking PR #20's declarations
*and* keeping the old branch's JSX. ph1-dev has been broken since 2026-09-04. Your merge inherited
it.

### 1.5 Collateral damage (test-only, no runtime effect)

- `ContentStudioView.test.tsx` lost `act`, `fireEvent`, the `MOCK_NOTIFICATIONS` import, the type
  imports `DemandAlert` / `Market` / `PlatformId`, and the `ALERT` / `MARKET` fixture consts —
  27 TS errors.
- `CaptionOptionGrid.test.tsx:31` reads `MOCK_CONTENT.captions.naver`; ph1-dev deleted the `naver`
  entry from the fixture (and `NaverGlyph` from `PlatformGlyphs.tsx`), which matches your own
  "remove all Naver Blog" change — only this one test lags behind.
- `App.tsx:26` carries a stray `import path from 'path/win32';` — an accidental editor auto-import.
  Unused; tree-shaken; harmless but should go.
- `CalendarView.tsx(61,106)` `Property 'GOLD' does not exist` — **pre-existing**, unrelated, out of
  scope.

---

## 2. The one design decision this requires

The two market mechanisms genuinely conflict, so the repair has to pick a source of truth.

**Decision: keep ph1-dev's `target` store as the source of truth, and re-wire the header
`Target market` select — the one in your screenshots — to switch the market *within* the picked
alert's category.**

Rationale: the store version is newer, is covered by `ContentTargetPicker.test.tsx` and the
rewritten `ContentStudioView.test.tsx`, and is cross-module wiring the Dashboard's "Target this
market" already writes into. Reverting to the self-fetching selector would break the Dashboard
hand-off and delete a teammate's tested work. Re-pointing the select at `setTarget()` keeps your
visual design exactly as screenshotted *and* honours ph1-dev's rule that no screen may infer a
market on the operator's behalf.

A select bound to purely local state would look right but be **inert** — content generation reads
`target.market.id`, so changing the dropdown would not regenerate captions. It must call
`setTarget`.

---

## 3. Fix plan

### Phase 1 — Repair `ContentStudioView.tsx`

1. Restore the connections destructure next to the other hooks (~line 73):
   ```tsx
   const { onDisconnect } = useConnections();   // already imported, never called
   ```
2. Replace the three dead market symbols with state fed from the picked alert's category:
   ```tsx
   const [markets, setMarkets] = useState<Market[]>([]);
   const [marketsError, setMarketsError] = useState<unknown | null>(null);

   useEffect(() => {
     if (!target) return;
     let cancelled = false;
     apiClient.markets
       .forCategory(target.alert.category)
       .then((list) => { if (!cancelled) setMarkets(list); })
       .catch((e) => { if (!cancelled) setMarketsError(e); });
     return () => { cancelled = true; };
   }, [target?.alert.category]);
   ```
3. Delete `const selectedMarket = ...` (line 115). It is now unreferenced — `marketTrend` already
   derives from `target.market.spikeIndicator`.
4. Point the `<select>` at the store (lines ~215–228):
   ```tsx
   value={target.market.id}
   onChange={(event) => {
     const next = markets.find((m) => m.id === event.target.value);
     if (next) setTarget(target.alert, next);
   }}
   ```
5. `clearTarget` is destructured and never used. Either drop it from the destructure, or spend it on
   a small "Change market" control beside the select. **Recommend dropping it** — the screenshots
   show no such control, and the picker is still reachable on a fresh session.

**Checkpoint:** `npx tsc --noEmit` shows no `ContentStudioView.tsx` errors.

### Phase 2 — Make `/preview/content` reproduce the screenshots

6. `App.tsx` — add the missing provider to the `/preview` route element, matching the other two
   mount points:
   ```tsx
   <ProfileProvider initial={DEMO_PROFILE}>
     <PostStoreProvider>
       <ConnectionsStoreProvider>
         <TargetSelectionProvider initial={DEMO_TARGET}>
           <AppShell />
   ```
7. `targetSelectionStore.tsx` — add an optional `initial?: TargetSelection` prop, mirroring
   `ProfileProvider`'s existing `initial` convention:
   ```tsx
   export function TargetSelectionProvider({ children, initial }: {
     children: ReactNode; initial?: TargetSelection;
   }) {
     const [target, setTargetState] = useState<TargetSelection | null>(initial ?? null);
   ```
   Without this, the fixed preview route lands on `ContentTargetPicker` (step 1 of 2), **not** the
   designed studio — the provider alone does not reproduce the screenshots.
8. `previewFixtures.ts` — add the seed alongside `DEMO_DRAFT` / `DEMO_BOARD_POSTS`, under the same
   "TEMPORARY, how to delete" banner:
   ```ts
   export const DEMO_TARGET = {
     alert: MOCK_NOTIFICATIONS.find((n) => n.id === 'n1')!,   // South Korea / Accommodation & Staycation
     market: MOCK_MARKETS.find((m) => m.id === 'korea')!,     // South Korea
   };
   ```
   Verified compatible: `n1.category` (`Accommodation & Staycation`) is in
   `DEMO_PROFILE.categories`, and `marketsForCategory` returns all three markets — so the header
   reads **Target market / South Korea** with Japan and United States in the dropdown, exactly as in
   screenshot 2.
9. Delete `import path from 'path/win32';` from `App.tsx:26`.

**Checkpoint:** `/preview/content` renders the full studio — step rail, Post composer, caption grid,
Compliance audit, Content board — with the Visual Guide drawer and Publish modal reachable.

### Phase 3 — Repair the two stale test files

10. `ContentStudioView.test.tsx` — restore what the merge dropped:
    - `import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';`
    - `import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';`
    - `import type { BusinessProfile, DemandAlert, Market, PlatformId } from '../../../types';`
    - `const ALERT: DemandAlert = MOCK_NOTIFICATIONS.find((n) => n.category === 'Coastal & Island')!;`
    - `const MARKET: Market = MOCK_MARKETS[0];`
11. `CaptionOptionGrid.test.tsx:31` — `MOCK_CONTENT.captions.naver` is gone. Replace with a local
    two-option array and update the comment; the case is about auto-fit for a two-option set, not
    about Naver.

### Phase 4 — Verify

12. `npx tsc --noEmit` → only `CalendarView.tsx(61,106)` should remain (pre-existing, out of scope).
13. `npx vitest run components/module-3` — **twice**, to catch the parallel-run flake.
14. `npx vite build`.
15. Browser check `/preview/content` **and** `/content` against all eight screenshots: step rail
    centred · Post composer with the three caption options · caption + media equal heights · Visual
    Guide drawer (Visual direction + structured Shot list, no moodboard, no copywriting matrix) ·
    Compliance audit two-column with the large donut and right-aligned Re-run · three-column Content
    board · full-bleed Publish modal with mobile/tablet/desktop frames scaling to fit.

---

## 4. Out of scope

- Backend, AI services, and every module other than 3.
- The `CalendarView` `GOLD` error and the intermittent module-4
  `CampaignAnalyticsView > re-slices the trend window` flake — both pre-existing.
- Fixing `6918944a` on `ph1-dev` itself. This plan repairs the merge result on
  `fix/ph1-dev-module3`; ph1-dev stays broken until this lands there.

## 5. Risk notes

- `ContentTargetPicker`'s alert list is filtered by `profile.categories`. An operator whose
  categories match no seeded alert sees an empty step 1 — pre-existing behaviour, unchanged here,
  but worth knowing if `/content` looks empty under a non-demo profile.
- `PanelHead` (in `CompliancePanel.tsx`, `ContentBoard.tsx`) and `useConnections` (in
  `PublishComposer.tsx`) are imported but unused — ph1-dev debris. Harmless; leave them unless you
  want a lint pass, which is a separate change.

---

## 6. Execution record — 2026-09-05

All four phases executed. `npx tsc --noEmit` is down to the single pre-existing
`CalendarView.tsx(61,106)` error; `components/module-3` is **16 files / 81 tests, green twice**;
`npx vite build` succeeds.

### Deviations from the plan

- **Three cases in `ContentStudioView.test.tsx` were rewritten, not repaired.** They asserted
  ph1-dev's header (`"MARKET — CATEGORY"` text, a `Change target market` button) and a platform
  checkbox in the composer — all three describe UI the merge had already discarded, so restoring
  their imports would only have made them fail honestly instead of failing to compile. They now
  describe the shipped design: the category-scoped selector, its write-through to `setTarget`, and
  the disconnect rule observed through the audit it withdraws.
- **A fourth broken file, `contentStudioJourney.test.tsx`, was not in the plan.** It mounted the
  view with no `TargetSelectionProvider` and mocked the retired `markets.list`. Fixed.
- **`clearTarget` was dropped from the destructure**, per the plan's recommendation.
- **One file added: `contentPreviewRoute.test.tsx`.** The reported bug was a provider missing from
  a hand-composed route, and nothing in the suite could see it — every other case in the folder
  mocks the stores, which is precisely what made them silent. This mounts the real providers in
  App.tsx's order. Mutation-checked: removing `TargetSelectionProvider` from it reproduces
  `useTargetSelection must be used within a TargetSelectionProvider` verbatim.

### Mutation checks

Each new assertion was deliberately broken to prove it bites:

| mutation | result |
|---|---|
| drop `setTarget(target.alert, next)` from the selector's `onChange` | fails |
| drop `setAudit(IDLE_AUDIT)` from the disconnect handler | fails |
| remove `TargetSelectionProvider` from the preview stack | fails, with the original error |

### Still failing — all pre-existing, none in files touched here

`npx vitest run` (full): **8 failed / 437 passed / 13 skipped**.

- Seven auth cases (`LoginPage`, `CompleteProfilePage`, `services/auth`) — a Google sign-in mock
  mismatch (`expected 'mock-access-token-123' to be 'jwt-1'`) from ph1-dev's auth rework.
- `tests/integration/button-classes.test.ts` — six button classes are named by components but
  defined nowhere in `index.css`:
  `.btn-ghost` (`ContentTargetPicker.tsx`, `PlatformsSettings.tsx`) and
  `.btn` / `.btn-gold` / `.btn-lg` / `.btn-block` (`ComputeUniquenessButton.tsx`).

  **`.btn-ghost` is Module 3** — `ContentTargetPicker`'s "Back to alerts" control renders unstyled
  on step 2 of the picker. Not fixed here because choosing its appearance is a design decision, not
  a merge repair, but it is the same failure mode as the earlier `.btn--primary` bug and should be
  picked up next.

### Note

`frontend/dist/` is tracked in git and was regenerated by the verification builds, so it shows up
in `git status` as an unrelated change.
