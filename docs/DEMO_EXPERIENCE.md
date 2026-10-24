# Interactive showcase and public demo

Two ways for a visitor to see CeView before signing up:

1. **Guided showcase** in the landing page's "Four tools, one workflow" section — screenshots of the real app with a short, clickable walk-through.
2. **Public demo** at `/demo` — the real app shell and screens, on sample data for a fictional business, with no account.

## Assessment (what existed, and the decisions it led to)

| Question | Finding | Decision |
|---|---|---|
| Reusable screens | Dashboard, Content Studio, Calendar, Performance and Business Profile already render from `apiClient` + four stores, and run under the DEV-only `/preview/*` routes. | `/demo` mounts the **same** components and `AppShell`; no second copy of the app. |
| Sample data | `services/fixtures/*` back every screen, but only behind `VITE_USE_FIXTURES`, which `apiClient.ts` refuses to ship in a production build. | Kept that rule. The demo has its **own** data layer (`components/demo/demoApi.ts`) that imports the fixtures and loads only with the `/demo` chunk. |
| `/preview` routes | DEV-only and tree-shaken from production; no auth, but also no guard against real API calls. | Not exposed. `/demo` is a separate, deliberately public route with a guard. |
| Network exposure | `apiClient.request()` sends the stored operator token on every call; `attributionEnquiries.ts` calls `fetch` directly (and also sends the token for `list`); Business Profile's contact section calls `auth.getProfile`. | One guard (`services/demoMode.ts`) wraps **every** `apiClient` namespace, plus checks in `request()` and `attributionEnquiries.ts`. |
| Features that can't be shown honestly | Connecting Meta/TikTok (real OAuth), workspace invites (no backend), sign-up/onboarding, publishing (never real in the app). | Platforms and Workspace show **locked** in the demo sidebar; publishing says "Demo: nothing is posted". |
| Landing weight | The app's chart and screen code is several hundred KB. | The showcase uses only 4 WebP screenshots (83–117 KB each), loaded one at a time; no app code. |
| Analytics | None in the codebase; the Privacy Notice promises no third-party analytics cookies. | `services/analytics.ts` emits events locally only (see below). |

## How the public demo stays safe

- **Nothing reaches the backend.** While `/demo` is mounted, `apiClient` answers from `demoApi.ts` or rejects with `DEMO_UNAVAILABLE` (an `ApiError` 404). `request()` and `attributionEnquiries.ts` refuse independently. So no request leaves the browser and no sign-in token is sent — even for a visitor who is signed in.
- **Switched on before the first request.** `DemoRoot` activates demo mode during render (child effects run before parent effects), and deactivates on unmount. Only the activation that is ending can switch it off.
- **Separate state.** The demo mounts its own seeded `ProfileProvider`, `PostStoreProvider`, `ConnectionsStoreProvider` and `TargetSelectionProvider`. A signed-in operator's stores are not reused, and the demo never writes the Content Studio first-run flag that a real account would inherit.
- **Backend unchanged.** No endpoint was opened or relaxed; every backend route still requires a signed-in operator. The demo simply never asks it.
- **Verified** (`services/demoMode.test.ts`, `components/demo/DemoRoot.test.tsx`, and a browser run with `VITE_USE_FIXTURES=false` through the full tour, Reset and reloads): zero requests to the API.

## Real vs simulated

| | In the demo |
|---|---|
| **Real application code** | Shell, sidebar, top bar; Dashboard; Content Studio (Quick Post, Campaigns, Content Library); Calendar; Performance (all six results tabs); Business Profile editing; the compliance audit UI; the publish window. |
| **Realistic sample data** | Business (Sunset Cove Beach Resort, fictional), surge alerts, market rankings, caption options, review result, posts, campaign figures, attribution links, ad-account figures. |
| **Illustrative output** | "Generated" captions, the review score and the AI action plan are pre-written samples — no AI model is called. "Refresh forecast" re-ranks the same sample markets. Saved edits and published/scheduled posts live in the browser until reload or **Reset demo**. |
| **Unavailable (locked or refused)** | Sign-up and sign-in, onboarding, connecting or disconnecting platforms and ad accounts, workspace members and invites, the contact-number section, real publishing. |

## Guided tour

Eight stops (`components/demo/tourSteps.ts`): welcome → surge alert → ranked markets → captions → review → results → next action → finish (Request a personalized demo / Keep exploring). Each stop opens its screen and outlines a real element; the card is non-modal, Escape or "Exit tour" ends it, and it can be restarted from the demo strip.

## Analytics events

`track()` in `services/analytics.ts`. There is **no analytics provider** in CeView, so events are only dispatched as a `ceview:analytics` window event and pushed to `window.dataLayer` if a tag manager defines one. Events carry the name and a fixed label only — never typed text or visitor details.

| Event | When | Props |
|---|---|---|
| `showcase_feature_selected` | A tool card is chosen on the landing page | `feature` |
| `showcase_step_completed` | A showcase step is reached going forward | `feature`, `step` |
| `demo_opened` | `/demo` mounts | — |
| `demo_feature_explored` | The visitor lands on a demo screen | `feature` |
| `demo_guided_tour_started` / `_completed` | Tour started / finished | — |
| `demo_reset` | Reset demo | — |
| `demo_request_cta_clicked` | Request a personalized demo, in the demo | `from` |
| `request_demo_submitted` | The lead form's endpoint accepted a request | — |

To review them, add a provider (consent permitting) that listens for `ceview:analytics`, or a tag manager reading `dataLayer`. Until then nothing is recorded.

## Maintaining it

- **Screenshots:** `frontend/components/landing/assets/*.webp` were captured from `/demo` at 1440×900 @2×. The showcase's point positions in `content/landing.ts` (`SCREENS.tabs[].steps[].box`, in percent) were measured from the same capture — re-measure them whenever a screenshot is replaced.
- **New demo screen:** add the route in `App.tsx` under `/demo`, the path in `layout/shellContext.tsx` (`DEMO_PATHS`), and any API calls it makes to `demoApi.ts` (otherwise they are refused).
- **Links between screens** use `AppLink` / `useAppPath()` so they stay inside `/demo`.
