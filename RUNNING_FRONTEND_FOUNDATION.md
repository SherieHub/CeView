# Running & Testing `frontend/`'s Foundation Cards

Scoped guide for the greenfield rebuild at `frontend/` — specifically the four Foundation cards
from
[`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md`](docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/01-foundation.md)
(Project Scaffold, Design System, Shell & Routing, Fixture Data Layer), including logging in and
signing up **against the real backend**, not fixture mode.

This is a companion to [`RUNNING.md`](RUNNING.md), not a replacement — `RUNNING.md` covers the
full stack + `ceview/` (the current production frontend) in more depth. Use this doc for anything
specific to `frontend/`; fall back to `RUNNING.md` for backend prerequisites, Docker troubleshooting,
and environment variables not repeated here.

> `frontend/` is the target of the ongoing rebuild — `ceview/` stays the deployed app until
> cutover (see `00-index.md`'s "Target directory" note). Don't confuse the two `npm run dev`s:
> `ceview/` serves on **:3000**, `frontend/` serves on **:3001**.

---

## 1. Start the backend

Full stack (Postgres + Spring Boot + both FastAPI services) via Docker Compose — see
[`RUNNING.md` §3](RUNNING.md#3-backend) for prerequisites, first-time `.env` setup, and the stale-volume
troubleshooting flow if you're pulling this after a migration change.

```powershell
cd backend
copy .env.example .env       # first time only — then fill in GROQ_API_KEY (required)
docker-compose up --build
```

Wait for `Started CeViewApplication` and the FastAPI worker lines, then confirm health:

```powershell
curl http://localhost:8080/actuator/health    # {"status":"UP"}
curl http://localhost:8000/healthz            # {"status":"ok"}
curl http://localhost:8001/healthz            # {"status":"ok"}
```

Native/H2 Path B (no Docker) also works — follow [`RUNNING.md` §3 Path B](RUNNING.md#path-b-native-no-docker)
verbatim, but pass `frontend/`'s port in the CORS flag instead of `ceview/`'s:

```powershell
--ceview.cors.allowed-origins=http://localhost:3001
```

(As of this doc, the backend's default `CORS_ALLOWED_ORIGINS` already includes `:3001` alongside
`:3000`/`:5173`, so Path A and an unflagged Path B both work with `frontend/` out of the box —
the explicit flag above is only needed if you're overriding the origin list for another reason.)

---

## 2. Start the frontend

```powershell
cd frontend
npm install       # first time only
npm run dev
```

Vite reports `http://localhost:3001/`. By default `frontend/` talks to the backend at
`http://localhost:8080` (`VITE_API_BASE_URL` overrides this).

**Fixture mode vs. real backend:** `VITE_USE_FIXTURES=true npm run dev` runs entirely off the
fixture data layer with zero backend calls — useful for UI-only work, but it will **not** exercise
real login/signup. For this doc's manual smoke test (§5), run plain `npm run dev`
(`VITE_USE_FIXTURES` unset or `false`) with the backend from §1 already up.

---

## 3. Automated tests

```powershell
cd frontend
npm run build                                              # production build succeeds
npm run test:unit -- useOverlayStack                       # overlay push/pop/dismissTop ordering
$env:VITE_USE_FIXTURES="true"; npm run test:unit -- apiClient.fixtures   # fixture-shape coverage
npm run test:unit                                          # full unit suite
```

Playwright/e2e coverage for `frontend/` is **deferred** — `e2e/` still targets `ceview/` only (see
`00-index.md`'s Testing Strategy). The manual steps below substitute until that later plan lands.

---

## 4. Manual Foundation milestones

With `npm run dev` running (fixtures or real backend, doesn't matter for these):

- Every route (`/dashboard`, `/content`, `/calendar`, `/performance`, `/settings/:tab`) renders an
  empty screen shell (`RoutePlaceholder`) with the correct sidebar highlight and topbar title —
  these screens aren't built yet beyond Foundation, so a placeholder is the expected/correct state.
- Overlay stack ordering: open a drawer, then a modal over it. **Esc** closes the modal only;
  **Esc** again closes the drawer. (Covered by `useOverlayStack.test.ts` in §3, but worth eyeballing
  once visually.)
- Visiting `/dashboard` while logged out redirects to `/login` (`AuthGate`).

---

## 5. Manual login/signup smoke test (real backend)

With the backend from §1 running and `frontend/` on plain `npm run dev` (no `VITE_USE_FIXTURES`):

1. Open **http://localhost:3001** — lands on the Sign In page.
2. **Sign up**: use the *Create account* tab — it asks for first name, last name, email, and
   password (the backend's `RegisterRequest` requires `firstName`/`lastName`, not just
   email/password). Submitting calls `POST /api/v1/auth/register` and logs you straight in —
   expect an **empty** business profile (registration doesn't create Module 1–4 data), which is
   correct, not a bug.
3. Sign out, then **log in** with one of the 9 seeded demo accounts from
   [`SEED_CREDENTIALS.md`](backend/spring-boot/src/main/resources/db/migration/SEED_CREDENTIALS.md), e.g.:

   | Email | Password |
   |---|---|
   | `ramon.delacruz@ceview.local` | `MoalboalDive2024!` |

   Confirm you're redirected away from `/login`. You'll land on `/onboarding`, not `/dashboard`
   — `ProfileGate` starts every session from an empty in-memory profile and only lets you into
   `/dashboard` once `uniquenessScore` is set, and fetching the real business profile from the
   backend isn't wired yet (a later card, out of Foundation's scope). Landing on `/onboarding`
   after a successful login is the correct current behavior, not a bug.
4. **Negative case** — log out and try logging in with a wrong password. You should see a real
   error, not a silent "success." (Earlier revisions of `frontend/`'s `apiClient.ts` had a bug
   where *any* failed request — including a rejected login — silently fell back to a fake token;
   that fallback is now scoped to genuine network failures only, so a `401` from the backend
   should surface as an actual error in the UI.)
5. Open DevTools → Network, filter by `localhost:8080`, and confirm the login/register requests
   hit `/api/v1/auth/login` / `/api/v1/auth/register` and return `200` with `Authorization: Bearer
   <token>` attached to subsequent calls.

### Direct API check, no frontend involved

```powershell
$login = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/v1/auth/login `
    -ContentType 'application/json' `
    -Body '{"email":"ramon.delacruz@ceview.local","password":"MoalboalDive2024!"}'
$login.token   # non-empty JWT confirms the backend side independent of the frontend
```

---

## 6. Known limitations

- **No `/me` endpoint yet.** The backend's login/register responses only carry `{token,
  operatorId}` — no email/business name. `frontend/`'s `AuthProvider` fills in `email` from what
  you typed and leaves `businessName: null` until a profile-fetch endpoint exists; this is expected,
  documented in `services/auth.tsx`'s mount comment.
- **e2e/Playwright wiring for `frontend/` is deferred** — see `00-index.md`'s Testing Strategy.
  Manual verification (this doc) substitutes until that plan lands.
- **Module 1–4 screens beyond Foundation are stubs** (`RoutePlaceholder`) — only the shell,
  routing, auth, and overlay infrastructure are real; per-screen cards land later per the plan's
  dependency graph.

---

## 7. Troubleshooting

See [`RUNNING.md` §10](RUNNING.md#10-troubleshooting) for backend-side issues (stale Postgres
volume, missing `GROQ_API_KEY`, port conflicts, etc.) — all of it applies unchanged to this setup.
`frontend/`-specific additions:

| Symptom | Fix |
|---|---|
| Browser shows `Failed to fetch` / login silently succeeds with a fake-looking session even though you typed a wrong password | Check DevTools → Network for the actual `/api/v1/auth/login` response. A genuine `401` should now surface as a UI error, not a silent login — if it doesn't, `frontend/services/apiClient.ts`'s network-failure detection may need revisiting. |
| CORS error in the browser console pointing at `localhost:3001` | Confirm `CORS_ALLOWED_ORIGINS` (Docker) or `--ceview.cors.allowed-origins` (native) includes `http://localhost:3001` — see §1. |
| `frontend/` and `ceview/` dev servers both running and you're not sure which tab is which | `ceview/` is `:3000`, `frontend/` is `:3001`. |
