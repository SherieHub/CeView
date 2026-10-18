# frontend

The CeView web app: React 19 + TypeScript + Vite + Tailwind. This is the app that's developed and
deployed; `ceview/` (the sibling folder) is a frozen earlier build kept only until anything unique in it
is ported here.

## Run

```bash
npm install
cp .env.example .env     # optional: backend URL, Google sign-in, landing links (Windows: copy)
npm run dev              # http://localhost:3001, talks to http://localhost:8080
```

`VITE_USE_FIXTURES=true npm run dev` runs against the fixture data in `services/fixtures/` with no
backend. Every variable is described in `.env.example` and in [RUNNING.md §5](../RUNNING.md#5-environment-variables).
`VITE_` values are built into the bundle and visible to anyone, so never put a secret in `.env`.

## Build

```bash
npm run build        # production bundle in dist/ (refuses VITE_USE_FIXTURES=true)
npm run preview      # serve dist/ locally
```

Deploys serve `dist/` as static files: S3 + CloudFront on AWS (`docs/DEPLOY_AWS.md`), or a Render
static site (`docs/DEPLOY_RENDER.md`). There is no frontend container.

## Test

| Command | Runs | Needs |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` | nothing |
| `npm run test:unit` | Vitest component and unit tests | nothing |
| `npm run test:integration` | `tests/integration` (cross-file and cross-stack checks) | nothing |
| `npm run test:contract` | `tests/contract` against real API responses | backend on `VITE_API_BASE_URL` |
| `npm test` | unit + integration | nothing |

End-to-end tests live in `../e2e` (Playwright); see [RUNNING.md §8](../RUNNING.md#8-running-the-tests).
