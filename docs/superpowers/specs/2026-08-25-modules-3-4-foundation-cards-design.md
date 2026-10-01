# Modules 3 & 4 task-card revamp: foundation-card structure

## Context

The Module 2 revamp (`2026-08-19-module-2-parallel-task-cards-design.md`) introduced the
foundation-card pattern — one prerequisite card owns every file two or more sibling cards would
otherwise both edit, creating typed stubs the siblings each replace whole — and wrote it into
`00-index.md` as a binding rule. That pass deliberately left Modules 1, 3, and 4 unconverted.

This pass applies the pattern to Modules 3 and 4:
`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md` (Cards 15–23) and
`05-module-4.md` (Cards 24–27). Both files today declare chained dependencies (15→16→17→18→19→20→21,
24→25→26→27) whose real blocker is undeclared shared-file ownership: Cards 15–19 all extend the same
Content Studio surface, Cards 25–27 all extend `CampaignAnalyticsView.tsx`, and the two cross-screen
couplings (`services/postStore.ts`, platform-connection state) are each created midway through a
feature card, forcing unrelated cards to queue behind them.

Module 1 is out of scope and keeps its legacy card numbers, as it does today.

## Decisions

1. **Module 3 gets one foundation card per surface**, not a single module-wide one — Content Studio,
   Calendar, and Settings are separate surfaces with separate shells.
2. **Cross-surface state is lifted into its own root card** (`M3-F0`), so no surface's foundation
   depends on another's feature card.
3. **Module 4's Card 24 is promoted into `M4-F`** rather than getting a new card above it — it
   already builds the shell and owns the campaign state Cards 25–27 read.
4. **Modules 3 and 4 renumber to the `M<n>-<k>` scheme.** Module 1 keeps legacy numbers.
5. **The `00-index.md` binding rule is amended** to describe the general shape this produces.
6. **The existing `frontend/` scaffold stubs move** to the numbered directory convention Module 2
   already uses on disk.

## Module 3 new card structure

Four roots. Every other card depends on exactly one of them.

### M3-F0 — Foundation: Shared Stores

Depends on: Foundation — Fixture Data Layer.

- `services/postStore.ts` — typed post list seeded from `services/fixtures/posts.ts`, with the
  publish/append action and per-post metric accessors.
- `services/connectionsStore.ts` — typed platform-connection state seeded from
  `apiClient.connections.list()`, with connect/disconnect actions and the rule that disconnecting a
  platform prunes it from any in-progress publish selection.

This card exists because both stores cross surface boundaries: the post store is written by Content
Studio and read by Calendar and Module 4; the connection store is written by Settings — Platforms and
read by Content Studio's Publish Composer. Owning them here is what lets those consumers stop
depending on each other's feature cards.

### M3-F1 — Foundation: Content Studio Shell

Depends on: Foundation — Shell & Routing, M3-F0.

- `components/module-3/3.1-content-studio/ContentStudioView.tsx` — two-column page shell; owns the
  state shared across siblings: `activePlatform` (read by the matrix and the visual direction board),
  the staged caption / media / selected-platforms draft (read by the composer, the compliance
  trigger, and the publish action), and `auditStatus` / `auditResult` (written by the compliance
  panel, read by the composer's block-reason ladder). Composes five named slot components by fixed
  import path.
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` — the five slot prop contracts
  (`MatrixSlotProps`, `VisualDirectionSlotProps`, `ComposerSlotProps`, `ComplianceSlotProps`,
  `BoardSlotProps`).
- `AIContentMatrixPanel.tsx`, `VisualDirectionBoard.tsx`, `PublishComposer.tsx`,
  `CompliancePanel.tsx`, `ContentBoard.tsx` — **stub placeholders only**; ownership of each transfers
  whole to one sibling below.

Milestone: `/content` renders the shell with all five slot placeholders visible and the shared draft
state observable, before any sibling fills in real content.

### Content Studio siblings (all depend on M3-F1 only)

| ID | Card | Owns |
|---|---|---|
| M3-1 | Content Studio: AI Copywriting Matrix (incl. Naver) | `AIContentMatrixPanel.tsx`, `CaptionOptionCard.tsx` |
| M3-2 | Content Studio: Visual Direction Board | `VisualDirectionBoard.tsx` |
| M3-3 | Content Studio: Publish Composer (connection-gated) | `PublishComposer.tsx` |
| M3-4 | Content Studio: Compliance Audit Panel | `CompliancePanel.tsx`, `OmcsGauge.tsx` |
| M3-5 | Content Studio: Content Board & Publish Action | `ContentBoard.tsx` |

Changes from today's cards:

- M3-3 no longer depends on Settings — Platforms. It reads `connectionsStore` (M3-F0); M3-9 writes to
  it. The disconnect-prunes-selection rule is store behavior owned by M3-F0 and asserted from both
  sides.
- M3-4 no longer depends on the composer — the shell owns the agreement/trigger state.
- M3-5 no longer creates `services/postStore.ts`; it only calls the store's publish action.

### M3-F2 — Foundation: Calendar Shell

Depends on: Foundation — Shell & Routing, M3-F0.

- `components/module-3/3.2-calendar/CalendarView.tsx` — page shell; owns the visible month, the
  Month/List view-mode toggle, and the day-click → modal-open state; reads `postStore`. Composes
  three named slots.
- `components/module-3/3.2-calendar/calendarTypes.ts` — `MonthGridSlotProps`, `ListViewSlotProps`,
  `DayModalSlotProps`.
- `CalendarMonthGrid.tsx`, `CalendarListView.tsx`, `DayPostsModal.tsx` — stub placeholders.

Calendar siblings (all depend on M3-F2 only):

| ID | Card | Owns |
|---|---|---|
| M3-6 | Calendar: Month Grid & Navigation | `CalendarMonthGrid.tsx`, `CalendarCell.tsx` |
| M3-7 | Calendar: List View | `CalendarListView.tsx` |
| M3-8 | Calendar: Day-Click Modal | `DayPostsModal.tsx` |

Today's Card 21 (List View + Day Modal) splits in two, since the shell now owns the view-mode toggle
and the modal-open state they shared. Calendar no longer depends on Content Studio's publish card —
only on M3-F0.

### M3-F3 — Foundation: Settings Shell

Depends on: Foundation — Shell & Routing, M3-F0.

- `components/settings/SettingsView.tsx` — the `/settings/:tab` shell (tab rail, tab routing, invalid
  tab redirect), replacing today's `RoutePlaceholder` route. Mounts the already-implemented
  `BusinessProfileSettings.tsx` (Module 1's Card 9) as the `profile` tab plus the two stubs below.
- `components/settings/settingsTypes.ts` — the tab registry type and per-tab slot contracts.
- `PlatformsSettings.tsx`, `WorkspaceSettings.tsx` — remain stubs, ownership transferring to the
  siblings below. (Both files already exist as scaffold stubs; this card re-declares their contracts,
  it does not create them.)

This card is described in `04-module-3.md` even though it hosts a Module 1 tab: Module 1's Card 9 is
already built against the consolidated `components/settings/` directory, and the shell that mounts it
is the missing piece both Module 3 Settings cards need.

Settings siblings (all depend on M3-F3 only):

| ID | Card | Owns |
|---|---|---|
| M3-9 | Settings: Platforms | `PlatformsSettings.tsx`, `ConnectPlatformModal.tsx` |
| M3-10 | Settings: Workspace | `WorkspaceSettings.tsx` |

## Module 4 new card structure

One surface, one root.

### M4-F — Foundation: Performance Shell & Ingestion

Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer. This is today's Card 24,
promoted — its scope grows by the slot contracts, the stubs, and the metrics module.

- `components/module-4/4.1-campaign-analytics/CampaignAnalyticsView.tsx` — the `/performance` shell;
  owns the entry↔full-view transition, the submitted campaign input, and the 4/8-week trend toggle;
  composes the slots below by fixed import path.
- `IngestionForm.tsx` — the 7-field campaign-input form.
- `campaignMetrics.ts` — `computeMetrics()` / `computePes()` and the flagged-denominator detection,
  so every sibling renders derived values rather than recomputing them.
- `campaignTypes.ts` — the slot prop contracts.
- Stub placeholders: `KpiCard.tsx`, `FlaggedMetricBanner.tsx`, `PesGauge.tsx`,
  `CustomerJourneyFunnel.tsx`, `PesTrendChart.tsx`, `EfficiencyTrendChart.tsx`, `CostTrendChart.tsx`,
  `AiActionPlan.tsx`, `PreviouslyPublished.tsx`, `PostAnalyticsModal.tsx`.

Siblings:

| ID | Card | Owns | Depends on |
|---|---|---|---|
| M4-1 | Performance: KPI Cards & Flagged Metrics | `KpiCard.tsx`, `FlaggedMetricBanner.tsx` | M4-F |
| M4-2 | Performance: PES Gauge | `PesGauge.tsx` | M4-F |
| M4-3 | Performance: Customer Journey Funnel | `CustomerJourneyFunnel.tsx` | M4-F |
| M4-4 | Performance: Trend Charts | `PesTrendChart.tsx`, `EfficiencyTrendChart.tsx`, `CostTrendChart.tsx` | M4-F |
| M4-5 | Performance: AI Action Plan | `AiActionPlan.tsx` | M4-F |
| M4-6 | Performance: Previously Published & Post Analytics Modal | `PreviouslyPublished.tsx`, `PostAnalyticsModal.tsx` | M4-F, M3-F0 |

Today's Card 25 splits three ways (M4-1/2/3) and Card 26 two ways (M4-4/5), since the state they
shared now lives in the shell. M4-6's cross-module dependency drops from "Content Studio Card 19" to
M3-F0, so it no longer waits on Content Studio being built.

The `computeMetrics`/`computePes` unit tests move with the metrics module: M4-F's Definition of Done
covers the formula and flagged-denominator behavior; M4-1/M4-2 cover rendering of already-derived
values, not the arithmetic.

## Changes to `00-index.md`

- **Binding rule amended** to describe the shape this produces, replacing the current
  one-prerequisite-per-module wording:

  > Every module file must open with a `Foundation — <Surface>` card for each distinct surface it
  > builds, plus — where state crosses surfaces — one or more shared-root cards owning that state.
  > Every other card in the module depends on exactly one of those roots and nothing else within the
  > module (a module's independent tracks, e.g. a parallel backend track, are their own roots the
  > same way). Sibling cards must never list the same file under "Project files to add/implement"; if
  > two features would naturally share a file, the foundation card owns that file (creating typed
  > stubs/slots for the pieces sibling cards fill in) and each sibling card fully owns replacing its
  > one assigned stub. State two sibling cards would both read or write belongs to their shared
  > root, never to one of the siblings.

- **Dependency-graph table** rows for Modules 3 and 4 replaced with the IDs above; the note that
  "Modules 1/3/4 keep their legacy local numbers" narrows to Module 1 only.
- **Playwright spec ↔ card map** updated: `content-studio.spec.ts` ← M3-F1, M3-1…M3-5;
  `calendar.spec.ts` ← M3-F2, M3-6…M3-8; `settings-platforms.spec.ts` ← M3-F3, M3-9;
  `settings-workspace.spec.ts` ← M3-F3, M3-10; `performance.spec.ts` ← M4-F, M4-1…M4-6.

## Changes to the plan files

`04-module-3.md` and `05-module-4.md` are rewritten in full, each card following the existing
template exactly (Depends on / Summary / Prototype reference / Project files to add-implement /
Related files / Flow / Steps / Milestone / Definition of Done / Verification), with a "Parallelism"
note in each file header in Module 2's style. Prototype line references, screen-doc links, milestones,
and DoD content carry over from the current cards; only ownership, dependencies, and the split
boundaries change.

## Companion artifacts

- **New:** `diagrams/cards/module-3/foundation-shared-stores.mmd`,
  `foundation-content-studio-shell.mmd`, `foundation-calendar-shell.mmd`,
  `foundation-settings-shell.mmd`, and `diagrams/cards/module-4/foundation-performance-shell.mmd`,
  each a `flowchart TD` of that card's own control flow, in M2-F's style; matching
  `pseudocode/module-3/foundation-*.ts` and `pseudocode/module-4/foundation-performance-shell.ts`
  typed outlines.
- **New for newly-split siblings:** `.mmd` + `.ts` pairs for `calendar-list-view.mmd` /
  `calendar-day-modal`, and Module 4's `kpi-cards`, `pes-gauge`, `customer-journey-funnel`,
  `trend-charts`, `ai-action-plan`, derived from the existing combined files.
- **Updated:** existing sibling companions whose contracts changed — state they previously owned now
  arrives as slot props, and shell-owned files disappear from their scope.
- **Updated:** `diagrams/module-3.mmd` and `diagrams/module-4.mmd`, redrawn around the shells, their
  slots, and the two shared stores.

## Code changes in `frontend/`

Comment- and path-level only; no behavior changes.

- `git mv` the six Module 3 stubs to `components/module-3/3.1-content-studio/` and
  `components/module-3/3.2-calendar/`, and the two Module 4 stubs to
  `components/module-4/4.1-campaign-analytics/`, matching Module 2's on-disk convention. Nothing
  imports these files today — `/content`, `/calendar`, `/performance`, and `/settings/:tab` all route
  to `RoutePlaceholder` — so the move is import-safe.
- Rewrite each moved stub's header comment to its new card ID and dependencies.
- `components/settings/PlatformsSettings.tsx` and `WorkspaceSettings.tsx` stay in place; only their
  header comments change.

## Out of scope

`01-foundation.md`, `01a-foundation-verification.md`, `02-module-1.md`, Module 1's card numbering, and
any actual implementation of the cards described here.

## Verification

Documentation-only apart from the stub moves, so verification is:

- Every `Flow:` and `Steps (pseudocode):` link in `04-module-3.md` / `05-module-4.md` resolves to an
  existing file; no orphaned `.mmd`/`.ts` companions remain for cards that no longer exist.
- Every ID in `00-index.md`'s dependency graph appears as a card in its named file, and every card in
  those files appears in the graph.
- No two sibling cards under the same root list the same path under "Project files to
  add/implement".
- `cd frontend && npm run build && npm run test:unit` passes after the stub moves.
