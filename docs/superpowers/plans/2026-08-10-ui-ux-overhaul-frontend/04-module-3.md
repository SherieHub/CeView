# Module 3 — Content Studio, Calendar, Platforms, Workspace

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note).
`components/settings/` is the consolidated Settings directory shared with Module 1's Card 9 — see
M3-F3 below for why. Any DoD item below referencing a Playwright spec passing is deferred until
`frontend/` is wired into `e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual
verification step for now.

Screen docs: [`content-studio.md`](../../../module-3/screens/content-studio.md),
[`calendar.md`](../../../module-3/screens/calendar.md),
[`settings-platforms.md`](../../../module-3/screens/settings-platforms.md),
[`docs/shared/workspace.md`](../../../shared/workspace.md). Spec files:
`e2e/tests/content-studio.spec.ts` (M3-F1, M3-1–M3-5), `e2e/tests/calendar.spec.ts` (M3-F2, M3-6–
M3-8), `e2e/tests/settings-platforms.spec.ts` (M3-F3, M3-9), `e2e/tests/settings-workspace.spec.ts`
(M3-F3, M3-10).

**Component diagram:** [`diagrams/module-3.mmd`](diagrams/module-3.mmd)

**Reminder:** Content Studio builds prototype **v1** (`screen-content`/`renderContent()`) only.
`screen-content2` is a superseded draft — not built, not referenced by any card below.

**Parallelism:** Module 3 has four independent roots, not one — Content Studio, Calendar, and
Settings are separate surfaces with separate shells, and state that crosses those surfaces
(`postStore`, `connectionsStore`) lives in its own root, `M3-F0`, so no surface's foundation depends
on another surface's feature card. Once `M3-F0` merges, `M3-F1`/`M3-F2`/`M3-F3` can all be built in
parallel; once each of those merges, its own siblings can all be built in parallel. `M3-3` (Publish
Composer) and `M3-9` (Settings — Platforms) are true siblings of each other — both depend only on
`M3-F0`, neither on the other.

---

### CARD — Foundation: Shared Stores

**Depends on:** Foundation — Fixture Data Layer
**Summary:** The two stores that cross Module 3's surface boundaries — published posts and platform
connections — so Content Studio, Calendar, Settings, and Module 4's published-post card each depend
on this instead of on each other's feature cards.
**Prototype reference:** none — pure state layer; the shapes it seeds from are
`ui-ux-prototype.html:1468–1475` (posts) and `:4131–4202` (connections).

**Project files to add/implement:**
- `services/postStore.ts` — typed post list seeded from `services/fixtures/posts.ts`'s
  `MOCK_POSTS`, with the publish/append action and a per-post metrics accessor
- `services/connectionsStore.ts` — typed platform-connection state seeded from
  `apiClient.connections.list()`, with connect/disconnect actions and a disconnect-event
  subscription

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `posts.list()`,
  `connections.list/connect/disconnect`
- `services/fixtures/posts.ts` — `MOCK_POSTS`, `PublishedPost`, the post store's seed data and type
- `types.ts` — `PlatformConnection`, `PlatformId`

**Flow:** [`diagrams/cards/module-3/foundation-shared-stores.mmd`](diagrams/cards/module-3/foundation-shared-stores.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-shared-stores.ts`](pseudocode/module-3/foundation-shared-stores.ts)

**Milestone (finished state):** Both providers mount above `AppShell` in `App.tsx`; any two
components under the same route tree that call `usePosts()` (or `useConnections()`) see the same
array and the same updates, with no prop drilling and no refetch on write.

**Definition of Done:**
- [ ] `postStore.test.ts` covers seeding, `publish()` appending one post per platform, and
      `metricsFor()`
- [ ] `connectionsStore.test.ts` covers seeding, connect/disconnect state transitions, and that
      `onDisconnect` listeners fire exactly once per disconnect
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- postStore connectionsStore
```

---

### CARD — Foundation: Content Studio Shell

**Depends on:** Foundation — Shell & Routing, Foundation — Shared Stores
**Summary:** The `/content` two-column page shell, the shared draft/audit state every Content Studio
sibling reads or writes, and the disconnect-prunes-selection wiring to `connectionsStore`.
**Prototype reference:** screen-content / `renderContent()` (shell only) —
`ui-ux-prototype.html:2794–2975`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/ContentStudioView.tsx` — two-column layout; owns
  `activePlatform`, the staged publish draft, and `auditStatus`/`auditResult`; composes 5 named slot
  components by fixed import path
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` — the 5 slot prop contracts
  (`MatrixSlotProps`, `VisualDirectionSlotProps`, `ComposerSlotProps`, `ComplianceSlotProps`,
  `BoardSlotProps`)
- `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx`, `VisualDirectionBoard.tsx`,
  `PublishComposer.tsx`, `CompliancePanel.tsx`, `ContentBoard.tsx` — **stub placeholders only**;
  ownership of each transfers whole to one sibling card below

**Related files:**
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) — `MOCK_CONTENT.captions`, the
  per-platform option text/metadata a sibling card renders
- `services/connectionsStore.ts` (Foundation — Shared Stores) — `onDisconnect`, which this card
  subscribes to for pruning `draft.platforms`
- `types.ts` — `PlatformId`

**Flow:** [`diagrams/cards/module-3/foundation-content-studio-shell.mmd`](diagrams/cards/module-3/foundation-content-studio-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-content-studio-shell.ts`](pseudocode/module-3/foundation-content-studio-shell.ts)

**Milestone (finished state):** `/content` renders the shell with all 5 slot placeholders visible;
disconnecting a platform that's staged in the (as-yet-stubbed) composer's selection removes it from
the shared draft state, observable in a state inspector — before any sibling fills in real content.

**Definition of Done:**
- [ ] `ContentStudioView.test.tsx` covers `useContentStudioState()`'s draft-patch/audit-reset
      transitions and the disconnect-prunes-selection subscription
- [ ] `content-studio.spec.ts` shell coverage — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- ContentStudioView
```

---

### CARD — Content Studio: AI Copywriting Matrix (incl. Naver)

**Depends on:** Foundation — Content Studio Shell
**Summary:** Left-column caption matrix — platform tabs, archetype options, Naver's 2-option branch,
"Why this caption" disclosure, Approve.
**Prototype reference:** screen-content / `renderContent()` (matrix section) + `csApprove()` —
`ui-ux-prototype.html:2794–2839`, `:2945–2958`, `:2692–2699`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx` — replaces the Foundation stub;
  platform tabs + the option cards for the active platform
- `components/module-3/3.1-content-studio/CaptionOptionCard.tsx` — one archetype option (editable
  textarea, char counter, "Why this caption" disclosure, Approve button)

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `MatrixSlotProps`, the contract this card implements
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) — `MOCK_CONTENT.captions`, the
  per-platform option text/metadata this card renders
- `types.ts` — `PlatformId`, the char-limit lookup keyed by it

**Flow:** [`diagrams/cards/module-3/ai-copywriting-matrix.mmd`](diagrams/cards/module-3/ai-copywriting-matrix.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/ai-copywriting-matrix.ts`](pseudocode/module-3/ai-copywriting-matrix.ts)

**Milestone (finished state):** Switching platform tabs shows that platform's own options (2 for
Naver, 3 for the rest); approving one option stages its text into the shell's shared draft via
`onStageCaption` without this card reading or writing any other sibling's state.

**Definition of Done:**
- [ ] `AIContentMatrixPanel.test.tsx` covers per-platform independence and the Naver 2-option branch
- [ ] `content-studio.spec.ts` → "AI Copywriting Matrix" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- AIContentMatrixPanel
```

---

### CARD — Content Studio: Visual Direction Board

**Depends on:** Foundation — Content Studio Shell
**Summary:** Numbered shot-list guidance for the active platform tab.
**Prototype reference:** screen-content / `renderContent()` (visual direction section) —
`ui-ux-prototype.html:2961–2975` (card immediately below the caption matrix)

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/VisualDirectionBoard.tsx` — replaces the Foundation stub;
  numbered shot-list card

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `VisualDirectionSlotProps`, the contract this card implements; `activePlatform` arrives from the
  shell, not from the AI Copywriting Matrix card
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) —
  `MOCK_CONTENT.captions[platform].guide`, the shot-list array this card renders

**Flow:** [`diagrams/cards/module-3/visual-direction-board.mmd`](diagrams/cards/module-3/visual-direction-board.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/visual-direction-board.ts`](pseudocode/module-3/visual-direction-board.ts)

**Milestone (finished state):** Switching platform tabs swaps the shot-list content to match, purely
by re-reading the shell's `activePlatform` prop.

**Definition of Done:**
- [ ] `VisualDirectionBoard.test.tsx` covers the platform-tab wiring
- [ ] `content-studio.spec.ts` → "Visual Direction Board" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- VisualDirectionBoard
```

---

### CARD — Content Studio: Publish Composer (connection-gated)

**Depends on:** Foundation — Content Studio Shell
**Summary:** Right-column composer — staged caption, pubmat, connection-gated platform picker, config
switches, agreement checkbox, the block-reason ladder. Reads live connection state from
`connectionsStore`, not from Settings — Platforms directly, so this card and Settings — Platforms are
buildable in parallel.
**Prototype reference:** screen-content / `renderContent()` (composer section) + `csPublishReady()` +
`csPublishBlockReason()` — `ui-ux-prototype.html:2701–2730`, `:2755–2770`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/PublishComposer.tsx` — replaces the Foundation stub;
  staged caption, pubmat, platform picker, config switches, agreement checkbox

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `ComposerSlotProps`, the contract this card implements
- `services/connectionsStore.ts` (Foundation — Shared Stores) — `isConnected()`, the connection state
  gating the platform picker
- `components/shared/Toast.tsx` (Foundation — Shell & Routing) — used for the publish confirmation
  (triggered here on Publish; the click handler itself lives in Content Board & Publish Action)

**Flow:** [`diagrams/cards/module-3/publish-composer.mmd`](diagrams/cards/module-3/publish-composer.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/publish-composer.ts`](pseudocode/module-3/publish-composer.ts)

**Milestone (finished state):** A disconnected platform cannot be added to "Publish to" without first
completing Connect (via an inline link to Settings — Platforms); the Publish button's tooltip text
always matches the single blocking reason in the documented priority order.

**Definition of Done:**
- [ ] `PublishComposer.test.tsx` covers the full block-reason ladder, one case per rung, and the
      connection-gated picker against a mocked `connectionsStore`
- [ ] `content-studio.spec.ts` → "Publish Composer" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PublishComposer
```

---

### CARD — Content Studio: Compliance Audit Panel

**Depends on:** Foundation — Content Studio Shell
**Summary:** The six-step OMCS audit animation and its result display, triggered by the shell's
`draft.agreementChecked` becoming true.
**Prototype reference:** screen-content / `renderContent()` (compliance section) + `runOmcsAudit()` —
`ui-ux-prototype.html:2841–2895`, `:2731–2753`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/CompliancePanel.tsx` — replaces the Foundation stub; all 3
  states (empty/auditing/complete)
- `components/module-3/3.1-content-studio/OmcsGauge.tsx` — the radial score gauge

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `ComplianceSlotProps`, the contract this card implements; writes `AuditState` back to the shell
  via `onAuditChange`, and reads nothing from the Publish Composer card directly
- `services/fixtures/omcs.ts` (Foundation — Fixture Data Layer) — `MOCK_OMCS`, the audit result this
  panel renders; `OMCS_RUBRIC_LABELS` for the rubric table's row labels

**Flow:** [`diagrams/cards/module-3/compliance-audit-panel.mmd`](diagrams/cards/module-3/compliance-audit-panel.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/compliance-audit-panel.ts`](pseudocode/module-3/compliance-audit-panel.ts)

**Milestone (finished state):** Ticking the agreement checkbox with a caption + media staged runs the
full 6-step animation and lands on a pass/fail result matching the fixture `MOCK_OMCS` data.

**Definition of Done:**
- [ ] `CompliancePanel.test.tsx` covers all 3 states (empty/auditing/complete) and the pass/fail color
      branch
- [ ] `content-studio.spec.ts` → "Compliance Audit Panel" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CompliancePanel
```

---

### CARD — Content Studio: Content Board & Publish Action

**Depends on:** Foundation — Content Studio Shell, Foundation — Shared Stores
**Summary:** All/Draft/Published tabs over the post list, and the Publish action that calls
`postStore.publish()` to populate the shared post store Calendar and Performance read from.
**Prototype reference:** screen-content / `renderContent()` (board section) + `csPublish()` —
`ui-ux-prototype.html:2897–2917`, `:2772–2789`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/ContentBoard.tsx` — replaces the Foundation stub;
  All/Draft/Published tabs + post cards + the Publish button's click handler

**Related files:**
- `components/module-3/3.1-content-studio/contentStudioTypes.ts` (Foundation — Content Studio Shell)
  — `BoardSlotProps`, the contract this card implements; calls `onPublished()` on success so the
  shell clears the draft and resets the audit
- `services/postStore.ts` (Foundation — Shared Stores) — `usePosts().publish()`, which this card
  calls; it does not create or seed the store itself

**Flow:** [`diagrams/cards/module-3/content-board-publish-action.mmd`](diagrams/cards/module-3/content-board-publish-action.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/content-board-publish-action.ts`](pseudocode/module-3/content-board-publish-action.ts)

**Milestone (finished state):** Publishing to 2 platforms adds 2 new posts to the board immediately,
visible under the "Published" filter without a reload, and also visible in Calendar/Performance
without either of those needing to be open.

**Definition of Done:**
- [ ] `ContentBoard.test.tsx` covers the filter tabs and the publish-appends-N-posts behavior against
      a mocked `postStore`
- [ ] `content-studio.spec.ts` → "Content Board & Publish Action" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- ContentBoard
```

---

### CARD — Foundation: Calendar Shell

**Depends on:** Foundation — Shell & Routing, Foundation — Shared Stores
**Summary:** The `/calendar` page shell — month grid state, the Month/List view toggle, and the
day-click → modal-open gate — so its three siblings can be built fully in parallel.
**Prototype reference:** screen-calendar / `renderCalendar()` (shell only) —
`ui-ux-prototype.html:3685–3747`. **Does not** reuse or extend
`ceview/old-components/CalendarView.tsx` (legacy, untouched per `.claude/CLAUDE.md`).

**Project files to add/implement:**
- `components/module-3/3.2-calendar/CalendarView.tsx` — page shell; owns the visible month, the
  Month/List toggle, and the day-click → modal-open state; reads `postStore`. Composes 3 named slots
- `components/module-3/3.2-calendar/calendarTypes.ts` — the 3 slot prop contracts
  (`MonthGridSlotProps`, `ListViewSlotProps`, `DayModalSlotProps`)
- `components/module-3/3.2-calendar/CalendarMonthGrid.tsx`, `CalendarListView.tsx`,
  `DayPostsModal.tsx` — **stub placeholders only**; ownership of each transfers whole to one sibling
  card below

**Related files:**
- `services/postStore.ts` (Foundation — Shared Stores) — `usePosts()`, the post list this shell reads
  per day
- `components/shared/Modal.tsx` (Foundation — Shell & Routing) — the overlay primitive
  `DayPostsModal` is built on

**Flow:** [`diagrams/cards/module-3/foundation-calendar-shell.mmd`](diagrams/cards/module-3/foundation-calendar-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-calendar-shell.ts`](pseudocode/module-3/foundation-calendar-shell.ts)

**Milestone (finished state):** `/calendar` shows the current month with today ringed and all 3 slot
placeholders visible; a post published from Content Studio appears in the grid's cell data (observable
even before `CalendarMonthGrid` is built) without a reload.

**Definition of Done:**
- [ ] `CalendarView.test.tsx` covers `buildGrid()`'s month-boundary cell distribution
      (leading/trailing/today), the Month/List toggle, and the day-click no-op-vs-open-modal gate
- [ ] `calendar.spec.ts` shell coverage — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarView
```

---

### CARD — Calendar: Month Grid & Navigation

**Depends on:** Foundation — Calendar Shell
**Summary:** The 7-column month grid and its per-day post chips.
**Prototype reference:** screen-calendar / `renderCalendar()` (grid) — `ui-ux-prototype.html:3685–3747`

**Project files to add/implement:**
- `components/module-3/3.2-calendar/CalendarMonthGrid.tsx` — replaces the Foundation stub; the
  7-column grid
- `components/module-3/3.2-calendar/CalendarCell.tsx` — one day cell with its post chips

**Related files:**
- `components/module-3/3.2-calendar/calendarTypes.ts` (Foundation — Calendar Shell) —
  `MonthGridSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-3/calendar-month-grid-navigation.mmd`](diagrams/cards/module-3/calendar-month-grid-navigation.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-month-grid-navigation.ts`](pseudocode/module-3/calendar-month-grid-navigation.ts)

**Milestone (finished state):** The grid renders leading/trailing days greyed and inert, today ringed,
and up to 3 post chips per day with a "+N more" indicator beyond that.

**Definition of Done:**
- [ ] `CalendarMonthGrid.test.tsx` covers month-boundary cell distribution and the chip-overflow
      indicator
- [ ] `calendar.spec.ts` → "Month Grid & Navigation" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarMonthGrid
```

---

### CARD — Calendar: List View

**Depends on:** Foundation — Calendar Shell
**Summary:** The flat reverse-chronological post list, the sibling of Month Grid under the shell's
view-mode toggle.
**Prototype reference:** screen-calendar / `renderCalendar()` (list view) —
`ui-ux-prototype.html:3713–3722`

**Project files to add/implement:**
- `components/module-3/3.2-calendar/CalendarListView.tsx` — replaces the Foundation stub; flat
  reverse-chronological post list

**Related files:**
- `components/module-3/3.2-calendar/calendarTypes.ts` (Foundation — Calendar Shell) —
  `ListViewSlotProps`, the contract this card implements

**Flow:** [`diagrams/cards/module-3/calendar-list-view.mmd`](diagrams/cards/module-3/calendar-list-view.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-list-view.ts`](pseudocode/module-3/calendar-list-view.ts)

**Milestone (finished state):** Toggling to List view (owned by the shell) shows every post, most
recent first, independent of which month the grid was on.

**Definition of Done:**
- [ ] `CalendarListView.test.tsx` covers the sort order and the empty state
- [ ] `calendar.spec.ts` → "List View" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarListView
```

---

### CARD — Calendar: Day-Click Modal

**Depends on:** Foundation — Calendar Shell
**Summary:** The day-click detail modal — a sibling of Month Grid and List View, mounted only when the
shell has a non-empty day selected.
**Prototype reference:** screen-calendar / `calendarDayClick()` — `ui-ux-prototype.html:3731–3734`

**Project files to add/implement:**
- `components/module-3/3.2-calendar/DayPostsModal.tsx` — replaces the Foundation stub; the day-click
  detail modal

**Related files:**
- `components/module-3/3.2-calendar/calendarTypes.ts` (Foundation — Calendar Shell) —
  `DayModalSlotProps`, the contract this card implements; the shell's day-click gate means this card
  is only ever mounted with a non-empty `posts` array
- `components/shared/Modal.tsx` (Foundation — Shell & Routing) — the overlay primitive this card is
  built on

**Flow:** [`diagrams/cards/module-3/calendar-day-modal.mmd`](diagrams/cards/module-3/calendar-day-modal.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-day-modal.ts`](pseudocode/module-3/calendar-day-modal.ts)

**Milestone (finished state):** The modal lists every post for the clicked day with correct per-post
detail — published posts show metrics inline, drafts show a Draft chip and no metrics.

**Definition of Done:**
- [ ] `DayPostsModal.test.tsx` covers the published-vs-draft row branches
- [ ] `calendar.spec.ts` → "Day-Click Modal" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- DayPostsModal
```

---

### CARD — Foundation: Settings Shell

**Depends on:** Foundation — Shell & Routing, Foundation — Shared Stores
**Summary:** The `/settings/:tab` shell — tab rail, tab routing, invalid-tab redirect — replacing
today's `RoutePlaceholder` route and mounting the already-implemented `BusinessProfileSettings.tsx`
(Module 1's Card 9) as the `profile` tab alongside two new stubs.
**Prototype reference:** screen-settings (tab shell) — `ui-ux-prototype.html:4103–4212`

**Project files to add/implement:**
- `components/settings/SettingsView.tsx` — the `/settings/:tab` shell: tab rail, `useParams()`-driven
  routing, redirect to `/settings/profile` on an unknown tab
- `components/settings/settingsTypes.ts` — the `SettingsTabId` union and the tab registry type

**Project files to modify:**
- `App.tsx` — `{ path: 'settings/:tab', element: <RoutePlaceholder navId="settings"/> }` becomes
  `{ path: 'settings/:tab', element: <SettingsView/> }`

**Related files:**
- `components/settings/BusinessProfileSettings.tsx` (Module 1 — Card 9, already implemented) — mounted
  here as the `profile` tab, unmodified
- `components/settings/PlatformsSettings.tsx`, `WorkspaceSettings.tsx` — remain stubs; ownership
  transfers whole to the two sibling cards below
- `layout/Sidebar.tsx` — its existing settings sub-nav already links to `/settings/<tab>`; no change
  needed here, this card just makes those routes resolve to real content

**Flow:** [`diagrams/cards/module-3/foundation-settings-shell.mmd`](diagrams/cards/module-3/foundation-settings-shell.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/foundation-settings-shell.ts`](pseudocode/module-3/foundation-settings-shell.ts)

**Milestone (finished state):** `/settings/profile` shows the real business-profile form;
`/settings/platforms` and `/settings/workspace` show their stub placeholders under a working tab
rail; `/settings/anything-else` redirects to `/settings/profile`.

**Definition of Done:**
- [ ] `SettingsView.test.tsx` covers tab routing, the active-tab indicator, and the invalid-tab
      redirect
- [ ] `settings-business-profile.spec.ts` still passes unmodified (Module 1's Card 9 coverage)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- SettingsView
```

---

### CARD — Settings: Platforms

**Depends on:** Foundation — Settings Shell
**Summary:** `/settings/platforms` — connect/disconnect the four publishing destinations, reading and
writing the shared `connectionsStore` so Content Studio's Publish Composer reflects changes without a
reload.
**Prototype reference:** screen-settings (platforms tab) / `connectPlatform()` + `grantScope()` +
`finishConnect()` + `disconnectPlatform()` — `ui-ux-prototype.html:4131–4202`

**Project files to add/implement:**
- `components/settings/PlatformsSettings.tsx` — replaces the Foundation Settings Shell's stub; one
  row per platform, Verified+Disconnect or Connect
- `components/settings/ConnectPlatformModal.tsx` — the redirecting-spinner → scope-grant flow

**Related files:**
- `services/connectionsStore.ts` (Foundation — Shared Stores) — `useConnections()`, the store this
  card reads and writes; it does not call `apiClient.connections.*` directly

**Flow:** [`diagrams/cards/module-3/settings-platforms.mmd`](diagrams/cards/module-3/settings-platforms.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/settings-platforms.ts`](pseudocode/module-3/settings-platforms.ts)

**Milestone (finished state):** Connecting a platform here immediately unlocks it in Content Studio's
picker without a reload (shared store, not a re-fetch); disconnecting a platform selected mid-publish
removes it from that selection via the store's disconnect event.

**Definition of Done:**
- [ ] `PlatformsSettings.test.tsx` covers connect/disconnect against a mocked `connectionsStore` and
      that disconnect fires the store's `onDisconnect` event
- [ ] `settings-platforms.spec.ts` → "Platforms" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PlatformsSettings
```

---

### CARD — Settings: Workspace

**Depends on:** Foundation — Settings Shell
**Summary:** `/settings/workspace` — member list + invite-by-email form.
**Prototype reference:** screen-settings (workspace tab) / `sendInvite()` —
`ui-ux-prototype.html:4203–4212`

**Project files to add/implement:**
- `components/settings/WorkspaceSettings.tsx` — replaces the Foundation Settings Shell's stub; member
  list + invite form

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `workspace.members/invite`
- [`docs/shared/workspace.md`](../../../shared/workspace.md) — the modeled-vs-unmodeled invite
  lifecycle behavior this card must match

**Flow:** [`diagrams/cards/module-3/settings-workspace.mmd`](diagrams/cards/module-3/settings-workspace.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/settings-workspace.ts`](pseudocode/module-3/settings-workspace.ts)

**Milestone (finished state):** Sending an invite immediately shows the pending member row with the
derived display name and a confirmation toast.

**Definition of Done:**
- [ ] `WorkspaceSettings.test.tsx` covers the invite-submit → optimistic-row behavior
- [ ] `settings-workspace.spec.ts` → "Workspace" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved (including explicit sign-off on the gaps flagged in
      `docs/shared/workspace.md`)

**Verification:**
```
cd frontend && npm run test:unit -- WorkspaceSettings
```
