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

**Steps (pseudocode):**
1. Render a platform tab bar (Instagram / TikTok / Facebook / Naver). A tab shows a gold dot if that
   platform already has an approved option. Switching tabs is local UI state, independent per
   platform — approving on one platform never touches another platform's approval state.
2. For the active platform, render its option cards from `MOCK_CONTENT.captions[platform].options`:
   - Instagram, TikTok, Facebook: exactly 3 cards, one per archetype (Witty, Formal, Storytelling).
   - Naver: exactly 2 cards (curated long-form Korean editorial templates), plus an info banner
     above the cards explaining Naver uses curated templates instead of the archetype model — this
     branch doesn't exist in the current component and is new work.
3. Each option card:
   - Editable textarea, pre-filled with the option's caption text; edits persist per-option (not
     shared across options or platforms).
   - Live character counter against that platform's character limit; render it in an error state
     when the current text exceeds the limit.
   - A "Why this caption" disclosure toggle revealing the option's 5 metadata dimensions (core
     business context, market/cultural localization, psychological elements, creative tone, platform
     architecture) — Naver options have no metadata, so this control is omitted for them.
   - An Approve button.
4. Approving an option:
   - Marks that option as the platform's approved one (only one option per platform can be approved
     at a time).
   - Copies its (possibly edited) text into the shared composer's `staged` field (Card 17 reads
     this).
   - Clears any existing audit result and resets the agreement checkbox (Card 18 depends on this —
     editing/re-approving invalidates a stale audit).

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

**Steps (pseudocode):**
1. Read the active platform from Card 15's shared state (not local — must stay in sync when the
   operator switches tabs).
2. Render `MOCK_CONTENT.captions[platform].guide` as a numbered list of shot-composition
   instructions.
3. Switching platform tabs (in Card 15) re-renders this board with the new platform's guide array —
   no separate tab control of its own.

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

**Steps (pseudocode):**
1. Render the staged caption as its own editable textarea (separate from the option cards — editing
   it does not change which option is "approved"), with a character count.
2. Render a pubmat dropzone: drag-and-drop or click to browse; accepts PNG/JPG/WEBP up to 20MB;
   shows a preview once a file is set, with a remove action. Setting or clearing the pubmat clears
   any existing audit result and resets the agreement checkbox.
3. Render the "Publish to" platform picker as one toggle per platform:
   - **Deviation from prototype v1:** a platform not connected in Settings → Platforms renders
     disabled with an inline "Connect" affordance instead of being freely selectable.
   - Toggling a platform's selection clears any existing audit result and resets the agreement
     checkbox.
4. Render 3 post-config switches (visibility / comments / paid) as plain local toggles — no
   validation gate depends on them.
5. Render the agreement checkbox: checking it, when a caption is staged and media is uploaded,
   triggers the compliance audit (Card 18). Unchecking it does not undo a completed audit.
6. Render the Publish button, disabled unless every gate below passes. Its tooltip always shows the
   **first** unmet reason in this exact priority order:
   1. Caption staged (non-empty).
   2. Media uploaded.
   3. At least one platform selected (and that selection only allows connected platforms, per step
      3).
   4. Agreement checkbox checked.
   5. Audit not currently running.
   6. Audit has run at all.
   7. Audit passed (status `Pass`, not `Fail`).

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

**Steps (pseudocode):**
1. Empty state (no audit run yet): render a "not run" placeholder explaining the prerequisites
   (stage a caption, upload a pubmat, tick the agreement).
2. Auditing state: render a 6-step checklist, one row per fixed audit-step label ("Loading approved
   caption and pubmat", "Comparing pubmat against your business profile", "Scoring the 7-dimension
   visual rubric", "Checking caption ↔ image consistency", "Computing OMCS composite score",
   "Resolving pass / fail outcome"). Advance one step roughly every 420ms; each completed step shows
   a check, the current step shows an in-progress state, later steps are inert.
3. On the last step completing, fetch the audit result (`apiClient.omcs.evaluate()`, fixture-backed)
   and transition to the complete state.
4. Complete state: render —
   - A radial gauge showing the overall OMCS score, colored by band (e.g. green ≥80, gold ≥60, red
     below).
   - A pass/fail chip — pass at score ≥ 70.
   - The 3 weighted sub-scores (profile semantic ×0.35, recommendations×picture ×0.45, pubmat
     consistency ×0.20) as bars, with the weighted-sum formula shown verbatim below them.
   - The 7-row rubric table (dimension label → score), using `OMCS_RUBRIC_LABELS` for row labels.
   - A feedback banner (styled by pass/fail) and a consistency-explanation paragraph.
   - A "Re-run" button that returns to the auditing state.

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

**Steps (pseudocode):**
1. `ContentBoard.tsx`: render 3 tabs (All / Draft / Published) filtering the shared post store by
   `status`; each card shows a platform-colored dot, status chip, date, a caption excerpt, and — only
   for published posts — a reach/likes footer.
2. Publish action (invoked once the Composer's Publish button, Card 17, is enabled and clicked):
   - For each platform selected in the composer, append one new post to the shared store: today's
     date, that platform, the staged caption, `status: 'published'`.
   - Clear the composer's transient state (`publishPlatforms`, `agreed`, `omcs`) so a subsequent
     publish starts clean.
   - Leave each platform's approved caption (from Card 15) intact — only the composer-level
     transient fields reset, not the per-platform approvals.
   - Show a confirmation toast naming how many platforms were published to.

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

**Steps (pseudocode):**
1. Given a target year/month, compute the 7-column grid:
   - Leading cells for the previous month's trailing days (greyed, inert — not clickable even if
     that date happens to have posts, since they belong to a different month view).
   - One cell per day of the target month.
   - Trailing cells for the next month's leading days (greyed, inert), padding the grid out to a
     multiple of 7.
   - The cell matching today's real date renders with a ring/highlight.
2. For each in-month day cell, look up posts whose date matches that cell and render up to 3 as
   platform-colored chips (border-left colored by platform); if there are more than 3, render a
   "+N more" indicator instead of a 4th chip.
3. Month navigation: prev/next buttons shift the displayed month by one, wrapping December → January
   and vice versa.
4. Render a header above the grid showing per-status counts (published / scheduled / draft) across
   the whole post store (not just the visible month).

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

**Steps (pseudocode):**
1. Add a Month/List segmented toggle to the Calendar header (from Card 20's shell).
2. List view: render every post in the shared store sorted by date descending (most recent first),
   each row showing platform, date, a single-line caption excerpt, and a status chip.
3. Day click on a Month-view cell (Card 20):
   - If that day has zero posts: no-op — clicking does nothing.
   - If that day has ≥1 post: open `DayPostsModal` listing every post scheduled/published that day;
     for published posts, show reach/likes/engagement inline alongside the caption.

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

**Steps (pseudocode):**
1. Render one row per known platform, sourced from connection state
   (`apiClient.connections.list()`): a connected platform shows "Verified" + a Disconnect action; a
   disconnected one shows a Connect action.
2. Connect flow (`ConnectPlatformModal`), triggered by clicking Connect:
   - Open a modal showing a redirecting spinner ("Redirecting to <platform>…").
   - After a short simulated delay, replace it with a scope-grant list (the permissions being
     requested) and a "Grant scope" button.
   - Clicking "Grant scope" marks the platform connected, closes the modal, and shows a confirmation
     toast.
3. Disconnect action: immediately marks the platform disconnected (no confirmation modal) and shows a
   toast.
   - **New rule** (not in the prototype): disconnecting a platform that is currently selected in
     Content Studio's in-progress "Publish to" list (Card 17) also removes it from that selection.

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

**Steps (pseudocode):**
1. Render the member list, one row per member: avatar (or initials), name, email, a role chip, and —
   for members who haven't accepted yet — an "Invite pending" chip.
2. Render an invite form: email input + role select (Editor or Viewer only — never Owner).
3. On submit:
   - Derive a display name from the email's local part (split on `._-`, title-case each word).
   - Derive initials from that display name (first letter of the first two words, uppercased).
   - Append a new member row optimistically, marked pending, before any network confirmation.
   - Show a confirmation toast naming the invited email.
4. Known gap — flag, don't silently resolve: no invite acceptance/expiry/revocation is modeled — a
   pending invite has no way to become "active" or be revoked in this UI. Real gaps; see
   [`docs/shared/workspace.md`](../../../shared/workspace.md)'s "Behavior" section.

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
