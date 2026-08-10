# Foundation cards

Block every screen card in the other four files. No dependencies on each other except where noted.
See [`00-index.md`](00-index.md) for the card template legend and full dependency graph.

---

### CARD — Foundation: Design System

**Depends on:** —
**Summary:** Port the prototype's CSS custom properties and primitive classes into real stylesheets so
every later card can write `class="btn btn-gold btn-lg"` and get the prototype's exact look.

**Steps:**
- [ ] `ceview/styles/tokens.css` — the prototype's `:root` block, `ui-ux-prototype.html:15–67`,
      verbatim (brand, surfaces, ink, lines, state, platform colors, `--r-*`, `--sh-*`, `--sp-*`,
      `--sidebar-w`, `--ease`)
- [ ] `ceview/styles/base.css` — reset + typography helpers, lines 70–110
- [ ] `ceview/styles/primitives.css` — `.btn`/`.card`/form primitives/`.chip`/`.tabs`/`.bar`/
      `.switch`/`.check`/`.skel`/`.toast`/`.modal`/`.drawer`/`.banner`/`.empty`, lines 112–302
- [ ] `ceview/styles/shell.css` — `.app-shell`/`.sidebar`/`.sb-*`/`.topbar`/`.content`/`.wrap`/
      `.screen`, lines 423–507
- [ ] `ceview/styles/responsive.css` — desktop deltas, lines 868–899
- [ ] Decide + document `COLORS` (in `ceview/constants.ts`) fate: kept as hex (Recharts `stroke`/
      `fill` props need resolved hex) but annotated as "must match `tokens.css`", diffed in review
- [ ] Exclude `.cs2-*`, `.prev-*`, `#devbar`/`.devbar-*` — belong to the dropped v2 Content Studio /
      dev-only jump bar, not part of the product

**Milestone (finished state):** A throwaway test page rendering one of every primitive class matches
the prototype pixel-for-pixel at the token level (color, radius, shadow, spacing), and
`npm run build` in `ceview/` succeeds with the new stylesheets imported.

**Definition of Done:**
- [ ] No Vitest suite required for this card (pure CSS, no logic) — visual review substitutes
- [ ] Code review approved (side-by-side screenshot vs. prototype for at least `.btn`, `.card`,
      `.chip`, `.banner` variants)

**Verification:**
```
cd ceview && npm run build
# manual: open the throwaway primitives page next to ui-ux-prototype.html and compare
```

---

### CARD — Foundation: Shell & Routing

**Depends on:** Design System
**Summary:** Real routes, app shell, and overlay infrastructure — replaces `App.tsx`'s `activeTab`
state switch with `react-router-dom` and gives every screen card a place to mount.

**Steps:**
- [ ] Add `react-router-dom`; routes: `/login`, `/onboarding`, `/dashboard`, `/content`, `/calendar`,
      `/performance`, `/settings/:tab`
- [ ] `AuthGate` guards app routes; a profile-completeness guard redirects `/onboarding` →
      `/dashboard` once `profile.uniquenessScore != null`, and the reverse while it's `null`
- [ ] `layout/AppShell.tsx` — sidebar + topbar + `<Outlet/>`
- [ ] `layout/Sidebar.tsx` (rewrite) — `NAV` table (`ui-ux-prototype.html:1792–1803`): sections
      Intelligence/Create/Measure/Account; Dashboard unread badge; Settings expandable with its 3
      sub-tabs; footer identity block
- [ ] `layout/Topbar.tsx` — per-route title/subtitle from the same `NAV` table, burger, inert
      notification/search buttons
- [ ] `shared/Drawer.tsx`, `shared/Modal.tsx`, `shared/Toast.tsx`, `shared/useOverlayStack.ts` — port
      the prototype's stack semantics (lines 1565–1613): push/pop, `dismissTop` closes only the top
      overlay, scrim visible whenever the stack is non-empty
- [ ] `App.tsx` — remove `activeTab`, the `old-components/CalendarView` import, the profile
      `useState`/`ProfileSetters` prop-drilling block; add `<RouterProvider>` + new
      `services/profileContext.tsx`
- [ ] `components/auth/LoginPage.tsx` (rewrite) — split brand/pane layout, Sign in / Create account
      tabs, Google OAuth button, stat tiles (lines 900–959)

**Milestone (finished state):** Every route renders an empty screen shell with correct sidebar
highlight and topbar title; opening a test modal and a test drawer follows the stack rules (open
drawer → open modal over it → Esc closes modal only → Esc again closes drawer); login → seeded
credentials → lands on `/dashboard`.

**Definition of Done:**
- [ ] `useOverlayStack.test.ts` covers push/pop/dismissTop ordering
- [ ] `login.spec.ts` → both existing smoke assertions (unauthenticated redirect, login success) pass
      under the new router
- [ ] Code review approved

**Verification:**
```
cd ceview && npm run test:unit -- useOverlayStack
cd e2e && npx playwright test login.spec.ts
```

---

### CARD — Foundation: Fixture Data Layer

**Depends on:** —
**Summary:** Typed fixture modules + an `apiClient` fixture fallback so every screen card is fully
demoable before its real backend endpoint exists.

**Steps:**
- [ ] `ceview/services/fixtures/markets.ts` — `MOCK_MARKETS`, `buildChartData`,
      `CATEGORY_MARKET_SCORES`, `marketsForCategory` (prototype lines 1130–1220)
- [ ] `ceview/services/fixtures/notifications.ts` — `MOCK_NOTIFICATIONS` (lines 1234–1267)
- [ ] `ceview/services/fixtures/content.ts` — `MOCK_CONTENT` (lines 1272–1391)
- [ ] `ceview/services/fixtures/omcs.ts` — `OMCS_RUBRIC_LABELS`, `MOCK_OMCS` (lines 1396–1426)
- [ ] `ceview/services/fixtures/campaign.ts` — `DEFAULT_CAMPAIGN_INPUT`, `MOCK_HISTORY`, `MOCK_REPORT`
      (lines 1431–1466)
- [ ] `ceview/services/fixtures/posts.ts` — `MOCK_POSTS` (lines 1468–1475)
- [ ] `ceview/services/fixtures/members.ts` — `MOCK_MEMBERS` (lines 1477–1481)
- [ ] `apiClient` — new methods for posts/connections/workspace/post-metrics check
      `import.meta.env.VITE_USE_FIXTURES` and return the matching fixture (simulated delay) instead
      of `fetch`
- [ ] `types.ts` — `SocialPost`, `PlatformConnection`, `WorkspaceMember`, `PostMetric`, plus the
      onboarding profile fields (`slogan`, `industry`, `vibes`, `website`, `logo`, `socials`)

**Milestone (finished state):** With `VITE_USE_FIXTURES=true` and zero backend running, every fixture
module returns data shaped exactly like its prototype source, and `apiClient`'s new methods resolve
without a network call.

**Definition of Done:**
- [ ] `apiClient.fixtures.test.ts` asserts each new method returns the fixture shape when
      `VITE_USE_FIXTURES=true`
- [ ] No dedicated Playwright spec (this card has no UI) — its correctness is proven transitively by
      every screen spec that depends on it
- [ ] Code review approved

**Verification:**
```
cd ceview && VITE_USE_FIXTURES=true npm run test:unit -- apiClient.fixtures
```
