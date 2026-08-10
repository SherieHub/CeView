# Module 3 — Content Studio, Calendar, Platforms, Workspace

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

**Steps:**
- [ ] `AIContentMatrixPanel` (extend existing) — platform tabs (Instagram/TikTok/Facebook/Naver),
      gold dot on any tab with an approved option
- [ ] 3 archetype option cards per platform (Witty/Formal/Storytelling), **except Naver** — exactly 2
      curated long-form Korean editorial templates + info banner (`ui-ux-prototype.html:2953–2956`) —
      this branch doesn't exist in the current component and is new work
- [ ] Per-option: editable textarea (inline edits persist per option), live char counter against
      `PLATFORM_CHAR_LIMITS` (red over limit), "Why this caption" disclosure (5 metadata dimensions),
      Approve button
- [ ] Approving stages the text into the composer's `staged` field and clears any existing audit
      result

**Milestone (finished state):** Switching platform tabs shows that platform's own options (2 for
Naver, 3 for the rest); approving one option on Instagram doesn't affect Facebook's approval state.

**Definition of Done:**
- [ ] `AIContentMatrixPanel.test.tsx` covers per-platform independence and the Naver 2-option branch
- [ ] `content-studio.spec.ts` → "AI Copywriting Matrix" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- AIContentMatrixPanel
cd e2e && npx playwright test content-studio.spec.ts -g "AI Copywriting Matrix"
```

---

### CARD — Content Studio: Visual Direction Board

**Depends on:** Card 15 (AI Copywriting Matrix)
**Summary:** Numbered shot-list guidance for the active platform tab.

**Steps:**
- [ ] `VisualDirectionBoard` (existing) — wire to the active platform tab from Card 15, render
      `pc.guide[]` as numbered items

**Milestone (finished state):** Switching platform tabs swaps the shot-list content to match.

**Definition of Done:**
- [ ] `VisualDirectionBoard.test.tsx` covers the platform-tab wiring
- [ ] `content-studio.spec.ts` → "Visual Direction Board" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- VisualDirectionBoard
cd e2e && npx playwright test content-studio.spec.ts -g "Visual Direction Board"
```

---

### CARD — Content Studio: Publish Composer (connection-gated)

**Depends on:** Card 15 (AI Copywriting Matrix), Settings — Platforms (Card 22)
**Summary:** Right-column composer — staged caption, pubmat, connection-gated platform picker, config
switches, agreement checkbox.

**Steps:**
- [ ] Staged caption textarea (editable independently of approved options), char count
- [ ] Pubmat dropzone (drag/click, PNG/JPG/WEBP ≤20MB, preview + remove)
- [ ] Publish-to platform picker — **deviation from prototype v1**: platforms not connected in
      Settings → Platforms render disabled with an inline "Connect" affordance, not freely selectable
- [ ] 3 post-config switches (visibility/comments/paid)
- [ ] Authorization checkbox — checking it (with caption + media staged) triggers the audit (Card 18)
- [ ] Publish button — disabled tooltip always shows the first unmet reason, in order: caption staged
      → media uploaded → ≥1 platform selected AND connected → agreement checked → audit not running →
      audit has run → audit passed

**Milestone (finished state):** A disconnected platform cannot be added to "Publish to" without first
completing Connect; the Publish button's tooltip text always matches the single blocking reason in the
documented priority order.

**Definition of Done:**
- [ ] `PublishComposer.test.tsx` covers the full block-reason ladder, one case per rung
- [ ] `content-studio.spec.ts` → "Publish Composer" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- PublishComposer
cd e2e && npx playwright test content-studio.spec.ts -g "Publish Composer"
```

---

### CARD — Content Studio: Compliance Audit Panel

**Depends on:** Card 17 (Publish Composer)
**Summary:** The six-step OMCS audit animation and its result display.

**Steps:**
- [ ] Not-run-yet empty state
- [ ] Auditing — 6-step checklist animation (~420ms/step)
- [ ] Complete — OMCS radial gauge (color by score band), pass/fail chip at threshold 70, 3 weighted
      sub-scores as bars with the formula shown verbatim, 7-row rubric table, feedback banner,
      consistency-explanation paragraph, "Re-run" button

**Milestone (finished state):** Ticking the agreement checkbox with a caption + media staged runs the
full 6-step animation and lands on a pass/fail result matching the fixture `MOCK_OMCS` data.

**Definition of Done:**
- [ ] `CompliancePanel.test.tsx` covers all 3 states (empty/auditing/complete) and the pass/fail color
      branch
- [ ] `content-studio.spec.ts` → "Compliance Audit Panel" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- CompliancePanel
cd e2e && npx playwright test content-studio.spec.ts -g "Compliance Audit Panel"
```

---

### CARD — Content Studio: Content Board & Publish Action

**Depends on:** Card 17 (Publish Composer), Card 18 (Compliance Audit Panel)
**Summary:** All/Draft/Published tabs over the post list, and the Publish action that populates the
shared post store Calendar and Performance read from.

**Steps:**
- [ ] `ContentBoard` (new) — All/Draft/Published tabs, cards show platform dot, status chip, date,
      caption excerpt, reach/likes footer if published
- [ ] Publish action — appends one post per selected platform to the shared store (today's date,
      `status: 'published'`), clears composer transient state (`publishPlatforms`, `agreed`, `omcs`)
      while leaving each platform's approved caption intact

**Milestone (finished state):** Publishing to 2 platforms adds 2 new posts to the board immediately,
visible under the "Published" filter without a reload.

**Definition of Done:**
- [ ] `ContentBoard.test.tsx` covers the filter tabs and the publish-appends-N-posts behavior
- [ ] `content-studio.spec.ts` → "Content Board & Publish Action" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- ContentBoard
cd e2e && npx playwright test content-studio.spec.ts -g "Content Board & Publish Action"
```

---

### CARD — Calendar: Month Grid & Navigation

**Depends on:** Card 19 (Content Board & Publish Action — shared post store)
**Summary:** New `CalendarView.tsx` — month grid with per-day post chips. **Does not** reuse or extend
`ceview/old-components/CalendarView.tsx` (legacy, untouched per `.claude/CLAUDE.md`).

**Steps:**
- [ ] `components/module-3/calendar/CalendarView.tsx` — 7-column grid, leading/trailing days greyed
      + inert, today ringed, up to 3 platform-colored chips per day + "+N more"
- [ ] Month navigation (prev/next, wraps Dec↔Jan), per-status counts header

**Milestone (finished state):** `/calendar` shows the current month with today ringed; a post
published from Content Studio (Card 19) appears on today's cell without a reload.

**Definition of Done:**
- [ ] `CalendarView.test.tsx` covers month-boundary cell distribution (leading/trailing/today)
- [ ] `calendar.spec.ts` → "Month Grid & Navigation" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- CalendarView
cd e2e && npx playwright test calendar.spec.ts -g "Month Grid & Navigation"
```

---

### CARD — Calendar: List View & Day-Click Modal

**Depends on:** Card 20 (Month Grid & Navigation)
**Summary:** Flat list view toggle and the day-click detail modal.

**Steps:**
- [ ] List view — flat reverse-chronological list with status chips
- [ ] Day click (only on days with ≥1 post) opens a modal listing that day's posts; published posts
      show reach/likes/engagement inline

**Milestone (finished state):** Clicking a day with zero posts does nothing; clicking a day with posts
opens the modal with correct per-post detail.

**Definition of Done:**
- [ ] `CalendarView.test.tsx` extended: day-click no-op vs. modal-open branches
- [ ] `calendar.spec.ts` → "List View & Day-Click Modal" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- CalendarView
cd e2e && npx playwright test calendar.spec.ts -g "List View & Day-Click Modal"
```

---

### CARD — Settings: Platforms

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** `/settings/platforms` — connect/disconnect the four publishing destinations; gates
Content Studio's publish picker (Card 17).

**Steps:**
- [ ] `components/module-3/settings/PlatformsSettings.tsx` — one row per platform, Verified+Disconnect
      or Connect
- [ ] Connect modal — redirecting spinner → scope-grant list → Grant scope → connected toast
      (`ui-ux-prototype.html:4131–4202`)
- [ ] Disconnect — immediate, toast, **new rule**: also removes that platform from Content Studio's
      in-progress "Publish to" selection if it was selected

**Milestone (finished state):** Connecting a platform here immediately unlocks it in Content Studio's
picker without a reload (shared state, not a re-fetch); disconnecting a selected platform mid-publish
removes it from that selection.

**Definition of Done:**
- [ ] `PlatformsSettings.test.tsx` covers connect/disconnect state propagation and the cross-screen
      selection-removal rule
- [ ] `settings-platforms.spec.ts` → "Platforms" passes
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- PlatformsSettings
cd e2e && npx playwright test settings-platforms.spec.ts
```

---

### CARD — Settings: Workspace

**Depends on:** Foundation — Shell & Routing, Foundation — Fixture Data Layer
**Summary:** `/settings/workspace` — member list + invite-by-email form.

**Steps:**
- [ ] `components/shared/settings/WorkspaceSettings.tsx` — member list (avatar, name, email, role
      chip, "Invite pending" chip), invite form (email + role select, Editor/Viewer only)
- [ ] Submitting appends a pending member row optimistically (`ui-ux-prototype.html:4203–4212`)
- [ ] Flag, don't silently resolve: no invite acceptance/expiry/revocation modeled — real gaps, see
      [`docs/shared/workspace.md`](../../../shared/workspace.md)'s "Behavior" section

**Milestone (finished state):** Sending an invite immediately shows the pending member row with the
derived display name and a confirmation toast.

**Definition of Done:**
- [ ] `WorkspaceSettings.test.tsx` covers the invite-submit → optimistic-row behavior
- [ ] `settings-workspace.spec.ts` → "Workspace" passes
- [ ] Code review approved (including explicit sign-off on the gaps flagged above)

**Verification:**
```
cd ceview && npm run test:unit -- WorkspaceSettings
cd e2e && npx playwright test settings-workspace.spec.ts
```
