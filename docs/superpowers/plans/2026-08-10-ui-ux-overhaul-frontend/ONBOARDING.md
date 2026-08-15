# Frontend Overhaul — Team Onboarding

Five-minute orientation for anyone picking up a card in this plan. Read this once, then work card
by card out of `01-foundation.md` … `05-module-4.md`.

## 1. Which directory am I working in?

**`frontend/`** — always. It's a from-scratch rebuild (Tailwind, `react-router-dom`), currently
scaffolded but early.

- **`ceview/`** is the old implementation. It's what's actually deployed (`render.yaml`) until
  `frontend/` is ready to cut over. It's reference-only for this plan — don't port code from it,
  don't fix bugs in it as part of overhaul work, don't add overhaul screens there.
- **`ui-ux-prototype.html`** (repo root, single file, ~4,471 lines, vanilla JS) is the **source of
  truth** for design tokens and screen behavior — both `ceview/` and `frontend/` were/are built by
  reading this file, not each other. When a doc says "port screen X," it means port from here.

## 2. Get `frontend/` running

```
cd frontend
npm install
npm run dev              # http://localhost:3001
npm run test:unit
```

Set `VITE_USE_FIXTURES=true` to run against the fixture data layer (`services/fixtures/`) — no
backend required. This is how you'll work for most cards; the fixture layer is Foundation Card 3.

## 3. Find your task

1. Open **[`00-index.md`](00-index.md)** — the dependency graph table lists every card, which file
   it lives in, and what it depends on. Don't start a card whose dependency isn't merged yet.
2. Open the module file that owns your card: **[`01-foundation.md`](01-foundation.md)**,
   **[`02-module-1.md`](02-module-1.md)**, **[`03-module-2.md`](03-module-2.md)**,
   **[`04-module-3.md`](04-module-3.md)**, **[`05-module-4.md`](05-module-4.md)**.
3. Each card is a self-contained, copy-paste-ready ticket (title, dependencies, files to
   add/implement, related files, flow diagram, pseudocode, milestone, Definition of Done,
   verification command). One card = one ticket, whatever the team's tracker is.

## 4. What a card gives you, and where to go for more

| Card field | What it is | Go here for depth |
|---|---|---|
| **Prototype reference** | screen id + render fn + line range, e.g. `screen-dashboard` / `renderDashboard()` / `ui-ux-prototype.html:1200–1340` | Open that exact line range in the prototype — it's the ground-truth markup/behavior to port |
| **Project files to add/implement** | every new file the card creates, one-line purpose each | — |
| **Related files** | existing files this card reads/imports/must match | — |
| **Flow** | link to `diagrams/cards/<module>/<slug>.mmd` | Mermaid flowchart of this card's own control-flow (states, branches, gates) |
| **Steps (pseudocode)** | link to `pseudocode/<module>/<slug>.ts` | typed outline — real import paths/type names, `on X → Y` bullets, no runnable bodies |
| **Definition of Done** | test files + review checkbox | run the listed `npm run test:unit -- <pattern>` before calling it done |

For full behavioral detail beyond what the card states inline (state shape, every API call, every
empty/loading/error state), each card links out to its `docs/module-N/screens/*.md` doc — cards stay
short on purpose and don't re-derive what's already written there. Cross-module screens (not owned
by one module) live in `docs/shared/` instead.

For subsystem logic a card touches (scoring formulas, forecasting, compliance rules), check the
matching module's `README.md` + `MODULEN_SYSTEM_DOCUMENTATION.md` under `docs/module-N/` — don't
reverse-engineer these from code.

For the real API shape a card wires up, check `backend/CONTRACT.md`. If a card's calls aren't in the
contract yet, that's a known/flagged backend gap — build against the fixture layer, don't invent a
shape.

## 5. Decisions already made (don't relitigate per-card)

Carried from `00-index.md` — read there for the full list, highlights:

- Content Studio v1 is canonical; the prototype's `screen-content2`/`renderContent2()` draft is
  superseded and not built.
- Publish gating disables platforms not connected in Settings → Platforms, with an inline Connect
  action.
- New surfaces (Calendar, Platforms, Workspace, post analytics, publishing) are built now against a
  typed `apiClient` + fixture layer, ahead of the real backend.
- Styling: port the prototype's CSS custom properties into real stylesheets; keep Recharts, don't
  port the prototype's hand-rolled SVG chart helpers.
- Routing: `react-router-dom`; Market Radar is a drawer addressed by URL state, not a screen.
- Onboarding is post-registration only; `BusinessProfile.tsx` / `UniquenessCalibrationView.tsx`
  logic is redistributed into the wizard and Settings.

## 6. Testing expectations

- **Unit (Vitest):** colocated `*.test.tsx` per card, run via `npm run test:unit -- <pattern>` in
  `frontend/`. This is what each card's Definition of Done checks.
- **CI:** `.github/workflows/ci-frontend-v2.yml`, scoped to `frontend/**`, runs on every push/PR to
  `main`. (`ci-frontend.yml` stays scoped to `ceview/**` and is untouched — that app still deploys.)
- **E2E (Playwright):** deferred for `frontend/` — `e2e/**` and `.github/workflows/e2e.yml` still
  target `ceview/**` only. Don't add `frontend/` e2e specs until a later plan wires that up.

## 7. Quick checklist for starting a card

- [ ] Confirm the card's **Depends on** entries are merged
- [ ] Read the linked `docs/module-N/screens/*.md` (or `docs/shared/*.md`) for full behavior
- [ ] Open the prototype at the cited line range
- [ ] Check `backend/CONTRACT.md` for the real endpoint shape (fall back to fixtures + flag the gap
      if missing)
- [ ] Build in `frontend/`, against the fixture layer (`VITE_USE_FIXTURES=true`)
- [ ] Write/colocate the unit test named in Definition of Done, run it, confirm green
- [ ] Open PR against `main`, scoped to `frontend/**`
