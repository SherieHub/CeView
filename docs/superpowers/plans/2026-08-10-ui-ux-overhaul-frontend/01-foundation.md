# Foundation cards

All paths below are relative to `frontend/`, a fresh, greenfield rebuild (see `00-index.md`'s "Target
directory" note) — not `ceview/`. Block every screen card in the other four files. No dependencies on
each other except where noted. See [`00-index.md`](00-index.md) for the card template legend and full
dependency graph.

Because `frontend/` starts empty (unlike `ceview/`, which already had its build tooling in place when
these cards were first written), a **Project Scaffold** card comes first — the other three Foundation
cards all assume `npm install && npm run dev` already works.

---

### CARD — Foundation: Project Scaffold

**Depends on:** —
**Summary:** The bare Vite + React + TS + Tailwind project `frontend/` builds and runs on, before any
Design System, routing, or fixture work begins.
**Prototype reference:** none — this card has no UI counterpart in `ui-ux-prototype.html`; it is pure
build tooling.

**Project files to add/implement:**
- `package.json` — scripts (`dev`/`build`/`preview`/`test`/`test:unit`/`test:integration`) and deps
- `vite.config.ts` — dev server, path alias, Vitest config, Tailwind plugin
- `tsconfig.json` — compiler options
- `index.html` — HTML entry point
- `index.tsx` — JS entry point, mounts `<App/>`
- `.gitignore`
- `vitest.setup.ts` — Vitest global setup (jest-dom matchers)
- `README.md` — orientation note for anyone opening this directory

**Related files:**
- `ceview/package.json`, `ceview/vite.config.ts`, `ceview/tsconfig.json` — version/config baseline to
  match where there's no reason to diverge (React 19.2, Vite 6, TS 5.8, Vitest 4, react-router-dom 7,
  recharts 3, lucide-react); read-only reference, not copied

**Steps (pseudocode):**
1. Create `package.json`:
   - Name it `frontend`.
   - Scripts: `dev` → `vite`; `build` → `vite build`; `preview` → `vite preview`; `test` →
     `vitest run`; `test:unit` → `vitest run` excluding `tests/integration/**`; `test:integration` →
     `vitest run tests/integration`.
   - Runtime deps: `react`, `react-dom`, `react-router-dom`, `recharts`, `lucide-react`.
   - Dev deps: `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss`, `typescript`, `vite`,
     `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@types/react`,
     `@types/react-dom`, `@types/node`.
2. Create `vite.config.ts`:
   - Register the React plugin and the Tailwind plugin.
   - Add a `@` path alias pointing at the project root.
   - Configure Vitest to use the `jsdom` environment and load `vitest.setup.ts`.
3. Create `tsconfig.json` with `strict: true`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, and
   the same `@/*` path mapping as the Vite alias.
4. Create `index.html`:
   - No Tailwind CDN `<script>`, no CDN import map (unlike `ceview/index.html`'s current leftover
     setup — everything is a real npm dependency, bundled by Vite).
   - Font `<link>` tags, a `<div id="root">`, and a module `<script>` pointing at `/index.tsx`.
5. Create `index.tsx`:
   - Import `./styles/index.css` (built by the Design System card).
   - Mount `<App/>` wrapped in `<AuthProvider>` into `#root`.
6. Create `.gitignore` (`node_modules/`) and `vitest.setup.ts` (imports jest-dom's Vitest matchers).
7. Create `README.md` noting `frontend/` is the active app under development and `ceview/` remains
   deployed until cutover.

**Milestone (finished state):** `npm install && npm run dev` serves a blank page with no console
errors; `npm run build` succeeds.

**Definition of Done:**
- [ ] No Vitest suite required for this card (pure scaffolding, no logic)
- [ ] Code review approved

**Verification:**
```
cd frontend && npm install && npm run build && npm run dev
```

---

### CARD — Foundation: Design System

**Depends on:** Project Scaffold
**Summary:** Encode the prototype's design tokens and primitive classes as a Tailwind v4 theme so
every later card can write `class="btn btn-gold btn-lg"` (or the Tailwind-utility equivalent) and get
the prototype's exact look. This diverges from the original CSS-custom-properties approach `ceview/`
used — `frontend/` uses Tailwind (per project decision), not hand-rolled `.css` files.
**Prototype reference:** `:root` tokens + reset/typography (no single screen — shared by all) —
`ui-ux-prototype.html:15–302`

**Project files to add/implement:**
- `styles/index.css` — Tailwind entry point: `@theme` token block, reset, typography helpers, and
  (incrementally, as later cards need them) primitive component classes

**Related files:**
- none yet — this is the first visual card; later cards become the "related files" that read this
  one's tokens/primitives

**Steps (pseudocode):**
1. At the top of `styles/index.css`, add `@import "tailwindcss";`.
2. Add a Tailwind v4 `@theme` block transcribing the prototype's `:root` block
   (`ui-ux-prototype.html:15–67`) 1:1:
   - Brand, surface, ink, line, state, and platform colors → `--color-*`.
   - Radii → `--radius-*`.
   - Shadows → `--shadow-*`.
   - Spacing scale → `--spacing-*`.
   - `--sidebar-w` and `--ease-brand` as bare custom properties (Tailwind v4 has no first-class
     "easing" or "sidebar width" theme namespace, so these stay outside `@theme`).
3. Below the `@theme` block, add the reset + typography helpers as plain CSS
   (`ui-ux-prototype.html:70–110`): `.eyebrow`, `.h-xl`/`.h-lg`/`.h-md`/`.h-sm`, `.body-sm`/
   `.body-xs`, `.num`, `.mono`, `.sr`, focus-visible/selection styles.
4. Leave the primitive component classes (`.btn`/`.card`/form primitives/`.chip`/`.tabs`/`.bar`/
   `.switch`/`.check`/`.skel`/`.toast`/`.modal`/`.drawer`/`.banner`/`.empty`,
   `ui-ux-prototype.html:112–302`) for incremental addition:
   - Each consuming screen card adds the ones it needs, either as `@layer components` classes in
     this file or as Tailwind utility compositions inlined at the call site.
   - Decide per-primitive at implementation time, not up front.
5. Exclude `.cs2-*`, `.prev-*`, `#devbar`/`.devbar-*` entirely — these belong to the dropped v2
   Content Studio / dev-only jump bar, not the product.
6. Wherever `frontend/`'s equivalent of `constants.ts` lands (a later card), decide and document
   `COLORS`'s fate: kept as resolved hex (Recharts `stroke`/`fill` props need hex, not CSS vars), but
   annotated "must match `styles/index.css`'s `@theme` block" and diffed against it in review.

**Milestone (finished state):** A throwaway test page rendering one of every primitive class matches
the prototype pixel-for-pixel at the token level (color, radius, shadow, spacing), and
`npm run build` in `frontend/` succeeds with `styles/index.css` imported.

**Definition of Done:**
- [ ] No Vitest suite required for this card (pure CSS, no logic) — visual review substitutes
- [ ] Code review approved (side-by-side screenshot vs. prototype for at least `.btn`, `.card`,
      `.chip`, `.banner` variants)

**Verification:**
```
cd frontend && npm run build
# manual: open the throwaway primitives page next to ui-ux-prototype.html and compare
```

---

### CARD — Foundation: Shell & Routing

**Depends on:** Design System
**Summary:** Real routes, app shell, and overlay infrastructure via `react-router-dom`, giving every
screen card a place to mount.
**Prototype reference:** `#view-login` + `.app-shell`/`.sidebar`/`.topbar`/`NAV` + overlay stack —
`ui-ux-prototype.html:900–961` (login), `:1565–1613` (overlays), `:1782–1900` (nav/shell)

**Project files to add/implement:**
- `App.tsx` — router tree (`<RouterProvider>`) + top-level providers
- `layout/nav.ts` — the `NAV` table (sections + items) driving both Sidebar and Topbar
- `layout/AppShell.tsx` — sidebar + topbar + `<Outlet/>` wrapper
- `layout/Sidebar.tsx` — nav rendering, active-route highlight, expandable Settings sub-tabs
- `layout/Topbar.tsx` — per-route title/subtitle, burger, inert notification/search buttons
- `layout/RoutePlaceholder.tsx` — empty screen-shell placeholder for not-yet-built routes
- `components/shared/useOverlayStack.tsx` — overlay stack state (push/pop/dismissTop) + provider
- `components/shared/Modal.tsx` — modal overlay, registers itself on the stack
- `components/shared/Drawer.tsx` — side-drawer overlay, registers itself on the stack
- `components/shared/Toast.tsx` — toast notifications + provider
- `components/auth/AuthGate.tsx` — `AuthGate` (redirect unauthenticated → `/login`) and
  `RedirectIfAuthenticated` (keep an authenticated user off `/login`)
- `components/auth/LoginPage.tsx` — split brand/pane layout, Sign in / Create account tabs, stat
  tiles
- `services/auth.tsx` — JWT auth context (`login`/`register`/`logout`/`user`)
- `services/authStorage.ts` — token persistence (localStorage read/write/clear)
- `services/profileContext.tsx` — `ProfileProvider` + `ProfileGate` (onboarding ↔ dashboard redirect)

**Related files:**
- `services/apiClient.ts` (built by the Fixture Data Layer card, running in parallel) —
  `auth.login`/`auth.register` calls `services/auth.tsx` wires up
- `types.ts` (same card) — `AuthUser`, `AuthTokens`, `BusinessProfile` shapes this card's contexts
  consume
- `styles/index.css` (Design System card) — tokens this card's Tailwind classes reference

**Steps (pseudocode):**
1. `layout/nav.ts`: define the `NAV` table as an ordered list of section headers and items —
   Intelligence (Dashboard, with an unread badge), Create (Content Studio, Calendar), Measure
   (Performance), Account (Settings). Exclude the prototype's `content2` entry (superseded v2 draft,
   not built).
2. `components/shared/useOverlayStack.tsx`:
   - Hold a stack (array) of open overlay kinds (`modal`, `drawer`, `sidebar`).
   - `push(kind)` appends if not already present; `pop(kind)` removes it; `dismissTop()` removes only
     the last entry.
   - Expose `scrimVisible` = stack is non-empty.
   - On mount, listen for `Escape` and call `dismissTop()`.
3. `components/shared/Modal.tsx` / `Drawer.tsx`: on `open` becoming true, `push` their kind onto the
   stack; on `open` becoming false or unmount, `pop` it.
4. `components/shared/Toast.tsx`: hold a list of active toast messages; `showToast(message)` appends
   one with a generated id and removes it again after ~2.6s.
5. `services/authStorage.ts`: read/write/clear a JSON-serialized token object under one localStorage
   key.
6. `services/auth.tsx`:
   - On mount, check `authStorage` for a persisted token; if present, treat the session as
     authenticated.
   - `login(email, password)` / `register(email, password)` call `apiClient.auth.*`, persist the
     returned token, and set the current user.
   - `logout()` clears the token and the current user.
7. `components/auth/AuthGate.tsx`:
   - `AuthGate`: if not authenticated, redirect to `/login`; otherwise render the nested route.
   - `RedirectIfAuthenticated`: if authenticated, redirect to `/dashboard`; otherwise render children
     (wraps `LoginPage`).
8. `services/profileContext.tsx`:
   - `ProfileProvider` holds the business profile in state (empty/default shape until onboarding
     completes).
   - `ProfileGate`: if `profile.uniquenessScore` is `null` and the current route isn't `/onboarding`,
     redirect to `/onboarding`; if it's set and the route is `/onboarding`, redirect to `/dashboard`;
     otherwise render the nested route.
9. `layout/Sidebar.tsx`: render `NAV`'s sections and items; highlight the item matching the current
   route; Settings expands inline to show its 3 sub-tabs (all living in the consolidated
   `components/settings/` — see `02-module-1.md` Card 9 and `04-module-3.md` Cards 22–23 for why);
   footer shows the signed-in user's identity + a sign-out action.
10. `layout/Topbar.tsx`: look up the current route in `NAV`, render its title/subtitle; render a
    burger button (mobile sidebar toggle) and inert notification/search buttons.
11. `layout/AppShell.tsx`: render `Sidebar` + `Topbar` side by side with a scrollable `<Outlet/>`
    beneath the topbar.
12. `layout/RoutePlaceholder.tsx`: render a centered "not built yet" message, optionally sourcing its
    title/subtitle from a `NAV` entry.
13. `components/auth/LoginPage.tsx`: split-pane layout — brand panel with stat tiles on one side, a
    Sign in / Create account tab switcher with an email+password form on the other; a Google OAuth
    button rendered but disabled (no provider wired yet).
14. `App.tsx`: build the router tree —
    - `/login` → `RedirectIfAuthenticated(LoginPage)`.
    - Everything else wrapped in `AuthGate` → `ProfileGate`:
      - `/onboarding` → `RoutePlaceholder` (wizard internals are a later card).
      - Everything else wrapped in `AppShell`: `/dashboard`, `/content`, `/calendar`,
        `/performance`, `/settings` (redirects to `/settings/profile`), `/settings/:tab` — all
        `RoutePlaceholder` for now.
    - Wrap the whole tree in `ProfileProvider` → `OverlayStackProvider` → `ToastProvider`.

**Milestone (finished state):** Every route renders an empty screen shell with correct sidebar
highlight and topbar title; opening a test modal and a test drawer follows the stack rules (open
drawer → open modal over it → Esc closes modal only → Esc again closes drawer); login → seeded
credentials → lands on `/dashboard`.

**Definition of Done:**
- [ ] `useOverlayStack.test.ts` covers push/pop/dismissTop ordering
- [ ] Playwright coverage (`login.spec.ts`-equivalent) — deferred, not wired for `frontend/` yet (see
      `00-index.md`'s Testing Strategy). Manual verification (unauthenticated redirect, login
      success) substitutes until that later plan lands.
- [ ] Code review approved

**Verification:**
```
cd frontend && npm run test:unit -- useOverlayStack
# manual: unauthenticated visit to /dashboard redirects to /login; login with a seeded
# account lands on /dashboard
```

---

### CARD — Foundation: Fixture Data Layer

**Depends on:** Project Scaffold
**Summary:** Typed fixture modules + an `apiClient` fixture fallback so every screen card is fully
demoable before its real backend endpoint exists.
**Prototype reference:** `MOCK_*` data + `buildChartData()` (no single screen — shared by all) —
`ui-ux-prototype.html:1093–1481`

**Project files to add/implement:**
- `services/fixtures/markets.ts` — `MOCK_MARKETS`, `buildChartData`, `CATEGORY_MARKET_SCORES`,
  `marketsForCategory`
- `services/fixtures/notifications.ts` — `MOCK_NOTIFICATIONS`
- `services/fixtures/content.ts` — `MOCK_CONTENT`, `ARCHETYPES`
- `services/fixtures/omcs.ts` — `OMCS_RUBRIC_LABELS`, `MOCK_OMCS`
- `services/fixtures/campaign.ts` — `DEFAULT_CAMPAIGN_INPUT`, `MOCK_HISTORY`, `MOCK_REPORT`
- `services/fixtures/posts.ts` — `MOCK_POSTS`
- `services/fixtures/members.ts` — `MOCK_MEMBERS`
- `services/apiClient.ts` — the typed client every screen card calls
- `types.ts` — shared domain types

**Related files:**
- `services/authStorage.ts` (built by the Shell & Routing card, running in parallel) — `apiClient`
  attaches the persisted token as an `Authorization` header on real (non-fixture) requests

**Steps (pseudocode):**
1. For each fixture module (`markets`, `notifications`, `content`, `omcs`, `campaign`, `posts`,
   `members`): transcribe the matching `MOCK_*` constant from `ui-ux-prototype.html` (lines
   1130–1220, 1234–1267, 1272–1391, 1396–1426, 1431–1466, 1468–1475, 1477–1481 respectively) into a
   typed TS module, exporting the constant plus any helper functions defined alongside it
   (`buildChartData`, `marketsForCategory`).
2. `types.ts`: define `AuthUser`, `AuthTokens`, `BusinessProfile` (including the onboarding-only
   fields `slogan`, `industry`, `vibes`, `website`, `logo`, `socials`), `PlatformId`,
   `PlatformConnection`, `WorkspaceMember`, `SocialPost`, `PostMetric`.
3. `services/apiClient.ts`: for every resource (markets, notifications, content, omcs, campaign,
   posts, connections, workspace, auth):
   - Define a method that, if `import.meta.env.VITE_USE_FIXTURES` is `"true"`, returns the matching
     fixture value after a short simulated delay.
   - Otherwise, issue a real `fetch` to the equivalent backend endpoint, attaching the stored auth
     token as a bearer header when present, and throwing on a non-2xx response.

**Milestone (finished state):** With `VITE_USE_FIXTURES=true` and zero backend running, every fixture
module returns data shaped exactly like its prototype source, and `apiClient`'s methods resolve
without a network call.

**Definition of Done:**
- [ ] `apiClient.fixtures.test.ts` asserts each method returns the fixture shape when
      `VITE_USE_FIXTURES=true`
- [ ] No dedicated Playwright spec (this card has no UI) — its correctness is proven transitively by
      every screen spec that depends on it, once `frontend/` is wired into `e2e/`
- [ ] Code review approved

**Verification:**
```
cd frontend && VITE_USE_FIXTURES=true npm run test:unit -- apiClient.fixtures
```
