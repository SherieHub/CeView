# UI/UX Overhaul — Frontend Implementation Plan (Index)

**Target directory:** `frontend/` — a fresh, greenfield rebuild, not `ceview/`. `ceview/` contains an
earlier implementation of some of these Foundation cards (styling via hand-rolled CSS custom
properties instead of Tailwind); it is legacy/reference only and is not touched by this plan set
going forward. Every path in this file and in `01-foundation.md` … `05-module-4.md` is relative to
`frontend/` unless stated otherwise.

**Source of truth:** [`ui-ux-prototype.html`](../../../../ui-ux-prototype.html) (single-file
vanilla-JS prototype, 4,471 lines).

**Companion docs:** [`docs/module-1/README.md`](../../../module-1/README.md) …
[`docs/module-4/README.md`](../../../module-4/README.md) — each screen card below points at the
matching `screens/*.md` doc for full behavioral detail (state shape, API calls, every empty/loading/
error state). Cards stay short on purpose; they don't re-derive what's already written there.

**Component diagrams:** [`diagrams/`](diagrams/) — one Mermaid `.mmd` per file below
(`foundation.mmd`, `module-1.mmd` … `module-4.mmd`) showing that file's components, their
render/mount tree, and their context/service dependencies. Each module file links its own diagram
in its header.

## How to use this with a Kanban tool

Every card in `01-foundation.md` … `05-module-4.md` is a self-contained, copy-paste-ready block:
title, dependencies, steps, a finished-state milestone, a Definition of Done, and the exact commands
that verify it. Paste one card = one ticket into whatever task manager the team uses (Jira, Linear,
Trello, GitHub Projects — the template makes no tool-specific assumptions). A card's **Depends on**
field names the card(s) that must merge first; don't start a card whose dependency isn't done.

## Card template

Used identically for every card in every module file:

````markdown
### CARD — <Screen>: <Chunk name>

**Depends on:** <card name(s), or "Foundation — X">
**Summary:** <one line>
**Prototype reference:** <screen id> / `<renderFn>()` — `ui-ux-prototype.html:<start>–<end>`

**Project files to add/implement:**
- `<path/NewFile.tsx>` — <one-line purpose>

**Related files:**
- `<path/ExistingFile.ts>` — <why this card touches/imports/must match it>

**Flow:** [`diagrams/cards/<module>/<slug>.mmd`](diagrams/cards/<module>/<slug>.mmd)

**Steps (pseudocode):** [`pseudocode/<module>/<slug>.ts`](pseudocode/<module>/<slug>.ts)

**Milestone (finished state):** <one concrete, observable sentence>

**Definition of Done:**
- [ ] `<Component>.test.tsx` covers <what>
- [ ] `<screen-name>.spec.ts` → "<describe block>" — deferred, not wired for `frontend/` yet (see
      "Testing strategy" below)
- [ ] Code review approved

**Verification:**
```
npm run test:unit -- <pattern>
```
````

**Field guide:**
- **Prototype reference** — the prototype's own screen id (`screen-dashboard`, `view-onboarding`,
  …) and render function (`renderDashboard()`, `obStepBasic()`, …), plus the exact line range in
  `ui-ux-prototype.html` this card ports. One consistent, greppable anchor per card.
- **Project files to add/implement** — every new file this card creates, each with a one-line
  purpose. This is the only place file paths appear with a "what it is" description; `Steps` below
  is pure behavior, no file paths.
- **Related files** — existing files (already in the repo, or built by an earlier card) that this
  card's new code reads, imports, or must stay consistent with (e.g. a shared type, a fixture module,
  a context this card must re-sync). Not the screen's behavioral-spec doc — that's linked once in
  this file's header, not repeated per card.
- **Flow** — a link to `diagrams/cards/<module>/<slug>.mmd`, a `flowchart TD` depicting this card's own control-flow (states, decision branches, gates, terminal actions) — distinct from the module-level `diagrams/<module>.mmd`, which shows component *dependencies*, not logic.
- **Steps (pseudocode)** — a link to `pseudocode/<module>/<slug>.ts`: typed-outline pseudocode (real import paths/type names for grounding, `on X → Y` event bullets, bare function signatures, no runnable bodies) — not copy-pasteable code. If a card spans multiple real project files, the one pseudocode file holds one `// ---- <path> ----` section per file, in build order.
- **Diagrams** — each module file (`01-foundation.md` … `05-module-4.md`) links a
  `diagrams/<module>.mmd` Mermaid component-dependency diagram in its header: components as nodes
  (grouped into subgraphs by directory), solid edges for renders/mounts, dashed edges for
  context/service dependencies (`-.->|useProfile()|`, `-.->|apiClient|`, …). Foundation pieces a
  module depends on appear as single styled nodes, not expanded — full expansion lives only in
  `diagrams/foundation.mmd`.

**Card IDs:** `M<n>-F[<k>]` for a module's foundation card(s), `M<n>-<k>` for regular cards, `M<n>-B<k>`
for a module's backend track (when its work spans a frontend/backend split). Foundation cards keep the
`Foundation — <Name>` naming already used above (e.g. `Foundation — Shell & Routing`); `M<n>-F` is the
id column shorthand for cross-referencing, not a rename of that convention.

**Binding rule — one prerequisite per module:** every module file must open with one or more
`Foundation — <Name>` card(s) that every other card in that module depends on directly, and — aside
from a module's own independent track roots (e.g. a backend track parallel to the frontend track) —
that is the *only* thing sibling cards may depend on within the module. Sibling cards must never list
the same file under "Project files to add/implement"; if two features would naturally share a file,
the foundation card owns that file (creating typed stubs/slots for the pieces sibling cards will fill
in) and each sibling card fully owns replacing its one assigned stub. This keeps every card after the
foundation buildable in full parallel — see `03-module-2.md` for a worked example.

## Decisions this plan assumes

Carried forward unchanged from the original single-file plan — this restructure only changes how the
work is chunked and verified, not what gets built:

1. **Content Studio v1 is canonical.** The prototype's `screen-content2` / `renderContent2()` /
   `APP_STATE.content2` is a superseded draft — not built, not referenced by any card below.
2. **Publish gating deviates from v1 by one rule:** the "Publish to" picker disables platforms not
   connected in Settings → Platforms, with an inline Connect action.
3. **New surfaces (Calendar, Platforms, Workspace, post analytics, publishing) are built now** against
   a typed `apiClient`, backed by a fixture layer (Foundation Card 3) so the UI is fully runnable
   before the backend that `docs/module-3/backend/` and `docs/module-4/backend/` specify actually
   exists.
4. **Styling:** port the prototype's CSS custom properties and primitive classes into real
   stylesheets (Foundation Card 1); keep Recharts, don't port the prototype's hand-rolled SVG chart
   helpers.
5. **Routing:** `react-router-dom` (Foundation Card 2); the Market Radar is a drawer addressed by URL
   state, not a screen.
6. **Onboarding is post-registration only.** `BusinessProfile.tsx` and `UniquenessCalibrationView.tsx`
   leave the sidebar as routed screens; their internals are redistributed into the wizard and Settings.

## Testing strategy

- **Unit (Vitest):** every card's own component/state-machine logic. Colocated `*.test.tsx`, run via
  `npm run test:unit -- <pattern>` in `frontend/`.
- **CI:** `.github/workflows/ci-frontend-v2.yml`, scoped to `frontend/**`, runs `npm run test:unit`,
  `npm run test:integration`, and `npm run build` on every push/PR to `main`. It is a fresh workflow,
  not a rename of `.github/workflows/ci-frontend.yml` — that file stays scoped to `ceview/**` and
  unchanged, since `ceview/` keeps deploying until cutover.
- **E2E (Playwright):** deferred. `e2e/tests/*.spec.ts` and `.github/workflows/e2e.yml`'s path filters
  still target `ceview/**` exclusively and are not touched by this plan set — wiring `frontend/` into
  the e2e suite (new spec files or repointed filters) is a decision for a later plan, once enough
  screens exist here to be worth the path-filtering rework the original strategy below describes.
  The original design (kept for reference until that later plan supersedes it): one spec file per
  screen under `e2e/tests/`, each pre-created with a `test.describe` block per sub-screen card; a
  card's Definition of Done includes un-skipping (and passing) its own block; PRs run only the specs
  for screens whose files changed (path-filtered — see the `changes` job in `.github/workflows/
  e2e.yml`), reported as separate named checks (`e2e-screen (dashboard)`, `e2e-screen
  (content-studio)`, …); a change under a `foundation` path forces every screen to run; push to `main`
  and the nightly `schedule` trigger always run the complete, unfiltered suite.

## Dependency graph

Foundation cards have no dependencies and block every screen card. Within a module, cards depend only
on their module's foundation card(s) unless cross-module-linked below (Content Studio's Publish
Composer needs Settings — Platforms; Calendar and Performance's published list need Content Studio's
publish action). Module 2 uses the new module-scoped ID scheme end to end (see `03-module-2.md`);
Modules 1/3/4 below keep their legacy local numbers for now — retrofitting them is future work, not
done in this pass.

| ID | Card | File | Depends on |
|---|---|---|---|
| — | Project Scaffold | [`01-foundation.md`](01-foundation.md) | — |
| — | Design System | [`01-foundation.md`](01-foundation.md) | Project Scaffold |
| — | Shell & Routing | [`01-foundation.md`](01-foundation.md) | Design System |
| — | Fixture Data Layer | [`01-foundation.md`](01-foundation.md) | Project Scaffold |
| 4 | Onboarding — Wizard Shell & Step 1 Basic Info | [`02-module-1.md`](02-module-1.md) | Shell & Routing |
| 5 | Onboarding — Step 2 Brand Identity | [`02-module-1.md`](02-module-1.md) | Card 4 |
| 6 | Onboarding — Step 3 Structured Inputs | [`02-module-1.md`](02-module-1.md) | Card 4 |
| 7 | Onboarding — Step 4 Assets & Links | [`02-module-1.md`](02-module-1.md) | Card 4 |
| 8 | Onboarding — Step 5 Analysis | [`02-module-1.md`](02-module-1.md) | Cards 5, 6, Fixture Data Layer |
| 9 | Settings — Business Profile | [`02-module-1.md`](02-module-1.md) | Shell & Routing, Fixture Data Layer |
| M2-F | Foundation — Dashboard & Radar Shell | [`03-module-2.md`](03-module-2.md) | Shell & Routing, Fixture Data Layer |
| M2-1 | Dashboard — Alert Feed & Category Filtering | [`03-module-2.md`](03-module-2.md) | M2-F |
| M2-2 | Dashboard — Markets Reveal | [`03-module-2.md`](03-module-2.md) | M2-F |
| M2-3 | Dashboard — AI Status Banner & Refresh Forecast | [`03-module-2.md`](03-module-2.md) | M2-F |
| M2-4 | Market Radar Drawer — Directive & Demand Chart | [`03-module-2.md`](03-module-2.md) | M2-F |
| M2-5 | Market Radar Drawer — Economic & Seasonal Insights Tabs | [`03-module-2.md`](03-module-2.md) | M2-F |
| M2-B1 | Category-Scoped Market Ranking — Query & Endpoint | [`03-module-2.md`](03-module-2.md) | — |
| M2-B2 | Category-Scoped Market Ranking — Alert-Time Rank Embed | [`03-module-2.md`](03-module-2.md) | M2-B1 |
| 15 | Content Studio — AI Copywriting Matrix (incl. Naver) | [`04-module-3.md`](04-module-3.md) | Shell & Routing, Fixture Data Layer |
| 16 | Content Studio — Visual Direction Board | [`04-module-3.md`](04-module-3.md) | Card 15 |
| 17 | Content Studio — Publish Composer (connection-gated) | [`04-module-3.md`](04-module-3.md) | Card 15, Settings — Platforms |
| 18 | Content Studio — Compliance Audit Panel | [`04-module-3.md`](04-module-3.md) | Card 17 |
| 19 | Content Studio — Content Board & Publish Action | [`04-module-3.md`](04-module-3.md) | Cards 17, 18 |
| 20 | Calendar — Month Grid & Navigation | [`04-module-3.md`](04-module-3.md) | Card 19 (shared post store) |
| 21 | Calendar — List View & Day-Click Modal | [`04-module-3.md`](04-module-3.md) | Card 20 |
| 22 | Settings — Platforms | [`04-module-3.md`](04-module-3.md) | Shell & Routing, Fixture Data Layer |
| 23 | Settings — Workspace | [`04-module-3.md`](04-module-3.md) | Shell & Routing, Fixture Data Layer |
| 24 | Performance — Ingestion Form Entry State | [`05-module-4.md`](05-module-4.md) | Shell & Routing |
| 25 | Performance — KPI Cards, PES Gauge & Funnel | [`05-module-4.md`](05-module-4.md) | Card 24 |
| 26 | Performance — Trend Charts & AI Action Plan | [`05-module-4.md`](05-module-4.md) | Card 25 |
| 27 | Performance — Previously Published & Post Analytics Modal | [`05-module-4.md`](05-module-4.md) | Card 25, Content Studio Card 19 |

## Playwright spec ↔ card map

| Spec file | Fed by cards |
|---|---|
| `e2e/tests/login.spec.ts` | Foundation — Shell & Routing |
| `e2e/tests/onboarding-wizard.spec.ts` | Cards 4–8 |
| `e2e/tests/settings-business-profile.spec.ts` | Card 9 |
| `e2e/tests/dashboard.spec.ts` | M2-F, M2-1, M2-2, M2-3 |
| `e2e/tests/market-radar-drawer.spec.ts` | M2-F, M2-4, M2-5 |
| `e2e/tests/content-studio.spec.ts` | Cards 15–19 |
| `e2e/tests/calendar.spec.ts` | Cards 20–21 |
| `e2e/tests/settings-platforms.spec.ts` | Card 22 |
| `e2e/tests/settings-workspace.spec.ts` | Card 23 |
| `e2e/tests/performance.spec.ts` | Cards 24–27 |
