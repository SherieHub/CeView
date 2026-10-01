# frontend

This is the **active** CeView frontend under development — a from-scratch rebuild of the UI/UX
overhaul described in
[`docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/`](../docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/),
built with Tailwind instead of `ceview/`'s hand-rolled CSS custom-properties system.

`ceview/` (the sibling directory) remains the **deployed** app (see `render.yaml`) until this
directory is ready to cut over. Nothing here is copied from `ceview/` — `ui-ux-prototype.html` at
the repo root is the shared source of truth for design tokens and screen behavior for both.

## Running locally

```
npm install
npm run dev      # http://localhost:3001
npm run build
npm run test:unit
```

`VITE_USE_FIXTURES=true` runs the app against the fixture data layer (`services/fixtures/`) with no
backend required.
