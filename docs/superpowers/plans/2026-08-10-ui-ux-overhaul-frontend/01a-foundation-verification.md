# Foundation — Verification & Primitive-Class Gap Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formally re-verify all four `01-foundation.md` cards (Project Scaffold, Design System,
Shell & Routing, Fixture Data Layer) against their own Definition of Done/milestone text, capture
that verification as evidence, and close the one real gap found during audit: two CSS primitive
classes (`.card`, `.empty`) that already-scaffolded module-1..4 placeholder components reference but
that `styles/index.css` doesn't yet define.

**Architecture:** No new architecture — this plan touches zero application logic. It (a) runs the
exact verification commands each Foundation card already specifies and records pass/fail, (b) does a
manual click-through of the two flows the cards call out as manual-only (unauthenticated redirect,
login success, overlay-stack Escape ordering), and (c) ports two more primitive classes from
`ui-ux-prototype.html` into `styles/index.css`'s `@layer components` block, following the same
"transcribe 1:1, `@layer components`" pattern already used for `.eyebrow`/`.h-*`/`.body-*`/`.num`.

**Tech Stack:** Same as the rest of `frontend/` — Vite, Tailwind v4 (`@theme` + `@layer components`),
Vitest, React Router. No new dependencies.

## Global Constraints

- All paths below are relative to `frontend/` unless stated otherwise.
- Source of truth for CSS values: `ui-ux-prototype.html` (repo root), never re-derived or
  approximated — copy the declaration block verbatim, converting `var(--x)` prototype tokens to this
  project's `var(--color-x)` / `var(--radius-x)` / `var(--shadow-x)` token names per
  `styles/index.css`'s existing `@theme` block.
- Do not touch `ceview/` or `ceview/old-components/`.
- Do not wire any `components/module-1` … `module-4` or `components/settings` file into `App.tsx`'s
  router — those are placeholder stubs for later cards (`02-module-1.md` … `05-module-4.md`) and
  stay out of scope here. This plan only makes the CSS classes they already reference resolve to
  real declarations.
- No behavior changes to any `.tsx` file in this plan — CSS-only addition plus a verification pass.

---

## Audit findings (context for every task below)

Confirmed by direct inspection before writing this plan (commands run from `frontend/`):

| Card | Files present | `npm run build` | `npm run test:unit` | Gap found |
|---|---|---|---|---|
| Project Scaffold | all (`package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `index.tsx`, `.gitignore`, `vitest.setup.ts`, `README.md`) | ✅ succeeds | n/a (no suite required) | none |
| Design System | `styles/index.css` — `@theme` token block matches `ui-ux-prototype.html:15–67` 1:1; reset/typography helpers match `:70–110` | ✅ | n/a | `.card` and `.empty` primitives are referenced by already-scaffolded module placeholders but not yet defined (see below) |
| Shell & Routing | all (`App.tsx`, `layout/*`, `components/shared/{useOverlayStack,Modal,Drawer,Toast}.tsx`, `components/auth/{AuthGate,LoginPage}.tsx`, `services/{auth,authStorage,profileContext}.*`) | ✅ | ✅ `useOverlayStack.test.tsx` — 5/5 passing (push/pop/dismissTop/idempotent-push/pop-by-kind) | none in Foundation's own scope; manual checks not yet re-run this session (Task 3 below) |
| Fixture Data Layer | all (`services/fixtures/{markets,notifications,content,omcs,campaign,posts,members}.ts`, `services/apiClient.ts`, `types.ts`) | ✅ | ✅ `apiClient.fixtures.test.ts` — 8/8 passing | none |

Full run: `npm run build` (908ms, no errors) and `npm run test:unit` (2 files, 13/13 tests passing)
both succeeded on `task_foundation` at HEAD (`e2221ebb`) prior to this plan.

**The `.card` / `.empty` gap in detail:** `git log --oneline -- frontend` shows two commits
(`74f9c997`, `0911b6bd`) already scaffolded placeholder files for every later card in
`02-module-1.md` … `05-module-4.md` (e.g. `components/module-2/2.1-dashboard/AlertCard.tsx`,
`components/settings/WorkspaceSettings.tsx`) — each a stub with a `TODO` comment pointing at its real
card, not yet wired into `App.tsx`'s router. 15 of these 21 stub files render
`className="empty …"` and 7 render `className="card"` (`grep -rhoE` count below), matching
`ui-ux-prototype.html`'s `.card`/`.empty` primitives byte-for-byte in the stub markup itself. Because
`styles/index.css` only defines `.eyebrow`/`.h-*`/`.body-*`/`.num` so far (Design System card's
"add primitives incrementally, as later cards need them" note), these two classes currently resolve
to nothing — harmless today only because nothing routes to these stubs yet, but real card work in
`02-module-1.md` onward will inherit broken/unstyled placeholders the moment routing wires them in.
No other primitive (`.btn`, `.chip`, `.tabs`, `.switch`, `.check`, `.skel`, `.toast`, `.modal`,
`.drawer`, `.banner`) is referenced anywhere in `frontend/` yet — `Modal.tsx`/`Drawer.tsx`/
`LoginPage.tsx` are fully styled with inline Tailwind utilities and don't depend on those primitive
classes existing, so this plan does not add them (still "later card adds it as needed," per the
Design System card).

---

### Task 1: Verify Project Scaffold card

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: `frontend/package.json` scripts (`dev`, `build`, `preview`, `test`, `test:unit`,
  `test:integration`).
- Produces: pass/fail evidence for this plan's final summary.

- [ ] **Step 1: Clean install**

```bash
cd frontend && rm -rf node_modules && npm install
```

Expected: exits 0, no `npm ERR!` lines.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: `vite build` completes, ends with `✓ built in <N>ms`, exit code 0, no TypeScript errors.

- [ ] **Step 3: Dev server smoke check**

```bash
npm run dev &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001
kill %1
```

Expected: prints `200`.

- [ ] **Step 4: Record result**

Note the exact `vite build` output and dev-server HTTP status in this plan's completion summary
(final task below) — this is the evidence artifact, no code changes.

---

### Task 2: Close the `.card` / `.empty` primitive-class gap in the Design System

**Files:**
- Modify: `styles/index.css` (`@layer components` block, immediately after the existing `.num`
  declaration and before the closing "Primitive component classes … added incrementally" comment)
- Test: manual visual check (no Vitest suite — Design System card explicitly has none; "visual
  review substitutes" per its Definition of Done)

**Interfaces:**
- Consumes: `ui-ux-prototype.html:138–147` (`.card`, `.card-pad`, `.card-head`, `.card-body`,
  `.card-navy` — port only the base `.card` rule; the `-pad`/`-head`/`-body`/`-navy` variants are not
  referenced by any current file, leave them for the card that first needs them) and
  `ui-ux-prototype.html`'s `.empty`/`.empty-glyph` block (already excerpted below).
- Produces: `.card` and `.empty` (+ `.empty-glyph`, `.empty h3`, `.empty p`) resolvable classes that
  every existing and future stub in `components/module-1` … `module-4`, `components/settings` can
  rely on without modification.

- [ ] **Step 1: Confirm the exact prototype source (already captured, re-verify before pasting)**

```bash
grep -n -A2 '^\.card{' /Users/austinejohnp.lomocso/Apps/CeView/ui-ux-prototype.html
grep -n -A6 '^\.empty{' /Users/austinejohnp.lomocso/Apps/CeView/ui-ux-prototype.html
```

Expected output (already confirmed during planning):

```css
.card{
  background:var(--panel);border:1px solid var(--line);border-radius:var(--r-md);
  box-shadow:var(--sh-1);
}
.empty{text-align:center;padding:var(--sp-12) var(--sp-5);}
.empty-glyph{width:52px;height:52px;border-radius:15px;background:var(--panel-sunk);display:grid;place-items:center;margin:0 auto var(--sp-4);border:1px solid var(--line);}
.empty-glyph svg{width:23px;height:23px;stroke:var(--muted);}
.empty h3{font-size:16px;font-weight:800;}
.empty p{font-size:13px;color:var(--muted);margin-top:6px;max-width:44ch;margin-inline:auto;}
```

- [ ] **Step 2: Add the two primitives to `styles/index.css`, translated to this project's token names**

Insert into the existing `@layer components { … }` block (after `.num`, i.e. right before its
closing `}`):

```css
  .card {
    background: var(--color-panel);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-1);
  }
  .empty {
    text-align: center;
    padding: var(--spacing-12) var(--spacing-5);
  }
  .empty-glyph {
    width: 52px;
    height: 52px;
    border-radius: 15px;
    background: var(--color-panel-sunk);
    display: grid;
    place-items: center;
    margin: 0 auto var(--spacing-4);
    border: 1px solid var(--color-line);
  }
  .empty-glyph svg {
    width: 23px;
    height: 23px;
    stroke: var(--color-muted);
  }
  .empty h3 {
    font-size: 16px;
    font-weight: 800;
  }
  .empty p {
    font-size: 13px;
    color: var(--color-muted);
    margin-top: 6px;
    max-width: 44ch;
    margin-inline: auto;
  }
```

Every `var(--x)` above must resolve against `styles/index.css`'s own `@theme` block already at the
top of the file (`--color-panel`, `--color-line`, `--radius-md`, `--shadow-1`, `--spacing-12`,
`--spacing-5`, `--color-panel-sunk`, `--spacing-4`, `--color-muted` — all already declared).

- [ ] **Step 3: Update the "excluded/added incrementally" comment**

The comment block right after `.num` currently reads:

```css
/* Primitive component classes (.btn/.card/.chip/.tabs/.bar/.switch/.check/
   .skel/.toast/.modal/.drawer/.banner/.empty — prototype lines 112–302) are
   added incrementally as each consuming screen card needs them, per
   01-foundation.md's Design System card. .cs2-*, .prev-*, #devbar/.devbar-*
   are excluded — they belong to the dropped v2 Content Studio / dev-only
   jump bar, not the product. */
```

Update it to drop `.card`/`.empty` from the "not yet added" list, since Step 2 just added them:

```css
/* Primitive component classes (.btn/.chip/.tabs/.bar/.switch/.check/.skel/
   .toast/.modal/.drawer/.banner — prototype lines 112–302) are added
   incrementally as each consuming screen card needs them, per
   01-foundation.md's Design System card. .card and .empty (+ .empty-glyph)
   were added ahead of schedule because module-1..4 placeholder stubs
   already reference them (see 01a-foundation-verification.md). .cs2-*,
   .prev-*, #devbar/.devbar-* are excluded — they belong to the dropped v2
   Content Studio / dev-only jump bar, not the product. */
```

- [ ] **Step 4: Build and visually confirm**

```bash
npm run build
npm run dev
```

Manually open `http://localhost:3001/settings/workspace` after logging in with a seeded account (see
Task 3) — `WorkspaceSettings.tsx`'s stub should now render inside a padded, centered `.empty` block
(no more unstyled flush-left text). Compare `.card`'s look (white panel, 1px `--color-line` border,
`--radius-md` corners, `--shadow-1`) against any `card`-classed stub, e.g. navigate to
`AlertCard.tsx`'s render by temporarily checking it in isolation — not routed yet, so this is a visual
spot-check via a throwaway render, not a full page.

- [ ] **Step 5: Run the full unit suite to confirm no regression**

```bash
npm run test:unit
```

Expected: still 2 files / 13 tests passing (CSS-only change, no test should be affected).

---

### Task 3: Verify Shell & Routing card (automated + manual)

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: seeded demo credentials from
  `backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md` (or, if no backend is
  running, `VITE_USE_FIXTURES` mode's `auth.login`/`auth.register` — note `apiClient.ts`'s `auth.*`
  methods have **no fixture branch**, so login against a real Spring Boot backend is required for
  this check; running `frontend/` alone with `VITE_USE_FIXTURES=true` cannot exercise successful
  login, only the redirect-to-`/login` half).
- Produces: pass/fail evidence for this plan's final summary.

- [ ] **Step 1: Run the automated suite**

```bash
npm run test:unit -- useOverlayStack
```

Expected: `useOverlayStack.test.tsx` — 5 passed (push/pop/dismissTop ordering, idempotent push,
pop-by-kind-regardless-of-position).

- [ ] **Step 2: Manual check — unauthenticated redirect**

```bash
npm run dev
```

Open `http://localhost:3001/dashboard` in a private/incognito window (no stored token). Expected:
immediate redirect to `/login`.

- [ ] **Step 3: Manual check — login success**

With a Spring Boot backend running (see root `RUNNING.md`) and a seeded demo account, submit the
Sign in form on `/login`. Expected: on success, lands on `/dashboard` (or `/onboarding` if that
account's `profile.uniquenessScore` is unset — per `ProfileGate`'s logic in
`services/profileContext.tsx`).

- [ ] **Step 4: Manual check — overlay stack Escape ordering**

This has no routed UI to trigger yet (Modal/Drawer are only used by later cards not wired in). Verify
via the existing automated `useOverlayStack.test.tsx` (Step 1) as the substitute, per
`01-foundation.md`'s own Definition of Done, which defers full Playwright coverage; do not build a
throwaway page for this — it would exceed this plan's CSS/verification-only scope.

- [ ] **Step 5: Record results**

Note pass/fail for each manual step in this plan's completion summary (final task below).

---

### Task 4: Verify Fixture Data Layer card

**Files:**
- None modified — verification only.

**Interfaces:**
- Consumes: `frontend/services/apiClient.fixtures.test.ts`.
- Produces: pass/fail evidence for this plan's final summary.

- [ ] **Step 1: Run the fixture suite explicitly**

```bash
VITE_USE_FIXTURES=true npm run test:unit -- apiClient.fixtures
```

Expected: `apiClient.fixtures.test.ts` — 8 passed (`markets.list`, `notifications.list`,
`content.list`, `omcs.evaluate`, `campaign.report`, `posts.list`, `workspace.members`,
`connections.list`).

- [ ] **Step 2: Record result**

Note pass/fail in this plan's completion summary (final task below).

---

### Task 5: Tick off Definition of Done in `01-foundation.md` and write the completion summary

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md` — check the
  `- [ ]` boxes under each of the 4 cards' "Definition of Done" that Tasks 1–4 above just verified
  (leave any Playwright-deferred box unchecked, per that card's own text — it's explicitly deferred,
  not done).

**Interfaces:**
- Consumes: Task 1–4 results.
- Produces: the plan's final deliverable — a summary posted to chat (not a repo file) per the
  original request's required format.

- [ ] **Step 1: Edit `01-foundation.md`**

For each of the 4 cards, check every Definition of Done box whose verification passed in Tasks 1–4.
Leave unchecked: Design System's "Code review approved" line (code review is a human action, not
something this plan can tick for itself) and Shell & Routing's Playwright line (explicitly deferred
by the card's own text).

- [ ] **Step 2: Re-run the full suite one more time as a final gate**

```bash
cd frontend && npm run build && npm run test:unit
```

Expected: build succeeds, all tests pass (13 previously + 0 new, since Task 2 added no new test
file — CSS only).

- [ ] **Step 3: Post the completion summary to chat**

Format (per the original request):
- **Timestamp finish** — wall-clock time this step is executed.
- **Changes title** — "Foundation Verification & `.card`/`.empty` Primitive-Class Gap Closure."
- **List and summary of changes** — the `styles/index.css` addition from Task 2 (only file actually
  modified), plus the verification results from Tasks 1, 3, 4 (no files changed, pass/fail only), plus
  the `01-foundation.md` checkbox updates from this task's Step 1.
- **Sources of truth per change** — `ui-ux-prototype.html:138–147` (`.card`) and its `.empty`/
  `.empty-glyph` block for the CSS addition; `01-foundation.md` itself for each card's DoD/milestone
  text being verified against.
- **Instructions how to test** — the exact commands from Tasks 1 Step 2, 2 Step 4–5, 3 Step 1, 4
  Step 1, reproduced verbatim so the user can re-run them independently.

---

## Self-review

- **Spec coverage:** all four `01-foundation.md` cards have a task verifying their milestone/DoD
  (Tasks 1–4); the one real gap found in audit (`.card`/`.empty` undefined) has a dedicated task
  (Task 2) with exact prototype source, exact CSS to add, and the file/line to add it at.
- **Placeholder scan:** no TBD/"add appropriate"/"similar to" — every step names its exact command or
  exact CSS block.
- **Type consistency:** n/a — no new TypeScript surface introduced by this plan.
