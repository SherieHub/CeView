# `services/fixtures/` — the mock data layer

Every piece of fake data in `frontend/` lives in this directory. Nothing outside it defines mock
data, so removing the fixtures at deploy is a bounded, mechanical change rather than a hunt.

## How it is wired

`services/apiClient.ts` is the only consumer. Each method has a single branch:

```ts
const USE_FIXTURES = import.meta.env.VITE_USE_FIXTURES === 'true';

list: () => (USE_FIXTURES ? delay(MOCK_NOTIFICATIONS) : request('/api/notifications')),
```

So one env var swaps the whole app between mock and real data. Components never import fixtures for
runtime data — they call `apiClient` and receive whichever side of the branch is live.

The two exceptions, both deliberate and both dev-only:

| Import | Where | Why |
|---|---|---|
| `DEMO_PROFILE` | `App.tsx` | Seeds the `/preview/*` routes, which are behind `import.meta.env.DEV` |
| `DEMO_BUSINESS` | `obDraft.tsx`, `BasicInfoStep.tsx` | Re-exported for the onboarding demo shortcut, itself behind `import.meta.env.DEV` |

Type-only imports (`import type { Market } from './markets'`) are not data and can stay — those
types describe the real API's shape too, and should move to `types.ts` when the backend lands.

## Removing the mock layer at deploy

1. Delete this directory.
2. In `apiClient.ts`, delete the `USE_FIXTURES` const, its imports, and collapse every
   `USE_FIXTURES ? delay(...) : request(...)` to just the `request(...)` side.
3. Delete the `devPreviewRoutes` array and its two components in `App.tsx`.
4. Delete the demo-fill button in `BasicInfoStep.tsx` and the re-exports in it and `obDraft.tsx`.
5. Move any still-referenced types out of here into `types.ts`.

`npx tsc --noEmit` will name every remaining reference, so step 5 is a compiler-driven checklist
rather than a search.

## Invariant

```bash
grep -rn "DEMO_\|MOCK_" frontend/components frontend/layout frontend/services/*.ts
```

Should return **imports only, no definitions**. A definition outside this directory means a fixture
has leaked back into application code and will ship to production.

## A known limitation

Fixtures are imported at `apiClient.ts`'s top level, so they are in the production bundle even when
`USE_FIXTURES` is false — the flag gates their *use*, not their presence. Currently that is a few KB
of strings. It is another reason the delete step above matters, and it is why demo data that is
genuinely dev-only (the demo business, the preview routes) is guarded by `import.meta.env.DEV`
instead, which Vite evaluates statically and tree-shakes.

## Files

| File | Contents |
|---|---|
| `demoBusiness.ts` | Sunset Cove Beach Resort — the demo operator, shared by onboarding and the previews |
| `profile.ts` | `DEMO_PROFILE`, the same business as a completed `BusinessProfile` |
| `markets.ts` | `MOCK_MARKETS`, `CATEGORY_MARKET_SCORES`, `marketsForCategory()`, chart generation |
| `notifications.ts` | `MOCK_NOTIFICATIONS` — the surge alert feed |
| `content.ts`, `omcs.ts` | Module 3 — generated content and compliance scoring |
| `campaign.ts` | Module 4 — campaign input, history, prescriptive report |
| `posts.ts`, `postMetrics.ts` | Scheduled posts and their engagement metrics |
| `connections.ts` | Connected publishing platforms |
| `members.ts` | Workspace members |
