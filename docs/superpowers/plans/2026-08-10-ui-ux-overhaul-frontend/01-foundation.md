# Foundation cards

All paths below are relative to `frontend/`, a fresh, greenfield rebuild (see `00-index.md`'s "Target
directory" note) — not `ceview/`. Block every screen card in the other four files. No dependencies on
each other except where noted. See [`00-index.md`](00-index.md) for the card template legend and full
dependency graph.

**Component diagram:** [`diagrams/foundation.mmd`](diagrams/foundation.mmd)

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

**Flow:** [`diagrams/cards/foundation/project-scaffold.mmd`](diagrams/cards/foundation/project-scaffold.mmd)

**Steps (pseudocode):** [`pseudocode/foundation/project-scaffold.ts`](pseudocode/foundation/project-scaffold.ts)

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

**Flow:** [`diagrams/cards/foundation/design-system.mmd`](diagrams/cards/foundation/design-system.mmd)

**Steps (pseudocode):** [`pseudocode/foundation/design-system.ts`](pseudocode/foundation/design-system.ts)

Wherever `frontend/`'s equivalent of `constants.ts` lands (a later card), decide and document
`COLORS`'s fate: kept as resolved hex (Recharts `stroke`/`fill` props need hex, not CSS vars), but
annotated `// must match styles/index.css's @theme block` and diffed against it in review.

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

**Flow:** [`diagrams/cards/foundation/shell-and-routing.mmd`](diagrams/cards/foundation/shell-and-routing.mmd)

**Steps (pseudocode):** [`pseudocode/foundation/shell-and-routing.ts`](pseudocode/foundation/shell-and-routing.ts)

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

**Flow:** [`diagrams/cards/foundation/fixture-data-layer.mmd`](diagrams/cards/foundation/fixture-data-layer.mmd)

**Steps (pseudocode):** [`pseudocode/foundation/fixture-data-layer.ts`](pseudocode/foundation/fixture-data-layer.ts)

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
