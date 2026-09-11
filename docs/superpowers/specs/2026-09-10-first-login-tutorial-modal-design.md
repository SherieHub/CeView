# First-Login Tutorial Modal — Design

## Problem

Every new operator finishes the onboarding wizard and lands on `/dashboard` with no
explanation of what the four main tabs (Dashboard, Content Studio, Calendar, Performance) do
or how each one helps their business. There is currently no tutorial/tour mechanism anywhere
in the frontend.

## Goal

Show every new user a short, skippable, multi-step tutorial modal the first time they reach
`/dashboard` after finishing onboarding, explaining what each of the 4 main tabs is for and
how it helps the business. Provide a way to replay it later on demand.

## Non-goals

- Covering the 3 Settings tabs (Business Profile, Platforms, Workspace) — out of scope; they're
  administrative/self-explanatory.
- A sidebar spotlight/tooltip-style product tour — using a modal carousel instead.
- Persisting "has seen tutorial" server-side or in browser storage — the trigger is a one-shot
  navigation signal (see below), not a durable flag.
- Any backend/API changes. This is frontend-only.

## Trigger & lifecycle

1. `OnboardingWizard.handleFinish()` (`frontend/components/module-1/onboarding/OnboardingWizard.tsx`)
   changes its final navigation from `navigate('/dashboard')` to
   `navigate('/dashboard', { state: { justOnboarded: true } })`.
2. `DashboardView` (`frontend/components/module-2/2.1-dashboard/DashboardView.tsx`) reads
   `location.state?.justOnboarded` in a `useEffect` on mount:
   - If set: open `TutorialModal`, then immediately call
     `navigate(location.pathname + location.search, { replace: true, state: {} })` to scrub the
     flag from history. This makes it a true one-shot — Back navigation or a refresh of
     `/dashboard` never re-opens it, because the state that triggered it no longer exists in
     history once scrubbed.
   - If not set: render as normal, no modal.
3. Settings → Workspace gets a "Replay tour" control that opens the same `TutorialModal` via its
   own local `open` state, independent of router state — this is a direct user action, not the
   one-shot first-login signal.

No backend call, no localStorage/sessionStorage key, no new field on the business profile. The
only piece of state is the transient router navigation state used for exactly one hop
(`/onboarding` → `/dashboard`).

## Component

New file: `frontend/components/shared/TutorialModal.tsx`.

Placed in `shared/` (not under `module-2/`) because it is consumed by two unrelated call sites
(Dashboard and Settings/Workspace) and owns no module-specific data — it's a static,
self-contained presentational component.

**Props:**

```ts
interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}
```

**Internal structure:**

- `SLIDES: { icon: LucideIcon; title: string; body: string }[]` — a local constant, 4 entries,
  one per main tab. Icons are imported from `lucide-react` and are the *same* icons already used
  for these tabs in `frontend/layout/nav.ts` (`LayoutDashboard`, `Sparkles`, `CalendarDays`,
  `TrendingUp`), so the tour visually matches the sidebar.
- `step` state (`0`–`3`, `useState`).
- Wraps the existing `Modal` component (`frontend/components/shared/Modal.tsx`) with
  `variant="panel"` — this gets Escape-to-dismiss, scrim click-to-dismiss, and overlay-stack
  registration for free; `TutorialModal` does not reimplement any of that.
- **Layout per slide:** large centered tab icon → heading (tab name) → 1–2 sentence body copy.
- **Footer:**
  - Step-dot indicator (4 dots, current step filled) — same visual idiom as the onboarding
    wizard's own progress rail, for consistency.
  - "Back" button, hidden on step 0.
  - "Next" button on steps 0–2; becomes "Get started" on step 3, and clicking it calls `onClose()`
    instead of advancing.
  - "Skip tour" text link, visible at every step, calls `onClose()` immediately.
- Closing via the `Modal`'s own `X` button or Escape also just calls `onClose()` — skippable at
  any point, from any exit path. The modal does not reset its internal `step` back to 0 on close;
  since it's fully unmounted between opens (`open=false` → `Modal` returns `null`), remounting
  naturally starts back at step 0 next time.

## Copy (final)

| Tab | Icon | Copy |
|---|---|---|
| Dashboard | `LayoutDashboard` | "Your alert command center. See surge alerts the moment CeView forecasts a spike in travelers from your tracked markets, scoped to your business categories — so you know when demand is coming before it arrives." |
| Content Studio | `Sparkles` | "Turn a surge alert into ready-to-post content. Generate market-localized captions and visual direction, get them checked for compliance, and publish straight to your connected platforms." |
| Calendar | `CalendarDays` | "See what's scheduled and when. Track every piece of content you've queued or published, so your posting stays consistent around each surge." |
| Performance | `TrendingUp` | "Know what worked. Feed in your campaign results and get KPIs, a funnel breakdown, and an AI-generated report that tells you exactly what to fix next." |

## Replay entry point

`frontend/components/settings/` — the Workspace settings screen (`/settings/workspace`) gains a
"Replay tour" button/link, placed to fit that screen's existing layout (exact position decided
at implementation time — the screen's current content wasn't audited as part of this design).
Clicking it opens `TutorialModal` with `open=true` via local state on that screen.

## Styling

Uses existing design tokens/classes only (`.heading-md`, `.body-sm`/`.text-meta`, `.card`-style
surfaces, existing button classes from `Modal`'s panel variant) — no new CSS system introduced.
Follows `tourism-app-branding` skill conventions for any new button/spacing choices made during
implementation.

## Testing

- **`TutorialModal.test.tsx`** (new):
  - Renders slide 0 by default (Dashboard content, no "Back" button).
  - "Next" advances through slides 1–3; "Back" retreats; step dots reflect current index.
  - "Skip tour" calls `onClose` from any step.
  - Modal's `X` and Escape both call `onClose`.
  - On step 3, the advance button reads "Get started" and calls `onClose` (not further
    advancement).
- **`OnboardingWizard.test.tsx`** (extend existing): `handleFinish` navigates to `/dashboard` with
  `state: { justOnboarded: true }`.
- **`DashboardView` test suite** (extend existing, or new): mounting with
  `location.state = { justOnboarded: true }` opens `TutorialModal`; mounting without it does not;
  after opening, the router state is replaced/cleared.
- **Settings/Workspace test** (extend existing): "Replay tour" control opens `TutorialModal`.

## Files touched/added

- **New:** `frontend/components/shared/TutorialModal.tsx`, `TutorialModal.test.tsx`
- **Edited:** `frontend/components/module-1/onboarding/OnboardingWizard.tsx` (navigate call)
- **Edited:** `frontend/components/module-2/2.1-dashboard/DashboardView.tsx` (mount effect +
  modal render)
- **Edited:** Workspace settings screen under `frontend/components/settings/` (replay entry
  point)
- **Extended tests:** `OnboardingWizard.test.tsx`, Dashboard's test suite, Workspace settings
  test suite
