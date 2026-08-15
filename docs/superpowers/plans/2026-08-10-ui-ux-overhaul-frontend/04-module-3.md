# Module 3 — Content Studio, Calendar, Platforms, Workspace

All paths in this file are relative to `frontend/` (see `00-index.md`'s "Target directory" note).
Cards 22–23's Settings components live in the consolidated `components/settings/`, not
`components/module-3/settings/` or `components/shared/settings/` — see those cards below for why. Any
DoD item below referencing a Playwright spec passing is deferred until `frontend/` is wired into
`e2e/` — see `00-index.md`'s Testing Strategy; treat it as a manual verification step for now.

Screen docs: [`content-studio.md`](../../../module-3/screens/content-studio.md),
[`calendar.md`](../../../module-3/screens/calendar.md),
[`settings-platforms.md`](../../../module-3/screens/settings-platforms.md),
[`docs/shared/workspace.md`](../../../shared/workspace.md). Spec files:
`e2e/tests/content-studio.spec.ts` (Cards 15–19), `e2e/tests/calendar.spec.ts` (Cards 20–21),
`e2e/tests/settings-platforms.spec.ts` (Card 22), `e2e/tests/settings-workspace.spec.ts` (Card 23).

**Component diagram:** [`diagrams/module-3.mmd`](diagrams/module-3.mmd)

**Reminder:** Content Studio builds prototype **v1** (`screen-content`/`renderContent`) only.
`screen-content2` is a superseded draft — not built, not referenced by any card below.

---

### CARD — Content Studio: AI Copywriting Matrix (incl. Naver)

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** Left-column caption matrix — platform tabs, archetype options, Naver's 2-option branch,
"Why this caption" disclosure, Approve.
**Prototype reference:** screen-content / `renderContent()` (matrix section) + `csApprove()` —
`ui-ux-prototype.html:2794–2839`, `:2945–2958`, `:2692–2699`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx` — platform tabs + the option
  cards for the active platform
- `components/module-3/3.1-content-studio/CaptionOptionCard.tsx` — one archetype option (editable
  textarea, char counter, "Why this caption" disclosure, Approve button)

**Related files:**
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) — `MOCK_CONTENT.captions`, the
  per-platform option text/metadata this card renders
- `types.ts` — `PlatformId`, the char-limit lookup keyed by it

**Flow:** [`diagrams/cards/module-3/ai-copywriting-matrix.mmd`](diagrams/cards/module-3/ai-copywriting-matrix.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/ai-copywriting-matrix.ts`](pseudocode/module-3/ai-copywriting-matrix.ts)

**Milestone (finished state):** Switching platform tabs shows that platform's own options (2 for
Naver, 3 for the rest); approving one option on Instagram doesn't affect Facebook's approval state.

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

**Depends on:** Card 15 (AI Copywriting Matrix)
**Summary:** Numbered shot-list guidance for the active platform tab.
**Prototype reference:** screen-content / `renderContent()` (visual direction section) —
`ui-ux-prototype.html:2961–2975` (card immediately below the caption matrix)

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/VisualDirectionBoard.tsx` — numbered shot-list card

**Related files:**
- `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx` (Card 15) — owns the active
  platform tab state this card reads
- `services/fixtures/content.ts` (Foundation — Fixture Data Layer) —
  `MOCK_CONTENT.captions[platform].guide`, the shot-list array this card renders

**Flow:** [`diagrams/cards/module-3/visual-direction-board.mmd`](diagrams/cards/module-3/visual-direction-board.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/visual-direction-board.ts`](pseudocode/module-3/visual-direction-board.ts)

**Milestone (finished state):** Switching platform tabs swaps the shot-list content to match.

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

**Depends on:** Card 15 (AI Copywriting Matrix), Settings — Platforms (Card 22)
**Summary:** Right-column composer — staged caption, pubmat, connection-gated platform picker, config
switches, agreement checkbox.
**Prototype reference:** screen-content / `renderContent()` (composer section) + `csPublishReady()` +
`csPublishBlockReason()` — `ui-ux-prototype.html:2701–2730`, `:2755–2770`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/PublishComposer.tsx` — staged caption, pubmat, platform
  picker, config switches, agreement checkbox, Publish button

**Related files:**
- `components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx` (Card 15) — the `staged` value
  this composer edits and displays
- `components/settings/PlatformsSettings.tsx` (Card 22) — the connection state gating the platform
  picker
- `components/shared/Toast.tsx` (Foundation — Shell & Routing) — used for the publish confirmation

**Flow:** [`diagrams/cards/module-3/publish-composer.mmd`](diagrams/cards/module-3/publish-composer.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/publish-composer.ts`](pseudocode/module-3/publish-composer.ts)

**Milestone (finished state):** A disconnected platform cannot be added to "Publish to" without first
completing Connect; the Publish button's tooltip text always matches the single blocking reason in the
documented priority order.

**Definition of Done:**
- [ ] `PublishComposer.test.tsx` covers the full block-reason ladder, one case per rung
- [ ] `content-studio.spec.ts` → "Publish Composer" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PublishComposer
```

---

### CARD — Content Studio: Compliance Audit Panel

**Depends on:** Card 17 (Publish Composer)
**Summary:** The six-step OMCS audit animation and its result display.
**Prototype reference:** screen-content / `renderContent()` (compliance section) + `runOmcsAudit()` —
`ui-ux-prototype.html:2841–2895`, `:2731–2753`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/CompliancePanel.tsx` — all 3 states (empty/auditing/
  complete)
- `components/module-3/3.1-content-studio/OmcsGauge.tsx` — the radial score gauge

**Related files:**
- `components/module-3/3.1-content-studio/PublishComposer.tsx` (Card 17) — the agreement checkbox
  that triggers this card's audit
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

**Depends on:** Card 17 (Publish Composer), Card 18 (Compliance Audit Panel)
**Summary:** All/Draft/Published tabs over the post list, and the Publish action that populates the
shared post store Calendar and Performance read from.
**Prototype reference:** screen-content / `renderContent()` (board section) + `csPublish()` —
`ui-ux-prototype.html:2897–2917`, `:2772–2789`

**Project files to add/implement:**
- `components/module-3/3.1-content-studio/ContentBoard.tsx` — All/Draft/Published tabs + post cards
- `services/postStore.ts` (or equivalent shared state module) — the post list Content Studio,
  Calendar, and Performance all read from and Content Studio writes to

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `posts.list()`, the initial fixture
  data this store seeds from
- `components/module-3/3.1-content-studio/PublishComposer.tsx` (Card 17) — the staged caption,
  media, and selected platforms this card's Publish action consumes

**Flow:** [`diagrams/cards/module-3/content-board-publish-action.mmd`](diagrams/cards/module-3/content-board-publish-action.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/content-board-publish-action.ts`](pseudocode/module-3/content-board-publish-action.ts)

**Milestone (finished state):** Publishing to 2 platforms adds 2 new posts to the board immediately,
visible under the "Published" filter without a reload.

**Definition of Done:**
- [ ] `ContentBoard.test.tsx` covers the filter tabs and the publish-appends-N-posts behavior
- [ ] `content-studio.spec.ts` → "Content Board & Publish Action" — deferred, not wired for
      `frontend/` yet (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- ContentBoard
```

---

### CARD — Calendar: Month Grid & Navigation

**Depends on:** Card 19 (Content Board & Publish Action — shared post store)
**Summary:** New `CalendarView.tsx` — month grid with per-day post chips. **Does not** reuse or extend
`ceview/old-components/CalendarView.tsx` (legacy, untouched per `.claude/CLAUDE.md`).
**Prototype reference:** screen-calendar / `renderCalendar()` (grid + nav) —
`ui-ux-prototype.html:3685–3747`

**Project files to add/implement:**
- `components/module-3/calendar/CalendarView.tsx` — page shell, month grid, navigation
- `components/module-3/calendar/CalendarCell.tsx` — one day cell with its post chips

**Related files:**
- `services/postStore.ts` (Card 19) — the shared post list this calendar renders per day

**Flow:** [`diagrams/cards/module-3/calendar-month-grid-navigation.mmd`](diagrams/cards/module-3/calendar-month-grid-navigation.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-month-grid-navigation.ts`](pseudocode/module-3/calendar-month-grid-navigation.ts)

**Milestone (finished state):** `/calendar` shows the current month with today ringed; a post
published from Content Studio (Card 19) appears on today's cell without a reload.

**Definition of Done:**
- [ ] `CalendarView.test.tsx` covers month-boundary cell distribution (leading/trailing/today)
- [ ] `calendar.spec.ts` → "Month Grid & Navigation" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarView
```

---

### CARD — Calendar: List View & Day-Click Modal

**Depends on:** Card 20 (Month Grid & Navigation)
**Summary:** Flat list view toggle and the day-click detail modal.
**Prototype reference:** screen-calendar / `renderCalendar()` (list view + `calendarDayClick()`) —
`ui-ux-prototype.html:3713–3722`, `:3731–3734`

**Project files to add/implement:**
- `components/module-3/calendar/CalendarListView.tsx` — flat reverse-chronological post list
- `components/module-3/calendar/DayPostsModal.tsx` — the day-click detail modal

**Related files:**
- `components/module-3/calendar/CalendarView.tsx` (Card 20) — the view-mode toggle (Month/List) and
  shared post store this card extends
- `components/shared/Modal.tsx` (Foundation — Shell & Routing) — the overlay primitive
  `DayPostsModal` is built on

**Flow:** [`diagrams/cards/module-3/calendar-list-view-day-click-modal.mmd`](diagrams/cards/module-3/calendar-list-view-day-click-modal.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/calendar-list-view-day-click-modal.ts`](pseudocode/module-3/calendar-list-view-day-click-modal.ts)

**Milestone (finished state):** Clicking a day with zero posts does nothing; clicking a day with posts
opens the modal with correct per-post detail.

**Definition of Done:**
- [ ] `CalendarView.test.tsx` extended: day-click no-op vs. modal-open branches
- [ ] `calendar.spec.ts` → "List View & Day-Click Modal" — deferred, not wired for `frontend/` yet
      (see `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- CalendarView
```

---

### CARD — Settings: Platforms

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** `/settings/platforms` — connect/disconnect the four publishing destinations; gates
Content Studio's publish picker (Card 17).
**Prototype reference:** screen-settings (platforms tab) / `connectPlatform()` + `grantScope()` +
`finishConnect()` + `disconnectPlatform()` — `ui-ux-prototype.html:4131–4202`

**Project files to add/implement:**
- `components/settings/PlatformsSettings.tsx` — one row per platform, Verified+Disconnect or Connect.
  Lives in the consolidated `components/settings/` alongside Card 9's `BusinessProfileSettings.tsx`
  (`02-module-1.md`) and this file's own `WorkspaceSettings.tsx` below — all three Settings sub-tabs
  share one directory regardless of which module's card describes them, per project decision
  (diverges from `e2e.yml`'s current per-module settings path filters, which still target
  `ceview/`'s split layout and are out of scope for `frontend/` — see `00-index.md`'s Testing
  Strategy)
- `components/settings/ConnectPlatformModal.tsx` — the redirecting-spinner → scope-grant flow

**Related files:**
- `services/apiClient.ts` (Foundation — Fixture Data Layer) — `connections.list/connect/disconnect`
- `components/module-3/3.1-content-studio/PublishComposer.tsx` (Card 17) — reads this card's
  connection state to gate the "Publish to" picker, and has its in-progress selection pruned by this
  card's disconnect action

**Flow:** [`diagrams/cards/module-3/settings-platforms.mmd`](diagrams/cards/module-3/settings-platforms.mmd)

**Steps (pseudocode):** [`pseudocode/module-3/settings-platforms.ts`](pseudocode/module-3/settings-platforms.ts)

**Milestone (finished state):** Connecting a platform here immediately unlocks it in Content Studio's
picker without a reload (shared state, not a re-fetch); disconnecting a selected platform mid-publish
removes it from that selection.

**Definition of Done:**
- [ ] `PlatformsSettings.test.tsx` covers connect/disconnect state propagation and the cross-screen
      selection-removal rule
- [ ] `settings-platforms.spec.ts` → "Platforms" — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- PlatformsSettings
```

---

### CARD — Settings: Workspace

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** `/settings/workspace` — member list + invite-by-email form.
**Prototype reference:** screen-settings (workspace tab) / `sendInvite()` —
`ui-ux-prototype.html:4203–4212`

**Project files to add/implement:**
- `components/settings/WorkspaceSettings.tsx` — member list + invite form. Lives in the consolidated
  `components/settings/` — see the Settings: Platforms card above for the consolidation note

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
- [ ] Code review approved (including explicit sign-off on the gaps flagged above)

**Verification:**
```
cd frontend && npm run test:unit -- WorkspaceSettings
```
