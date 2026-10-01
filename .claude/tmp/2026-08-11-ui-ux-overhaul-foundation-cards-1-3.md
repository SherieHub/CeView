## Summary

Implements the Foundation layer of the UI/UX overhaul plan (`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md`) — the three infrastructure cards every later screen card (24 more, across Onboarding, Dashboard, Content Studio, Calendar, Settings, Performance) builds on top of. Source of truth for all ported markup/data is `ui-ux-prototype.html` at the repo root.

- **Card 1 — Design System**: real stylesheets replacing ad hoc inline styling, matching the prototype's CSS custom properties and primitive classes exactly.
- **Card 2 — Shell & Routing**: `react-router-dom`-based real routes, an app shell (sidebar/topbar/outlet), and an overlay-stack system (drawer/modal/toast), replacing `App.tsx`'s `activeTab` state switch.
- **Card 3 — Fixture Data Layer**: typed fixture data + `apiClient` fixture fallbacks so every future screen card is demoable against `VITE_USE_FIXTURES=true` before its real backend endpoint exists.

No backend, database, or Python service code was touched — this is a `ceview/` (React/TS) + `e2e/` (Playwright) only change.

---

## Card 1 — Design System

**Files created:**
- `ceview/styles/tokens.css` — CSS custom properties (`:root` block): brand/surface/ink/line/state/platform colors, radii (`--r-*`), shadows (`--sh-*`), spacing (`--sp-*`), `--sidebar-w`, `--ease`. Ported verbatim from `ui-ux-prototype.html:15–67`.
- `ceview/styles/base.css` — reset + typography helpers (lines 70–110).
- `ceview/styles/primitives.css` — `.btn`, `.card`, form primitives, `.chip`, `.tabs`/`.seg`, `.bar`, `.switch`, `.check`, `.skel`, `.toast`, `.modal`, `.drawer`, `.banner`, `.empty` (lines 112–302, plus `.banner`/`.empty` from their true location at lines 491–504 — see Judgment Calls).
- `ceview/styles/shell.css` — `.app-shell`, `.sidebar`/`.sb-*`, `.topbar`, `.content`, `.wrap`, `.screen` (lines 423–486, plus `.screen`/`.screen.on` from their true location at lines 309–310 — see Judgment Calls).
- `ceview/styles/responsive.css` — desktop media-query deltas (lines 868–899).
- `ceview/styles/__preview.html` — throwaway, unrouted preview page rendering one instance of every primitive class, for side-by-side visual diffing against the prototype. Not imported by any app code.

**Files modified:**
- `ceview/constants.ts` — added a documentation comment above `COLORS` mapping each key to its `tokens.css` custom property (values unchanged; Recharts `stroke`/`fill` props still need resolved hex, so `COLORS` stays as-is).

**Excluded per plan:** `.cs2-*`, `.prev-*`, `#devbar`/`.devbar-*` (dropped v2 Content Studio draft / dev-only jump bar — not part of the product).

---

## Card 2 — Shell & Routing

**Files created:**
- `ceview/layout/AppShell.tsx` — sidebar + topbar + `<Outlet/>`, wraps `OverlayStackProvider`/`ToastProvider`, renders `#scrim`.
- `ceview/layout/Topbar.tsx` — per-route title/subtitle from `nav.ts`, burger button, inert search/notification buttons.
- `ceview/layout/nav.ts` — the `NAV` table ported from `ui-ux-prototype.html:1792–1803` (sections: Intelligence/Create/Measure/Account; `content2` excluded — dropped v2 draft), plus `resolveNavForPath` shared by Sidebar/Topbar/route elements.
- `ceview/layout/RoutePlaceholder.tsx` — the empty-screen-shell element every route renders for now (real screen content is later cards); also hosts a "Foundation check" panel wiring real Drawer/Modal/Toast instances so the overlay stack has something to exercise pre-merge.
- `ceview/components/shared/useOverlayStack.tsx` (+ `.test.ts`), `Modal.tsx`, `Drawer.tsx`, `Toast.tsx` — overlay-stack semantics ported from `ui-ux-prototype.html:1565–1613` (push/pop by kind, `dismissTop` on Escape closes only the top, scrim visible whenever the stack is non-empty) as a React hook + context, not a literal DOM-string port.
- `ceview/services/profileContext.tsx` — `ProfileProvider`/`useProfile`/`ProfileGate`, replacing the old prop-drilled profile `useState` block; fetches `api.loadProfile()` and redirects `/onboarding ↔ /dashboard` based on `uniquenessScore`.

**Files modified:**
- `ceview/App.tsx` — removed `activeTab`, the `old-components/CalendarView` import, and the profile `useState`/`ProfileSetters` runtime block (kept as type-only re-exports since `BusinessProfile.tsx`/`UniquenessCalibrationView.tsx` still import those two type names). Added `react-router-dom`'s `createBrowserRouter`/`RouterProvider` with routes `/login`, `/onboarding`, `/dashboard`, `/content`, `/calendar`, `/performance`, `/settings/:tab` (`/settings` → `/settings/profile`, `/` → `/dashboard`, catch-all `*` → `/dashboard`) behind `AuthGate` → `ProfileGate` → `AppShell`.
- `ceview/index.tsx` — imports Card 1's five stylesheets (tokens → base → primitives → shell → responsive) plus a new `styles/login.css` (see Judgment Calls).
- `ceview/layout/Sidebar.tsx` — full rewrite: sectioned NAV from `nav.ts`, Dashboard unread badge, expandable Settings with 3 sub-tabs, footer identity block (business name + operator id + sign out).
- `ceview/components/auth/AuthGate.tsx` — rewritten from a login/register mode toggle into a route guard (redirects unauthenticated visits to `/login` with `state={{from: location}}`); also added `RedirectIfAuthenticated` (redirects an already-authenticated visit to `/login` → `/dashboard`).
- `ceview/components/auth/LoginPage.tsx` — full rewrite: split brand/pane layout, Sign in / Create account tabs (only the active tab's form is mounted), inert Google OAuth button, stat tiles, OR-divider — ported from `ui-ux-prototype.html:900–959`. `RegisterPage.tsx` is now unused (left untouched).
- `ceview/components/auth/LoginPage.test.tsx` — updated for the new markup; added a regression test for post-login navigation.
- `e2e/tests/login.spec.ts` — the 2 pre-existing smoke tests updated for the new sidebar/router (see Review Findings); the 3 `test.fixme()` placeholders for router/overlay-stack coverage un-skipped and filled in for real.
- `ceview/package.json` / `package-lock.json` — added `react-router-dom` v7.

**Deliberately NOT wired in this card** (per the plan's "empty screen shell" milestone — real screens are later cards): `HomeView`, `MarketRadarView`, `ContentStudioView`, `CampaignAnalyticsView`, `BusinessProfile`, `UniquenessCalibrationView` are untouched and not mounted on any new route.

---

## Card 3 — Fixture Data Layer

**Files created:**
- `ceview/services/fixtures/markets.ts` — `buildChartData`, `MOCK_MARKETS`, `CATEGORY_MARKET_SCORES`, `marketsForCategory` (prototype lines 1093–1220, `buildChartData` found above the plan's cited start line — see Judgment Calls).
- `ceview/services/fixtures/notifications.ts` — `MOCK_NOTIFICATIONS` (lines 1234–1267).
- `ceview/services/fixtures/content.ts` — `ARCHETYPES`, `MOCK_CONTENT` (lines 1093, 1272–1391).
- `ceview/services/fixtures/omcs.ts` — `OMCS_RUBRIC_LABELS`, `MOCK_OMCS` (lines 1396–1426).
- `ceview/services/fixtures/campaign.ts` — `DEFAULT_CAMPAIGN_INPUT`, `MOCK_HISTORY`, `MOCK_REPORT` (lines 1431–1466).
- `ceview/services/fixtures/posts.ts` — `MOCK_POSTS` (lines 1468–1475).
- `ceview/services/fixtures/members.ts` — `MOCK_MEMBERS` (lines 1477–1481).
- `ceview/tests/integration/apiClient.fixtures.test.ts` — asserts each new fixture-backed `apiClient` method returns the correct fixture shape (deep equality / `toMatchObject`) and never calls `fetch` when `VITE_USE_FIXTURES=true`; self-skips cleanly when the flag is unset.

**Files modified:**
- `ceview/types.ts` — additive only: `Market`/`Notification` gained several optional fields to match the prototype's fixture shape; `Airline.duration`/`.tier` made optional; `ResponseSource` widened to include `'groq'`; new types `SocialPost`, `PlatformConnection`, `WorkspaceMember`, `PostMetric`, `SocialPlatformId`.
- `ceview/services/apiClient.ts` — `BusinessProfileDTO` gained optional onboarding fields (`slogan`, `industry`, `vibes`, `website`, `logo`, `socials`). New `useFixtures()`/`delay()` helpers. 7 new methods (`listPosts`, `createPost`, `listPlatformConnections`, `connectPlatform`, `disconnectPlatform`, `listWorkspaceMembers`, `getPostMetrics`), each branching on `VITE_USE_FIXTURES==='true'` to return fixture data via a simulated delay, otherwise falling through to the existing `req<T>()` pattern against inferred `/api/v1/...` paths (no real backend exists for these yet).

---

## Review Findings & Fixes

Every card went through spec-compliance review, then code-quality review, each with fix/re-review loops until clean. Issues actually found and fixed:

1. **(Card 1, spec review) Plan line-range inaccuracies** — the plan's per-file bullets cited `.banner`/`.empty` and `.screen` as living inside `primitives.css`'s/`shell.css`'s stated line ranges; they're actually at prototype lines 491–504 and 309–310 respectively. Resolved by porting from their true locations with explanatory inline comments — reviewer confirmed this was the correct call, not a plan-clarification blocker.

2. **(Card 2, spec review) Stale Playwright selector** — `e2e/tests/login.spec.ts` asserted `page.getByRole('heading', {name: /CeView/i})` post-login, carried over unchanged from the pre-rewrite markup. The new `Sidebar`/`LoginPage` render "CeView" as a `<b>`, not a heading — zero heading-role elements matching that text exist post-auth. **Fixed**: replaced with `.topbar-title b` → "Dashboard" (verified empirically against a live dev server).

3. **(Card 2, code-quality review) Critical: successful login never navigated into the app** — `/login` had no auth-aware redirect and no `useNavigate()` call anywhere in the login flow; flipping `isAuthenticated` doesn't change the URL, so a logged-in user stayed stuck on `/login` until a manual refresh. Also left `AuthGate`'s `state={{from: location}}` as dead code. **Fixed**: `SignInForm`/`CreateAccountForm` now `navigate()` on success (to `location.state.from` or `/dashboard`); added `RedirectIfAuthenticated` for the reverse case. Verified via a new RTL regression test plus empirical dev-server verification.

4. **(Card 2, code-quality review) Important: profile-fetch race condition** — `ProfileProvider.load()` had no request-ordering guard; a stale in-flight `api.loadProfile()` response could resolve after logout and silently resurrect a previous operator's profile data (multi-tenant isolation risk, per this repo's CLAUDE.md). **Fixed**: added a `requestToken` ref-based ordering guard discarding any response that's been superseded. Verified with a new integration test that reproduces the exact race deterministically (confirmed red without the fix, green with it).

No other issues were found across any of the three cards' spec-compliance or code-quality passes, nor in the final cross-card integration review.

---

## Judgment Calls & Open Questions

- **Card 1**: `.banner`/`.empty` and `.screen` ported from their true prototype locations rather than the plan's stated (inaccurate) line ranges — see Review Findings #1.
- **Card 2**: Added `ceview/styles/login.css` for login-page-specific classes (`login-brand`, `oauth-btn`, `or-rule`, etc.) that Card 1's stylesheets didn't cover — confirmed via grep these classes exist nowhere in `primitives.css`/`shell.css`, so this fills a genuine gap rather than duplicating.
- **Card 2**: `layout/nav.ts` and `layout/RoutePlaceholder.tsx` aren't named explicitly in the plan's file list but were needed so Sidebar/Topbar/route elements share one NAV source of truth, per the plan's own prose.
- **Card 2**: Settings sub-tab ids (`profile`/`platforms`/`workspace`) are placeholder — the plan doesn't name them; the real Settings screens (later cards) may refine.
- **Card 2**: Kept `ProfileData`/`ProfileSetters` as type-only exports from `App.tsx` (no runtime state behind them) so `BusinessProfile.tsx`/`UniquenessCalibrationView.tsx` — untouched per scope — keep compiling.
- **Card 2**: `RoutePlaceholder.tsx`'s "Foundation check" overlay-stack test panel is currently wired unconditionally into the real `/dashboard` route. It's commented as safe to remove once that screen ships real content, but nothing enforces its removal — **flagging for whoever builds the real Dashboard card** to either delete it or explicitly account for it.
- **Card 3**: `ARCHETYPES` and `buildChartData` were found above the plan's cited line range (prototype lines 1093/1104, vs. the plan's cited start of 1130) — ported into `content.ts`/`markets.ts` respectively since `MOCK_MARKETS`/`MOCK_CONTENT` depend on them inline.
- **Card 3**: `PlatformConnection` (`{platform, connected, accountLabel?}`) and `PostMetric` (`{date, reach, likes, comments, shares}` time-series point) aren't sourced from a named `MOCK_*` prototype constant — both are inferred minimal shapes for later cards (Settings — Platforms, Performance — Post Analytics Modal) to build on. Worth a sanity check from whoever picks up those cards.
- **Card 3**: New `apiClient` methods' REST paths/verbs (`GET /api/v1/posts`, `POST /api/v1/platform-connections/{platform}/connect`, etc.) are inferred/plausible, not backed by an actual contract — `backend/CONTRACT.md` doesn't cover these yet.
- **Card 3**: `apiClient.fixtures.test.ts` lives in `ceview/tests/integration/` (matching where the existing `apiClient.test.ts` already lives) rather than under `components/`, since `npm run test:unit` is scoped to `--dir components` only. Verify via `VITE_USE_FIXTURES=true npm run test:integration`, not the plan's literal `npm run test:unit -- apiClient.fixtures` (a plan/repo-convention mismatch, not a deviation from intent).
- **Open forward-looking note** (not a defect): `Market`'s type now carries 9+ optional fields layered onto its required set — still coherent today, but flagged during code-quality review as the interface most likely to drift toward an "everything optional" shape as more Market Radar cards land. Worth keeping an eye on, not an immediate action.

---

## Test / Verification Evidence

Run from `ceview/` unless noted:

```bash
npm run build                                    # ✓ succeeds
npm run test:unit                                # ✓ 3 files / 14 tests passed
VITE_USE_FIXTURES=true npm run test:integration   # ✓ 3 files / 16 tests passed
npx tsc --noEmit                                  # only pre-existing, unrelated errors (ImportMeta.env
                                                   #   typing gap repo-wide, old-components/, module-3/4
                                                   #   Recharts typing) — zero new errors from this diff
```

Playwright (`e2e/tests/login.spec.ts`): the unauthenticated-redirect test was run against a live dev server (no backend required) and passes. The login-success test and the 3 new router/overlay-stack tests require the full docker-compose stack (Spring Boot + Postgres + FastAPI), which wasn't available in the sandbox this work was built in — these were verified by direct DOM/selector inspection against the real shipped markup instead (confirmed the exact selectors used — `.topbar-title b`, `#scrim`, `.drawer.on`/`.modal.on`, `data-testid="test-open-drawer"`, etc. — genuinely exist and behave as asserted), but **should be run for real against the full stack before merge**, per `RUNNING.md` / the CI e2e workflow.

Every card was independently verified by a separate reviewer subagent re-running the same commands from a fresh read of the code (not trusting the implementer's self-report), plus a final cross-card integration pass confirming the combined tree builds and tests together, with no seam conflicts between the three cards.

All work is currently **uncommitted** in the working tree on `task_foundation` — no commits were made during this workflow, per repo policy.
