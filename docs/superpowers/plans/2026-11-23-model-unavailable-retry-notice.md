# Model-unavailable Retry Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo rule:** never run `git commit` or `git push` in this repository (`.claude/CLAUDE.md`). Each task ends with a **Checkpoint** step instead: stop and list the changed files so the user can commit them.

**Goal:** Replace the developer-facing `ApiErrorPanel` on onboarding Step 5 and the dashboard with a plain-language notice and a **Try again** button. Quota failures get "wait a while" copy, and the technical detail goes to a structured console log.

**Architecture:** Three small shared units:
- `retryAdvice()` classifies an error as `wait` or `retry`;
- `logApiFailure()` writes one structured `console.error`;
- `<RetryNotice>` renders the banner.

`AnalysisStep` gains a re-runnable `runAnalysis()` and separate error states for its two calls. `forecastStore` records whether its `error` came from the page load or a forecast refresh, so the dashboard's **Try again** reruns the right thing.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library, Playwright, Tailwind utility classes, lucide-react icons.

**Spec:** [`docs/superpowers/specs/2026-11-23-analysis-step-retry-design.md`](../specs/2026-11-23-analysis-step-retry-design.md)

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `frontend/services/retryAdvice.ts` | Create | `retryAdvice(error) → 'wait' \| 'retry'` |
| `frontend/services/retryAdvice.test.ts` | Create | Unit tests |
| `frontend/services/logApiFailure.ts` | Create | One structured `console.error` per failure |
| `frontend/services/logApiFailure.test.ts` | Create | Unit tests |
| `frontend/components/shared/RetryNotice.tsx` | Create | Banner, copy and Try again button |
| `frontend/components/shared/RetryNotice.test.tsx` | Create | Unit tests |
| `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx` | Modify | Re-runnable analysis, per-call error state, `RetryNotice` |
| `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx` | Modify | Replace the ApiErrorPanel case; add retry cases |
| `frontend/services/forecastStore.tsx` | Modify | `errorSource`, `failWith` / `clearError`, logging |
| `frontend/components/module-2/2.1-dashboard/useDashboardState.ts` | Modify | Pass `errorSource` through |
| `frontend/components/module-2/2.1-dashboard/useDashboardState.test.ts` | Modify | `errorSource` cases |
| `frontend/components/module-2/2.1-dashboard/DashboardView.tsx` | Modify | `RetryNotice`, with `ApiErrorPanel` kept for 409 |
| `frontend/components/module-2/2.1-dashboard/DashboardView.test.tsx` | Modify | Notice cases |
| `frontend/styles/dashboard.css` | Modify | Stop `.stat-row` overlapping the notice |
| `e2e/tests/onboarding/analysis.spec.ts` | Modify | Outage → Try again → categories |
| `docs/module-1/screens/onboarding-wizard.md` | Modify | Step 5 failure behaviour |
| `docs/module-2/screens/dashboard.md` | Modify | Dashboard failure states |

All commands run from `frontend/` unless stated.

---

### Task 1: `retryAdvice()`

**Files:**
- Create: `frontend/services/retryAdvice.ts`
- Test: `frontend/services/retryAdvice.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/services/retryAdvice.test.ts
import { describe, expect, it } from 'vitest';
import { ApiError } from './apiError';
import { retryAdvice } from './retryAdvice';

function apiError(status: number, body: Record<string, unknown> = {}) {
  return new ApiError({ status, method: 'POST', path: '/api/forecasting/analyze', body });
}

describe('retryAdvice', () => {
  it('says wait on HTTP 429', () => {
    expect(retryAdvice(apiError(429))).toBe('wait');
  });

  it('says wait on a quota error code', () => {
    expect(retryAdvice(apiError(503, { code: 'MOD22_AI_QUOTA_EXCEEDED' }))).toBe('wait');
  });

  it('says wait when only the cause carries the ZeroGPU quota text', () => {
    const err = apiError(503, {
      code: 'MOD22_BILSTM_UNAVAILABLE',
      message: 'The BiLSTM + Transformer demand model is unavailable.',
      dependency: 'bilstm',
      cause:
        'inference failed for KR/coastal_island: You have exceeded your ZeroGPU runs limit. Subscribe to Hugging Face PRO',
    });
    expect(retryAdvice(err)).toBe('wait');
  });

  it('says retry on a plain 503', () => {
    expect(retryAdvice(apiError(503, { code: 'ai_service_unreachable', dependency: 'fastapi-sbert' }))).toBe(
      'retry',
    );
  });

  it('says retry for anything that is not an ApiError', () => {
    expect(retryAdvice(new Error('offline'))).toBe('retry');
    expect(retryAdvice('boom')).toBe('retry');
    expect(retryAdvice(null)).toBe('retry');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run services/retryAdvice.test.ts`
Expected: FAIL, `Failed to resolve import "./retryAdvice"`.

- [ ] **Step 3: Implement**

```ts
// frontend/services/retryAdvice.ts
/**
 * Whether a failed model call is worth retrying now, or only after a wait.
 *
 * Quota failures do not always carry a quota code: the BiLSTM forecaster reports a
 * ZeroGPU limit as MOD22_BILSTM_UNAVAILABLE with the quota wording only in `cause`.
 * So the text is checked as well as the status and code.
 */
import { ApiError } from './apiError';

export type RetryAdvice = 'wait' | 'retry';

const WAIT_CODE = /QUOTA|RATE_LIMIT/i;
const WAIT_TEXT = /quota|rate.?limit|runs limit|exceeded your|too many requests/i;

export function retryAdvice(error: unknown): RetryAdvice {
  if (!(error instanceof ApiError)) return 'retry';
  if (error.status === 429) return 'wait';
  if (error.code && WAIT_CODE.test(error.code)) return 'wait';
  if (WAIT_TEXT.test(`${error.cause ?? ''} ${error.message}`)) return 'wait';
  return 'retry';
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run services/retryAdvice.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Checkpoint.** Stop and list `frontend/services/retryAdvice.ts` and `frontend/services/retryAdvice.test.ts` for the user to commit.

---

### Task 2: `logApiFailure()`

**Files:**
- Create: `frontend/services/logApiFailure.ts`
- Test: `frontend/services/logApiFailure.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/services/logApiFailure.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './apiError';
import { logApiFailure } from './logApiFailure';

afterEach(() => vi.restoreAllMocks());

describe('logApiFailure', () => {
  it('logs the structured ApiError fields and the advice', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new ApiError({
      status: 503,
      method: 'POST',
      path: '/api/forecasting/analyze',
      body: {
        code: 'MOD22_BILSTM_UNAVAILABLE',
        dependency: 'bilstm',
        cause: 'You have exceeded your ZeroGPU runs limit',
        stage: 'inference',
      },
    });

    logApiFailure('Forecast refresh', err);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('[CeView] Forecast refresh failed', {
      status: 503,
      method: 'POST',
      path: '/api/forecasting/analyze',
      code: 'MOD22_BILSTM_UNAVAILABLE',
      dependency: 'bilstm',
      cause: 'You have exceeded your ZeroGPU runs limit',
      stage: 'inference',
      advice: 'wait',
    });
  });

  it('logs the message of a plain Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logApiFailure('Dashboard load', new Error('offline'));
    expect(spy).toHaveBeenCalledWith('[CeView] Dashboard load failed', { message: 'offline', advice: 'retry' });
  });

  it('logs a non-Error value as a string', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logApiFailure('Business analysis', 'boom');
    expect(spy).toHaveBeenCalledWith('[CeView] Business analysis failed', { message: 'boom', advice: 'retry' });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run services/logApiFailure.test.ts`
Expected: FAIL, `Failed to resolve import "./logApiFailure"`.

- [ ] **Step 3: Implement**

```ts
// frontend/services/logApiFailure.ts
/**
 * The developer-facing half of a failed call. The screen shows plain language only
 * (RetryNotice); this puts the request, status, backend code and cause in DevTools.
 * Call it from the catch handler, never from render, so each failure logs once.
 */
import { ApiError } from './apiError';
import { retryAdvice } from './retryAdvice';

export function logApiFailure(context: string, error: unknown): void {
  const advice = retryAdvice(error);
  const label = `[CeView] ${context} failed`;
  if (error instanceof ApiError) {
    console.error(label, {
      status: error.status,
      method: error.method,
      path: error.path,
      code: error.code,
      dependency: error.dependency,
      cause: error.cause,
      stage: error.stage,
      advice,
    });
    return;
  }
  console.error(label, { message: error instanceof Error ? error.message : String(error), advice });
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run services/logApiFailure.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Checkpoint.** List `frontend/services/logApiFailure.ts` and `frontend/services/logApiFailure.test.ts`.

---

### Task 3: `<RetryNotice>`

**Files:**
- Create: `frontend/components/shared/RetryNotice.tsx`
- Test: `frontend/components/shared/RetryNotice.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/shared/RetryNotice.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiError';
import { RETRY_COPY, RetryNotice } from './RetryNotice';

const unavailable = new ApiError({
  status: 503,
  method: 'POST',
  path: '/api/classification/analyze',
  body: { code: 'ai_service_unreachable', dependency: 'fastapi-sbert' },
});
const quota = new ApiError({
  status: 503,
  method: 'POST',
  path: '/api/forecasting/analyze',
  body: { code: 'MOD22_BILSTM_UNAVAILABLE', cause: 'You have exceeded your ZeroGPU runs limit' },
});

describe('RetryNotice', () => {
  it('is an alert carrying the title and the retry copy', () => {
    render(<RetryNotice error={unavailable} title="The analysis didn't finish." onRetry={vi.fn()} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("The analysis didn't finish.");
    expect(alert).toHaveTextContent(RETRY_COPY.retry);
  });

  it('asks the operator to wait on a quota failure', () => {
    render(<RetryNotice error={quota} title="The forecast didn't update." onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(RETRY_COPY.wait);
  });

  it('never renders the request path, status or cause', () => {
    render(<RetryNotice error={quota} title="The forecast didn't update." onRetry={vi.fn()} />);
    const text = screen.getByRole('alert').textContent ?? '';
    expect(text).not.toContain('/api/');
    expect(text).not.toContain('503');
    expect(text).not.toContain('ZeroGPU');
  });

  it('calls onRetry when Try again is clicked', () => {
    const onRetry = vi.fn();
    render(<RetryNotice error={unavailable} title="x" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('disables the button while busy', () => {
    render(<RetryNotice error={unavailable} title="x" onRetry={vi.fn()} busy />);
    expect(screen.getByRole('button', { name: /Trying again/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run components/shared/RetryNotice.test.tsx`
Expected: FAIL, `Failed to resolve import "./RetryNotice"`.

- [ ] **Step 3: Implement**

```tsx
// frontend/components/shared/RetryNotice.tsx
/**
 * The operator-facing surface for a model call that failed: one plain sentence and
 * a Try again button. Unlike ApiErrorPanel it never shows the request, status or
 * cause; logApiFailure() puts those in the console. `error` is only read to choose
 * between "try again now" and "wait a while" (retryAdvice).
 * Spec: docs/superpowers/specs/2026-11-23-analysis-step-retry-design.md
 */
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { retryAdvice } from '../../services/retryAdvice';

export const RETRY_COPY = {
  retry: "Our model didn't respond. This usually clears up in a few seconds — try again.",
  wait: 'Our model has reached its usage limit for now. Please wait a while before trying again — it resets on its own.',
} as const;

interface Props {
  error: unknown;
  /** Bold lead sentence, e.g. "The analysis didn't finish." */
  title: string;
  onRetry: () => void;
  /** The retried call is running: disable the button and say so. */
  busy?: boolean;
  className?: string;
}

export function RetryNotice({ error, title, onRetry, busy = false, className }: Props) {
  const advice = retryAdvice(error);
  return (
    <div
      role="alert"
      data-advice={advice}
      className={`banner banner--warn${className ? ` ${className}` : ''}`}
    >
      <AlertTriangle aria-hidden="true" />
      <div className="min-w-0 [overflow-wrap:anywhere]">
        <p>
          <b>{title}</b> {RETRY_COPY[advice]}
        </p>
        <button
          type="button"
          className="btn-outline btn-outline--sm mt-3"
          onClick={onRetry}
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="spinner" aria-hidden="true" /> Trying again…
            </>
          ) : (
            <>
              <RotateCcw size={14} aria-hidden="true" /> Try again
            </>
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npx vitest run components/shared/RetryNotice.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Checkpoint.** List `frontend/components/shared/RetryNotice.tsx` and `frontend/components/shared/RetryNotice.test.tsx`.

---

### Task 4: Onboarding Step 5 — retry the category analysis

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`
- Test: `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`

- [ ] **Step 1: Replace the ApiErrorPanel test with failing retry tests**

In `AnalysisStep.test.tsx`:
- Delete the whole `it('renders ApiErrorPanel naming the dependency when analyze() is rejected as a missing dependency', …)` block (around line 157).
- In the file header comment, change "the ApiErrorPanel surface on a failed analyze()" to "the retry notice on a failed analyze() or uniqueness()".
- Add this import beside the other imports:

```tsx
import { RETRY_COPY } from '../../../shared/RetryNotice';
```

Then add these cases where the deleted block was. They reuse the file's existing `analyzeMock`, `renderStep` and `ApiError`.

```tsx
  describe('when the analysis model is unavailable', () => {
    const ALLOCATIONS = [
      { name: 'Coastal & Island', percentage: 90 },
      { name: 'Adventure & Nature', percentage: 60 },
    ];
    const outage = new ApiError({
      status: 503,
      method: 'POST',
      path: '/api/classification/analyze',
      body: { code: 'ai_service_unreachable', dependency: 'fastapi-sbert' },
    });

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('shows a plain-language retry notice, not the technical panel', async () => {
      analyzeMock.mockRejectedValue(outage);
      renderStep();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent("The analysis didn't finish.");
      expect(alert).toHaveTextContent(RETRY_COPY.retry);
      expect(alert).not.toHaveTextContent('/api/classification/analyze');
      expect(alert).not.toHaveTextContent('503');
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
      // The step's own heading stays — the notice replaces the loader, not the step.
      expect(screen.getByText('Categories and uniqueness')).toBeInTheDocument();
    });

    it('re-runs the analysis on Try again and shows the categories', async () => {
      analyzeMock.mockRejectedValueOnce(outage).mockResolvedValueOnce(ALLOCATIONS);
      renderStep();

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      expect(await screen.findByRole('button', { name: /Compute uniqueness score/ })).toBeInTheDocument();
      expect(analyzeMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the notice again when the retry also fails', async () => {
      analyzeMock.mockRejectedValue(outage);
      renderStep();

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(2));
      expect(await screen.findByRole('alert')).toHaveTextContent("The analysis didn't finish.");
    });

    it('logs the failure for developers', async () => {
      analyzeMock.mockRejectedValue(outage);
      renderStep();
      await screen.findByRole('alert');
      expect(console.error).toHaveBeenCalledWith(
        '[CeView] Business analysis failed',
        expect.objectContaining({ status: 503, path: '/api/classification/analyze' }),
      );
    });
  });
```

- [ ] **Step 2: Run the tests and confirm the new ones fail**

Run: `npx vitest run components/module-1/onboarding/steps/AnalysisStep.test.tsx`
Expected: the four new tests FAIL. The step still renders `ApiErrorPanel`, so the text "The analysis didn't finish." and the "Try again" button are not found. Every other test still passes.

- [ ] **Step 3: Implement in `AnalysisStep.tsx`**

3a. Replace the imports block (lines 44-53) with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useObDraft } from '../obDraft';
import { useToast } from '../../../shared/Toast';
import { RetryNotice } from '../../../shared/RetryNotice';
import { apiClient } from '../../../../services/apiClient';
import { logApiFailure } from '../../../../services/logApiFailure';
import type { CategoryAllocation, UniquenessResult } from '../../../../types';
import CategoryPicker from './analysis/CategoryPicker';
import ScoreTiles from './analysis/ScoreTiles';
import CohortContext from './analysis/CohortContext';
```

3b. Replace the `error` state line and the whole mount `useEffect` (lines 87-125) with:

```tsx
  const [analyzeError, setAnalyzeError] = useState<unknown | null>(null);
  const [scoreError, setScoreError] = useState<unknown | null>(null);

  // A retry must never be overwritten by a slower, earlier attempt, or by an
  // attempt that settles after the step unmounts.
  const analyzeRequest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  function runAnalysis() {
    const request = ++analyzeRequest.current;
    const isStale = () => !mounted.current || request !== analyzeRequest.current;
    setAnalyzeError(null);
    setPhase('analyzing');

    apiClient.classification
      .analyze({
        businessName: draft.businessName,
        description: draft.description,
        coreServices: draft.coreServices,
        uvp: draft.uvp,
      })
      .then((allocations) => {
        if (isStale()) return;
        // analyze() returns every category including zero-percentage ones —
        // only ones the model actually found evidence for are worth showing.
        const found = allocations
          .filter((c) => c.percentage > 0)
          .sort((a, b) => b.percentage - a.percentage);
        setCategories(found);
        setSelected(found.slice(0, 2).map((c) => c.name));
        setPhase('categories');
      })
      .catch((e) => {
        if (isStale()) return;
        logApiFailure('Business analysis', e);
        setAnalyzeError(e);
        setPhase('idle');
      });
  }

  useEffect(() => {
    runAnalysis();
    // Intentionally run once on mount only — this step analyzes the draft as
    // it stood when the operator reached Step 5, not on every keystroke back
    // on Steps 2/3. Try again calls runAnalysis() directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
```

3c. In `computeUniqueness()`, temporarily point the two old `setError` calls at the new state so the file compiles. Task 5 rewrites this function. Change `setError(null);` to `setScoreError(null);` and change the catch body to:

```tsx
      .catch((e) => {
        setScoreError(e);
        setPhase('categories');
      });
```

3d. Delete the early-return block (`if (error != null) { return ( … <ApiErrorPanel … /> … ); }`, lines 182-192).

3e. Directly after the intro `<p className="body-sm" …>…</p>` paragraph, before `{phase === 'analyzing' && (`, insert:

```tsx
      {analyzeError != null && (
        <RetryNotice
          error={analyzeError}
          title="The analysis didn't finish."
          onRetry={runAnalysis}
        />
      )}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run components/module-1/onboarding/steps/AnalysisStep.test.tsx`
Expected: PASS, all tests including the four new ones.

- [ ] **Step 5: Checkpoint.** List `AnalysisStep.tsx` and `AnalysisStep.test.tsx`.

---

### Task 5: Onboarding Step 5 — retry the uniqueness score

**Files:**
- Modify: `frontend/components/module-1/onboarding/steps/AnalysisStep.tsx`
- Test: `frontend/components/module-1/onboarding/steps/AnalysisStep.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `AnalysisStep.test.tsx`, using the file's existing `reachCategories()`, `uniquenessMock` and `SCORES`:

```tsx
  describe('when the scoring model is unavailable', () => {
    const outage = new ApiError({
      status: 503,
      method: 'POST',
      path: '/api/classification/uniqueness',
      body: { code: 'ai_service_unreachable', dependency: 'fastapi-sbert' },
    });

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('keeps the category picker and shows the notice under Compute', async () => {
      await reachCategories();
      const pressedBefore = screen
        .getAllByRole('button', { pressed: true })
        .map((b) => b.textContent);
      uniquenessMock.mockRejectedValue(outage);

      fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

      expect(await screen.findByRole('alert')).toHaveTextContent("The score couldn't be computed.");
      expect(screen.getByRole('button', { name: /Compute uniqueness score/ })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toEqual(pressedBefore);
    });

    it('retries with the same categories and renders the score', async () => {
      await reachCategories();
      uniquenessMock.mockRejectedValueOnce(outage).mockResolvedValueOnce(SCORES);

      fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      expect(await screen.findByTestId('score-primary')).toBeInTheDocument();
      expect(uniquenessMock).toHaveBeenCalledTimes(2);
      expect(uniquenessMock.mock.calls[1][0].categories).toEqual(uniquenessMock.mock.calls[0][0].categories);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('clears the notice when the selection changes', async () => {
      // Three non-zero categories: only the top two start selected, so one chip is free to toggle on.
      await reachCategories([
        { name: 'Coastal & Island', percentage: 90 },
        { name: 'Adventure & Nature', percentage: 60 },
        { name: 'Culinary & Gastronomy', percentage: 30 },
      ]);
      uniquenessMock.mockRejectedValue(outage);
      fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));
      await screen.findByRole('alert');

      // Select a chip that is not yet selected, so the ≥1 rule cannot block it.
      const unpressed = screen.getAllByRole('button', { pressed: false })[0];
      fireEvent.click(unpressed);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('does not write a score into the draft', async () => {
      await reachCategories();
      uniquenessMock.mockRejectedValue(outage);
      fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));
      await screen.findByRole('alert');
      expect(latestDraft?.uniquenessScore ?? null).toBeNull();
    });
  });
```

- [ ] **Step 2: Run the tests and confirm the new ones fail**

Run: `npx vitest run components/module-1/onboarding/steps/AnalysisStep.test.tsx`
Expected: the new scoring tests FAIL, because `scoreError` is never rendered.

- [ ] **Step 3: Implement**

3a. Replace `computeUniqueness()` with:

```tsx
  function computeUniqueness() {
    setPhase('computing');
    setScoreError(null);

    apiClient.classification
      .uniqueness({
        businessName: draft.businessName,
        description: draft.description,
        coreServices: draft.coreServices,
        uvp: draft.uvp,
        categories: selected,
      })
      .then((result) => {
        if (!mounted.current) return;
        setScores(result);
        setPhase('scored');
        // Written into the draft immediately so OnboardingWizard's Finish button
        // (stepValid case 4) enables the moment this resolves. A cohort too small
        // to rank against leaves no defensible number, so none is written — the
        // flag satisfies that gate instead. See ObDraft.cohortInsufficient.
        setDraft({
          ...draft,
          categories: selected,
          uniquenessScore: result.sufficientCohort ? result.overallScore : null,
          cohortInsufficient: !result.sufficientCohort,
        });
      })
      .catch((e) => {
        if (!mounted.current) return;
        logApiFailure('Uniqueness scoring', e);
        // The picker and selection stay; the notice under Compute offers the retry.
        setScoreError(e);
        setPhase('categories');
      });
  }
```

3b. In `toggleCategory()`, directly after `setSelected(next);`, add:

```tsx
    // The failed attempt was for the old selection.
    setScoreError(null);
```

3c. In the JSX, directly after the Compute `</button>` and before the closing `</>` of the `(phase === 'categories' || …)` fragment, insert:

```tsx
          {scoreError != null && (
            <RetryNotice
              className="mt-4"
              error={scoreError}
              title="The score couldn't be computed."
              onRetry={computeUniqueness}
            />
          )}
```

- [ ] **Step 4: Run the step and wizard tests**

Run: `npx vitest run components/module-1/onboarding`
Expected: PASS, including `OnboardingWizard.test.tsx` unchanged.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit -p .`
Expected: no errors. There must be no remaining reference to `setError`, `error` or `ApiErrorPanel` in `AnalysisStep.tsx`.

- [ ] **Step 6: Checkpoint.** List `AnalysisStep.tsx` and `AnalysisStep.test.tsx`.

---

### Task 6: `forecastStore` — record where the error came from

**Files:**
- Modify: `frontend/services/forecastStore.tsx`
- Modify: `frontend/components/module-2/2.1-dashboard/useDashboardState.ts`
- Test: `frontend/components/module-2/2.1-dashboard/useDashboardState.test.ts`

- [ ] **Step 1: Write the failing tests**

1a. In `useDashboardState.test.ts`, inside the existing test `'routes a failed pipeline run into error and clears isRefreshing, without throwing'`, add after `expect(result.current.isRefreshing).toBe(false);`:

```ts
    expect(result.current.errorSource).toBe('refresh');
```

1b. Inside `describe('useDashboardState — retry', …)`, add:

```ts
  it('marks a failed load as a load error', async () => {
    setup(DEMO_CATEGORIES);
    listMock.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useDashboardState());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.errorSource).toBe('load');
  });

  it('clears errorSource once a retry succeeds', async () => {
    setup(DEMO_CATEGORIES);
    listMock.mockRejectedValueOnce(new Error('offline'));

    const { result } = renderHook(() => useDashboardState());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    listMock.mockResolvedValue(alerts());
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.errorSource).toBeNull();
  });
```

1c. At the top of the file, under the imports, silence the structured log these failures now produce:

```ts
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
```

`beforeEach` is already imported.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run components/module-2/2.1-dashboard/useDashboardState.test.ts`
Expected: the three `errorSource` assertions FAIL with `expected undefined to be 'refresh'`, `'load'` and `null`.

- [ ] **Step 3: Implement in `forecastStore.tsx`**

3a. Add the import beside the others at the top:

```tsx
import { logApiFailure } from './logApiFailure';
```

3b. In `interface ForecastEngine`, under the `error` field, add:

```tsx
  /** Where `error` came from: the load (Retry re-reads) or a Refresh run (Retry re-runs it). */
  errorSource: 'load' | 'refresh' | null;
```

3c. Under `const [refreshError, setRefreshError] = useState<unknown | null>(null);`, add:

```tsx
  const [errorSource, setErrorSource] = useState<'load' | 'refresh' | null>(null);

  // Every full-panel error goes through these two, so `error` and `errorSource`
  // can never disagree, and each failure is logged exactly once.
  const failWith = useCallback((err: unknown, source: 'load' | 'refresh') => {
    logApiFailure(source === 'refresh' ? 'Forecast refresh' : 'Dashboard load', err);
    setError(err);
    setErrorSource(source);
  }, []);
  const clearError = useCallback(() => {
    setError(null);
    setErrorSource(null);
  }, []);
```

These two must be declared **before** `readAndCommit`, which uses them. Move them above it if it is defined earlier than this point.

3d. Replace each `setError` call site:

| Where | Before | After |
| --- | --- | --- |
| `readAndCommit`, `failure === null` branch | `setError(null);` | `clearError();` |
| `readAndCommit`, no-snapshot branch | `setError(failure);` | `failWith(failure, 'load');` |
| `sync`, `ensured.notReady !== null` | `setError(ensured.notReady);` | `failWith(ensured.notReady, 'load');` |
| profile-change effect | `setError(null);` | `clearError();` |
| `refreshForecast` catch | `if (mountedRef.current) setError(err);` | `if (mountedRef.current) failWith(err, 'refresh');` |
| `loadCategory` catch | `if (mountedRef.current) setError(err);` | `if (mountedRef.current) failWith(err, 'load');` |

Add `clearError` and `failWith` to the dependency arrays of every `useCallback` that now calls them: `readAndCommit` becomes `[apply, clearError, failWith]`, `sync` gets `failWith` added, `refreshForecast` becomes `[apply, readAndCommit, failWith]`, and `loadCategory` becomes `[apply, failWith]`. Add `clearError` to the profile-change effect's dependency array.

After the edit, `grep -n "setError(" frontend/services/forecastStore.tsx` should show only the two lines inside `failWith` and `clearError`.

3e. In the returned object, add `errorSource,` after `error,`.

- [ ] **Step 4: Pass it through `useDashboardState.ts`**

In the `DashboardState` interface, under `error: unknown | null;`, add:

```ts
  /** 'refresh' when the error came from the Refresh button's pipeline run, 'load' otherwise. */
  errorSource: 'load' | 'refresh' | null;
```

In the returned object, after `error: engine.error,`, add:

```ts
    errorSource: engine.errorSource,
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npx vitest run components/module-2/2.1-dashboard/useDashboardState.test.ts services/forecastStore.test.tsx`
Expected: PASS. If `forecastStore.test.tsx` builds a literal `ForecastEngine` object, add `errorSource: null` to it.

- [ ] **Step 6: Checkpoint.** List `forecastStore.tsx`, `useDashboardState.ts` and `useDashboardState.test.ts`.

---

### Task 7: Dashboard — `RetryNotice` and the overlap fix

**Files:**
- Modify: `frontend/components/module-2/2.1-dashboard/DashboardView.tsx:29,167-171`
- Modify: `frontend/styles/dashboard.css` (after the `.dash-screen .stat-row` rule, around line 1069)
- Test: `frontend/components/module-2/2.1-dashboard/DashboardView.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `DashboardView.test.tsx`. Add `ApiError` and `RETRY_COPY` imports at the top, and an `analyzeMock` handle beside the others:

```tsx
import { ApiError } from '../../../services/apiError';
import { RETRY_COPY } from '../../shared/RetryNotice';
```

```tsx
const analyzeMock = apiClient.forecast.analyze as unknown as ReturnType<typeof vi.fn>;
```

Then:

```tsx
describe('DashboardView — model unavailable', () => {
  const zeroGpu = new ApiError({
    status: 503,
    method: 'POST',
    path: '/api/forecasting/analyze',
    body: {
      code: 'MOD22_BILSTM_UNAVAILABLE',
      message: 'The BiLSTM + Transformer demand model is unavailable.',
      dependency: 'bilstm',
      cause: 'inference failed for KR/coastal_island: You have exceeded your ZeroGPU runs limit.',
    },
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('a failed Refresh shows the forecast notice, and Try again re-runs the forecast', async () => {
    const user = userEvent.setup();
    analyzeMock.mockRejectedValueOnce(new ApiError({ status: 503, method: 'POST', path: '/api/forecasting/analyze' }));
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /Refresh forecast/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("The forecast didn't update.");
    expect(alert).toHaveTextContent(RETRY_COPY.retry);
    expect(alert).not.toHaveTextContent('/api/forecasting/analyze');

    analyzeMock.mockResolvedValueOnce({ markets: [] });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(2));
  });

  it('a quota failure asks the operator to wait', async () => {
    const user = userEvent.setup();
    analyzeMock.mockRejectedValueOnce(zeroGpu);
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /Refresh forecast/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(RETRY_COPY.wait);
  });

  it('a failed load shows the load notice, and Try again re-reads without running the forecast', async () => {
    const user = userEvent.setup();
    listMock.mockRejectedValueOnce(new Error('offline'));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent("Your dashboard didn't load.");
    const listCalls = listMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(listCalls));
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('an unfinished profile keeps the "Complete onboarding first" guidance', async () => {
    ensureMock.mockRejectedValueOnce(
      new ApiError({ status: 409, method: 'POST', path: '/api/forecasting/ensure', body: { code: 'MOD22_PROFILE_NOT_READY' } }),
    );
    renderDashboard();

    expect(await screen.findByText('Complete onboarding first')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run components/module-2/2.1-dashboard/DashboardView.test.tsx`
Expected: the first three new tests FAIL, because "The forecast didn't update." / "Your dashboard didn't load." are not found. The 409 test may already pass; that is fine.

- [ ] **Step 3: Implement in `DashboardView.tsx`**

3a. Next to the `ApiErrorPanel` import (line 29), add:

```tsx
import { RetryNotice } from '../../shared/RetryNotice';
import { isProfileNotReady } from '../../../services/apiError';
```

If `apiError` is already imported in this file, add `isProfileNotReady` to that import instead.

3b. Replace the comment and the line `{state.error != null && <ApiErrorPanel error={state.error} label="Dashboard" onRetry={state.retry} />}` (lines 167-171) with:

```tsx
      {/* Load errors retry the load only — never the forecast pipeline (Step 17,
          C-19/C-20: a stuck "no data yet" error used to start a full pipeline run
          on every retry). A failed Refresh is different: the operator asked for
          that run, so Try again re-runs it. An unfinished profile keeps the
          panel's onboarding guidance; retrying cannot fix it. */}
      {state.error != null &&
        (isProfileNotReady(state.error) ? (
          <ApiErrorPanel error={state.error} label="Dashboard" />
        ) : state.errorSource === 'refresh' ? (
          <RetryNotice
            className="dash-notice"
            error={state.error}
            title="The forecast didn't update."
            onRetry={() => void state.refresh()}
            busy={state.isRefreshing}
          />
        ) : (
          <RetryNotice
            className="dash-notice"
            error={state.error}
            title="Your dashboard didn't load."
            onRetry={() => void state.retry()}
            busy={state.syncing}
          />
        ))}
```

- [ ] **Step 4: Fix the overlap in `styles/dashboard.css`**

Directly after the `.dash-screen .stat-row { … margin: -72px 0 20px; … }` rule (around line 1064-1069), inside the same `@layer components` block, add:

```css
  /* The tiles tuck 72px up into the hero. With a notice in between they would
     cover its last lines instead, so they sit in normal flow below it. */
  .dash-screen .dash-notice {
    margin-bottom: 20px;
  }
  .dash-screen .dash-notice ~ .stat-row {
    margin-top: 0;
  }
```

This relies on `.dash-notice` and `SignalSummary`'s `.stat-row` being siblings under `.dash-screen`: `DashboardView.tsx` renders the notice, `AiStatusBanner` and `SignalSummary` at the same level, and `SignalSummary` returns the `.stat-row` div directly. Confirm in DevTools in Task 9.

- [ ] **Step 5: Run the dashboard tests**

Run: `npx vitest run components/module-2/2.1-dashboard`
Expected: PASS.

- [ ] **Step 6: Checkpoint.** List `DashboardView.tsx`, `DashboardView.test.tsx` and `styles/dashboard.css`.

---

### Task 8: E2E and docs

**Files:**
- Modify: `e2e/tests/onboarding/analysis.spec.ts` (the `'an AI outage shows the dependency error panel…'` test, around line 256)
- Modify: `docs/module-1/screens/onboarding-wizard.md` (section `### 5 — Analysis`)
- Modify: `docs/module-2/screens/dashboard.md` (section `## States`)

- [ ] **Step 1: Update the e2e test**

Replace the whole `test('an AI outage shows the dependency error panel with no fake categories', …)` block with the version below. Leave the existing route stub unchanged.

```ts
  test('an AI outage shows a retry notice with no fake categories, and Try again recovers', async ({ page }) => {
    const op = await provisionOperator('onb-ai-down', { stage: 'verified' });
    let down = true;
    await page.route('**/api/classification/analyze', (route) =>
      down
        ? route.fulfill({ status: 503, json: { error: 'huggingface_space is unavailable' } })
        : route.fallback(),
    );
    await signIn(page, op, '/onboarding');
    await reachAnalysis(page);

    await expect(page.getByRole('alert')).toContainText("The analysis didn't finish.");
    await expect(categoryChips(page)).toHaveCount(0);
    await expect(finish(page)).toBeDisabled();

    down = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(categoryChips(page).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
```

`route.fallback()` lets the request reach the real backend. The recovery assertion therefore needs the e2e stack to have a working classifier, as the other tests in this file already assume.

- [ ] **Step 2: Update `docs/module-1/screens/onboarding-wizard.md`**

In `### 5 — Analysis`, after item 3 and before `**Gate to finish:**`, add:

```markdown
**When a model call fails.** Neither call shows `ApiErrorPanel`. A failed `analyze` keeps the step
heading and shows a `RetryNotice` ("The analysis didn't finish.") where the loader was; **Try again**
re-runs the analysis. A failed `uniqueness` keeps the category picker and selection and shows the
notice ("The score couldn't be computed.") under Compute; **Try again** re-scores the same selection,
and changing the selection clears it. Quota failures (429, a `*QUOTA*`/`*RATE_LIMIT*` code, or quota
wording in `cause`) ask the operator to wait a while instead. The request, status, code and cause go to
the browser console as `[CeView] Business analysis failed` / `[CeView] Uniqueness scoring failed`.
Components: `components/shared/RetryNotice.tsx`, `services/retryAdvice.ts`, `services/logApiFailure.ts`.
```

- [ ] **Step 3: Update `docs/module-2/screens/dashboard.md`**

Add these rows to the end of the `## States` table:

```markdown
| `error`, from Refresh | `POST /api/forecasting/analyze` failed (`errorSource: 'refresh'`) | `RetryNotice` "The forecast didn't update." — **Try again** re-runs the forecast pipeline |
| `error`, from load | the initial read failed with nothing cached (`errorSource: 'load'`) | `RetryNotice` "Your dashboard didn't load." — **Try again** re-reads only, never runs the pipeline |
| `error`, profile not ready | 409 / `MOD22_PROFILE_NOT_READY` | `ApiErrorPanel` "Complete onboarding first" (no retry) |
```

Under the table, add:

```markdown
Quota failures, such as the BiLSTM Space's "exceeded your ZeroGPU runs limit", which arrives as
`MOD22_BILSTM_UNAVAILABLE` with the quota text only in `cause`, show "wait a while" copy instead of
"try again". Details are logged to the console as `[CeView] Forecast refresh failed` /
`[CeView] Dashboard load failed`.
```

- [ ] **Step 4: Checkpoint.** List the e2e spec and the two docs.

---

### Task 9: Full verification

- [ ] **Step 1: Run the frontend unit suite**

Run (from `frontend/`): `npx vitest run`
Expected: PASS, all files.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit -p .` and then `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the e2e spec**

The Docker stack must be up (`cd backend && docker compose up -d`). See `RUNNING.md` §8 for e2e prerequisites.

Run (from the repo root): `npx playwright test e2e/tests/onboarding/analysis.spec.ts`
Expected: PASS.

- [ ] **Step 4: Visual check**

1. In DevTools, block `**/api/forecasting/analyze` and click **Refresh forecast** on `http://localhost:3001/dashboard`.
2. Confirm "The forecast didn't update." shows with a Try again button.
3. Confirm the KPI tiles sit **below** the notice and don't overlap it.
4. Confirm the console shows `[CeView] Forecast refresh failed {…}`.
5. Repeat on onboarding Step 5 by blocking `**/api/classification/analyze`.

- [ ] **Step 5: Final checkpoint.** Report the results with real command output, and list every changed file for the user to commit.
