# Model-unavailable retry notice — Onboarding Step 5 and Dashboard

**Date:** 2026-11-23
**Modules:** 1 (onboarding analysis) and 2 (dashboard forecast)
**Status:** Approved direction, pending spec review

## Problem

Two screens call hosted models that are often unavailable: the SBERT classifier and the BiLSTM
forecaster, both on HuggingFace Spaces with ZeroGPU quotas. On failure, both screens show
`ApiErrorPanel`, a developer-facing box with method, path, status, backend code and the raw cause.

- **Onboarding Step 5** (`frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`): the panel
  replaces the whole step, with no retry. A first-run cold start leaves the operator stuck.
- **Dashboard** (`frontend/components/module-2/2.1-dashboard/DashboardView.tsx`): a failed **Refresh
  forecast** run (`POST /api/forecasting/analyze`) lands in the same `error` slot as a failed page load,
  and the panel's Retry calls `reload()`. That only re-reads stored data and never reruns the forecast,
  so it cannot fix the failure the operator just saw.
- When the failure is a quota limit (e.g. *"You have exceeded your ZeroGPU runs limit"*), retrying
  immediately is pointless, and nothing tells the operator to wait.
- Dashboard layout bug: `.dash-screen .stat-row` has `margin-top: -72px` so the KPI tiles tuck into
  the hero. With an error panel above them, the tiles cover the bottom 72px of the panel.

## Decisions

| Question | Decision |
| --- | --- |
| What replaces the error panel | Plain-language message plus a **Try again** button. No method/path/status/cause on screen. |
| Which calls | Step 5: `analyze` and `uniqueness`. Dashboard: forecast refresh and the data load. |
| Automatic retry | None. The button appears immediately. |
| Error types | Every failure gets the notice and button. Quota/rate-limit failures get "wait a while" copy instead of "try again now" copy. One exception: on the dashboard, "profile not ready" (409) keeps `ApiErrorPanel`'s "Complete onboarding first" guidance, because no retry can fix it. Step 5 cannot receive that error. |
| Developer detail | Logged to the browser console in a structured form (§3). |

## Design

### 1. `retryAdvice(error)` — classification (new, shared)

`frontend/services/retryAdvice.ts` exports `retryAdvice(error: unknown): 'wait' | 'retry'`.

It returns `'wait'` when any of these is true, otherwise `'retry'`:

- `error` is an `ApiError` with `status === 429`;
- its `code` matches `/QUOTA|RATE_LIMIT/i` (covers `MOD22_AI_QUOTA_EXCEEDED`);
- its `cause` or `message` matches `/quota|rate.?limit|runs limit|exceeded your|too many requests/i`.
  This covers the ZeroGPU message, which arrives as `MOD22_BILSTM_UNAVAILABLE` with the quota text
  only in `cause`.

Pure function, unit-tested on its own.

### 2. `RetryNotice` component (new, shared)

`frontend/components/shared/RetryNotice.tsx`. Props:

- `error: unknown` — used only to pick the copy via `retryAdvice`; never rendered.
- `title: string` — e.g. "The analysis didn't finish."
- `onRetry: () => void`
- `busy?: boolean` — disables the button and shows a spinner with "Trying again…".

It renders a `div.banner.banner--warn` with `role="alert"`, an `AlertTriangle` icon, the bold title, the
body copy, and a `button.btn-outline.btn-outline--sm` (type `button`) labelled **Try again** with a `RotateCcw` icon.
Long text wraps (`overflow-wrap: anywhere`).

Body copy:

- `retry`: "Our model didn't respond. This usually clears up in a few seconds — try again."
- `wait`: "Our model has reached its usage limit for now. Please wait a while before trying again —
  it resets on its own."

The button is shown in both cases. In the `wait` case the copy sets the expectation; nothing blocks
the click.

### 3. `logApiFailure(context, error)` — console log (new, shared)

`frontend/services/logApiFailure.ts` calls `console.error` with:

```text
[CeView] <context> failed
{ status, method, path, code, dependency, cause, stage, advice }
```

When `error` is not an `ApiError`, it logs `{ message }` (or the raw value) instead. Both screens call
it on every failure, which keeps the detail that `ApiErrorPanel` showed on screen within reach in
DevTools. It is called from the catch handlers, not from render, so each failure logs once.

### 4. Onboarding Step 5

- The mount effect's body moves into `runAnalysis()`. The effect calls it once on mount (behaviour
  unchanged); **Try again** calls it again. A `useRef` request counter and an unmount flag ensure a
  late response from an earlier attempt is ignored. This replaces the effect-local `cancelled` flag.
- New state `analyzeError`. On failure: `logApiFailure('Business analysis', e)`, set `analyzeError`,
  phase → `idle`. The eyebrow, heading and intro still render. Where the loader or picker would be:
  `RetryNotice` titled **"The analysis didn't finish."** Try again → clear the error, then
  `runAnalysis()`, which shows the existing loader and skeletons.
- New state `scoreError`. On failure: `logApiFailure('Uniqueness scoring', e)`, set `scoreError`,
  phase → `categories`. The picker and the current selection stay. `RetryNotice` titled **"The score
  couldn't be computed."** renders below the Compute button. Try again → `computeUniqueness()` with
  the current selection. `computeUniqueness()` clears `scoreError` when it starts, and
  `toggleCategory()` clears it too.
- The early `return` with `ApiErrorPanel` and its import are removed. The draft is not written on
  failure, so the Finish gate stays closed, as today.

### 5. Dashboard

- `services/forecastStore.tsx` records where `error` came from: new state
  `errorSource: 'load' | 'refresh' | null`. It is set to `'refresh'` in `refreshForecast()`'s catch and
  to `'load'` everywhere else `setError(non-null)` is called. It is cleared with `error`.
  `useDashboardState` passes it through as `state.errorSource`.
- `DashboardView` replaces `<ApiErrorPanel … onRetry={state.retry} />` with:
  - `isProfileNotReady(state.error)` → unchanged `ApiErrorPanel` (see Decisions).
  - `errorSource === 'refresh'` → `RetryNotice` titled **"The forecast didn't update."**,
    `onRetry={state.refresh}`, `busy={state.isRefreshing}`. Rerunning the pipeline here is the
    operator's explicit request, so the existing rule that Retry must never silently start a pipeline
    run still holds for load errors.
  - otherwise (`'load'`) → `RetryNotice` titled **"Your dashboard didn't load."**,
    `onRetry={state.retry}`.
- Logging: `forecastStore` calls `logApiFailure('Forecast refresh', err)` in `refreshForecast()`'s
  catch and `logApiFailure('Dashboard load', failure)` where it sets a load error. Logging lives in
  the store so it happens once per failure, not once per render.
- `RefreshForecastButton` is unchanged. It already stays silent on a null result.
- Layout: the notice gets the class `dash-notice`. In `styles/dashboard.css`, a rule
  `.dash-screen .dash-notice ~ .stat-row { margin-top: 0; }` stops the KPI row from overlapping it.
  This depends on the notice and the stat row being siblings, which will be confirmed during
  implementation; if they are not, the same reset is applied through a modifier class on the row.

### 6. Out of scope

- Automatic retries, backoff, countdowns, or disabling the button during a quota wait.
- Backend or FastAPI changes. Quota detection uses the `cause` text the services already send.
- Other screens that use `ApiErrorPanel`, which itself is not modified.
- `ForecastFreshness`'s "Couldn't update — showing your last forecast" line for background-sync
  failures, which already handles that case.

## Testing

**Unit (new):**

- `retryAdvice.test.ts`:
  - 429 → `wait`;
  - code `MOD22_AI_QUOTA_EXCEEDED` → `wait`;
  - code `MOD22_BILSTM_UNAVAILABLE` with the ZeroGPU cause text → `wait`;
  - plain 503 → `retry`;
  - a non-`ApiError` → `retry`.
- `logApiFailure.test.ts`: an `ApiError` logs the structured fields; a plain `Error` logs its message.
- `RetryNotice.test.tsx`:
  - `role="alert"` with the title;
  - retry copy and wait copy each appear for the matching error;
  - never renders path or status;
  - clicking calls `onRetry`;
  - `busy` disables the button.

**Unit — `AnalysisStep.test.tsx`:**

- Replace the "renders ApiErrorPanel naming the dependency…" case: a rejected `analyze()` shows
  "The analysis didn't finish." with **Try again** and no path or status.
- Reject once then resolve: Try again calls `analyze` again and the picker appears.
- Reject twice: the notice shows again.
- `uniqueness()` rejects: the picker and selection remain, the score notice shows, and Try again calls
  `uniqueness` with the same categories.
- Toggling a category clears the score notice.
- Existing phase, ≥1-category and insufficient-cohort tests pass unchanged.

**Unit — dashboard:**

- `useDashboardState.test.ts`: a failed `refresh()` sets `errorSource: 'refresh'`; a failed load sets
  `'load'`; a successful retry clears both.
- `DashboardView.test.tsx`:
  - a refresh failure shows "The forecast didn't update." and Try again calls `refresh` (not `retry`);
  - a load failure's Try again calls `retry`;
  - the ZeroGPU cause shows the wait copy;
  - a 409 still shows "Complete onboarding first".

**E2E:**

- `e2e/tests/onboarding/analysis.spec.ts`: the existing 503 case (around line 259) keeps asserting
  `role="alert"`, then switches the route to succeed, clicks **Try again**, and expects the categories.
- The dashboard is covered by unit tests only. No new e2e spec.

## Docs

- `docs/module-1/screens/onboarding-wizard.md`: describe the Step 5 retry notice for both calls.
- `docs/module-2/README.md` (or its dashboard screen doc, if one exists): describe the dashboard retry
  notice, the refresh-vs-load distinction, and the wait copy for quota errors.
