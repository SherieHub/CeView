# First-Login Tutorial Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every new operator a 4-step, skippable tutorial modal the first time they land on `/dashboard` after finishing onboarding, explaining Dashboard, Content Studio, Calendar, and Performance — plus a "Replay tour" link in Settings → Workspace to reopen it later.

**Architecture:** A presentational `TutorialModal` (shared, wraps the existing `Modal`) owns the 4-slide carousel. A small `useJustOnboardedTutorial` hook owns the one-shot trigger logic (reads router navigation state set by `OnboardingWizard`, opens the modal, then scrubs the state so it can't re-fire on refresh/back-nav) — kept out of `DashboardView` itself so it's unit-testable without mounting the whole dashboard. `WorkspaceSettings` opens the same `TutorialModal` from its own local `open` state for the replay entry point.

**Tech Stack:** React 19 + TypeScript, react-router-dom (`useLocation`/`useNavigate`), Vitest + Testing Library, lucide-react icons, existing `Modal`/`OverlayStackProvider` shared components.

**Spec:** `docs/superpowers/specs/2026-09-10-first-login-tutorial-modal-design.md`

---

## Task 1: `TutorialModal` component

**Files:**
- Create: `frontend/components/shared/TutorialModal.tsx`
- Test: `frontend/components/shared/TutorialModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/shared/TutorialModal.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TutorialModal from './TutorialModal';
import { OverlayStackProvider } from './useOverlayStack';

function renderModal(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <OverlayStackProvider>
        <TutorialModal open onClose={onClose} />
      </OverlayStackProvider>,
    ),
  };
}

describe('TutorialModal', () => {
  it('opens on the Dashboard slide with no Back button', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
  });

  it('steps forward through all 4 slides with Next, then Back retreats', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Content Studio' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Performance' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Calendar' })).toBeInTheDocument();
  });

  it('shows "Get started" instead of "Next" on the last slide, and it closes the modal', () => {
    const { onClose } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Get started' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('"Skip tour" closes the modal from the first slide', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("the modal's own close button also closes it", () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/shared/TutorialModal.test.tsx`
Expected: FAIL — `Cannot find module './TutorialModal'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```tsx
// frontend/components/shared/TutorialModal.tsx
/**
 * First-login tutorial — a 4-slide carousel explaining the app's main tabs
 * (Dashboard, Content Studio, Calendar, Performance). Opened once by
 * useJustOnboardedTutorial right after onboarding finishes, and reopenable
 * any time via WorkspaceSettings' "Replay tour" link.
 *
 * Purely presentational: no fetches, no router/profile access. Wraps the
 * shared Modal for its dialog chrome (Escape/scrim dismiss, overlay stack).
 */
import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Sparkles, CalendarDays, TrendingUp } from 'lucide-react';
import Modal from './Modal';

interface TutorialModalProps {
  open: boolean;
  onClose: () => void;
}

interface Slide {
  icon: LucideIcon;
  title: string;
  body: string;
}

// Same icons as the sidebar's Dashboard/Content Studio/Calendar/Performance
// rows (frontend/layout/nav.ts) so the tour visually matches the nav it's
// explaining.
const SLIDES: Slide[] = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    body: 'Your alert command center. See surge alerts the moment CeView forecasts a spike in travelers from your tracked markets, scoped to your business categories — so you know when demand is coming before it arrives.',
  },
  {
    icon: Sparkles,
    title: 'Content Studio',
    body: 'Turn a surge alert into ready-to-post content. Generate market-localized captions and visual direction, get them checked for compliance, and publish straight to your connected platforms.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar',
    body: "See what's scheduled and when. Track every piece of content you've queued or published, so your posting stays consistent around each surge.",
  },
  {
    icon: TrendingUp,
    title: 'Performance',
    body: 'Know what worked. Feed in your campaign results and get KPIs, a funnel breakdown, and an AI-generated report that tells you exactly what to fix next.',
  },
];

export default function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);
  const isFirst = step === 0;
  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];
  const Icon = slide.icon;

  return (
    <Modal open={open} onClose={onClose} label="Welcome tour">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <Icon
          size={48}
          strokeWidth={1.5}
          aria-hidden="true"
          className="text-[var(--color-navy-primary)]"
        />
        <h2 className="heading-md">{slide.title}</h2>
        <p className="body-sm max-w-sm">{slide.body}</p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <span
            key={s.title}
            className={`h-2 w-2 rounded-full ${
              i === step ? 'bg-[var(--color-navy-primary)]' : 'bg-[var(--color-gray-light)]'
            }`}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          className="body-sm text-[var(--color-text-muted)] underline"
          onClick={onClose}
        >
          Skip tour
        </button>
        <div className="flex items-center gap-3">
          {!isFirst && (
            <button type="button" className="btn-outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="btn-cta"
            onClick={() => (isLast ? onClose() : setStep((s) => s + 1))}
          >
            {isLast ? 'Get started' : 'Next'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run components/shared/TutorialModal.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/shared/TutorialModal.tsx frontend/components/shared/TutorialModal.test.tsx
git commit -m "feat(shared): add TutorialModal 4-slide onboarding tour"
```

---

## Task 2: `useJustOnboardedTutorial` hook

**Files:**
- Create: `frontend/components/module-2/2.1-dashboard/useJustOnboardedTutorial.ts`
- Test: `frontend/components/module-2/2.1-dashboard/useJustOnboardedTutorial.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/module-2/2.1-dashboard/useJustOnboardedTutorial.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useJustOnboardedTutorial } from './useJustOnboardedTutorial';

function Harness() {
  const { open, close } = useJustOnboardedTutorial();
  const location = useLocation();
  return (
    <div>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="state">{JSON.stringify(location.state)}</span>
      <button onClick={close}>close</button>
    </div>
  );
}

function renderAt(initialEntries: Parameters<typeof MemoryRouter>[0]['initialEntries']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/dashboard" element={<Harness />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('useJustOnboardedTutorial', () => {
  it('opens when arriving with justOnboarded navigation state, then scrubs the state', () => {
    renderAt([{ pathname: '/dashboard', state: { justOnboarded: true } }]);

    expect(screen.getByTestId('open').textContent).toBe('true');
    expect(screen.getByTestId('state').textContent).toBe('{}');
  });

  it('stays closed when there is no justOnboarded state', () => {
    renderAt(['/dashboard']);
    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('close() flips open back to false', () => {
    renderAt([{ pathname: '/dashboard', state: { justOnboarded: true } }]);
    expect(screen.getByTestId('open').textContent).toBe('true');

    screen.getByText('close').click();
    expect(screen.getByTestId('open').textContent).toBe('false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/module-2/2.1-dashboard/useJustOnboardedTutorial.test.tsx`
Expected: FAIL — `Cannot find module './useJustOnboardedTutorial'`.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/components/module-2/2.1-dashboard/useJustOnboardedTutorial.ts
/**
 * One-shot trigger for TutorialModal: OnboardingWizard.handleFinish()
 * navigates to /dashboard with { state: { justOnboarded: true } }. On mount
 * here, that flag opens the tutorial and is immediately scrubbed from
 * history (replaced with an empty state object) so a refresh or Back
 * navigation to this same /dashboard entry never re-opens it.
 *
 * Kept as its own hook, separate from DashboardView, so the trigger logic is
 * unit-testable without mounting the whole dashboard (profile context,
 * dashboard state machine, child panels, etc).
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface JustOnboardedState {
  justOnboarded?: boolean;
}

export function useJustOnboardedTutorial() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const state = location.state as JustOnboardedState | null;
    if (state?.justOnboarded) {
      setOpen(true);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
    }
    // Only ever checked against the location this hook first mounted with —
    // an empty deps array is intentional, not a missed dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { open, close: () => setOpen(false) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run components/module-2/2.1-dashboard/useJustOnboardedTutorial.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-2/2.1-dashboard/useJustOnboardedTutorial.ts frontend/components/module-2/2.1-dashboard/useJustOnboardedTutorial.test.tsx
git commit -m "feat(dashboard): add useJustOnboardedTutorial one-shot trigger hook"
```

---

## Task 3: Wire the hook and modal into the real flow

**Files:**
- Modify: `frontend/components/module-1/onboarding/OnboardingWizard.tsx:86`
- Modify: `frontend/components/module-2/2.1-dashboard/DashboardView.tsx`
- Modify: `frontend/components/module-1/onboarding/OnboardingWizard.test.tsx` (extend existing "persists ... and navigates to /dashboard on Finish" test)

- [ ] **Step 1: Extend the existing OnboardingWizard test to assert the navigation state**

In `frontend/components/module-1/onboarding/OnboardingWizard.test.tsx`, the `/dashboard` route element currently renders a plain `<div>Dashboard</div>` (line 87), which can't see navigation state. Change that route element to also render the location's state, and extend the final `it(...)` block's assertions:

```tsx
// Replace this route element (around line 87):
          <Route path="/dashboard" element={<div>Dashboard</div>} />
// with one that surfaces location.state for the assertion below:
          <Route
            path="/dashboard"
            element={<DashboardStub />}
          />
```

Add this helper above `renderWizard`:

```tsx
function DashboardStub() {
  const location = useLocation();
  return (
    <div>
      Dashboard
      <span data-testid="nav-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}
```

Add `useLocation` to the existing `react-router-dom` import (line 20):

```tsx
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
```

Then extend the final test (`'persists with the 0-1 scale conversion and navigates to /dashboard on Finish'`) with one more assertion, right after the existing `await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());` line:

```tsx
    expect(screen.getByTestId('nav-state').textContent).toBe('{"justOnboarded":true}');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/module-1/onboarding/OnboardingWizard.test.tsx`
Expected: FAIL on the new assertion — `nav-state` is `undefined`/empty because `handleFinish` still calls a plain `navigate('/dashboard')`.

- [ ] **Step 3: Update `handleFinish` to pass the navigation state**

In `frontend/components/module-1/onboarding/OnboardingWizard.tsx`, change line 86:

```tsx
      navigate('/dashboard');
```

to:

```tsx
      navigate('/dashboard', { state: { justOnboarded: true } });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run components/module-1/onboarding/OnboardingWizard.test.tsx`
Expected: PASS (all tests, including the extended one).

- [ ] **Step 5: Wire the hook and modal into `DashboardView`**

In `frontend/components/module-2/2.1-dashboard/DashboardView.tsx`, add the import (alongside the existing `MarketRadarDrawer` import):

```tsx
import { useJustOnboardedTutorial } from './useJustOnboardedTutorial';
import TutorialModal from '../../shared/TutorialModal';
```

Inside the component body, alongside the other hooks (after `const { setTarget } = useTargetSelection();`):

```tsx
  const tutorial = useJustOnboardedTutorial();
```

At the end of the JSX, immediately after the closing `<MarketRadarDrawer ... />` and before the outer `</div>`:

```tsx
      <TutorialModal open={tutorial.open} onClose={tutorial.close} />
```

- [ ] **Step 6: Manually verify the wiring**

This step has no automated test — `DashboardView` requires mocking the full dashboard state machine, profile context and target selection store to render in isolation, which is disproportionate for a two-line wiring change already covered by Task 1 (`TutorialModal` behavior) and Task 2 (`useJustOnboardedTutorial` trigger logic) in unit tests.

Run: `cd frontend && npm run dev`, sign in as a fresh/demo operator, complete onboarding through Finish, and confirm the tutorial modal opens on `/dashboard` showing the Dashboard slide. Refresh the page and confirm it does NOT reopen.

- [ ] **Step 7: Run the full frontend test suite to check nothing else broke**

Run: `cd frontend && npx vitest run`
Expected: PASS (no regressions).

- [ ] **Step 8: Commit**

```bash
git add frontend/components/module-1/onboarding/OnboardingWizard.tsx frontend/components/module-1/onboarding/OnboardingWizard.test.tsx frontend/components/module-2/2.1-dashboard/DashboardView.tsx
git commit -m "feat(dashboard): open TutorialModal once, right after onboarding finishes"
```

---

## Task 4: "Replay tour" link in Settings → Workspace

**Files:**
- Modify: `frontend/components/settings/WorkspaceSettings.tsx`
- Modify: `frontend/components/settings/WorkspaceSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `frontend/components/settings/WorkspaceSettings.test.tsx`, inside the existing `describe('WorkspaceSettings', ...)` block:

```tsx
  it('"Replay tour" opens the tutorial modal, and it can be closed again', async () => {
    renderSettings();
    await screen.findByText('Maria Lopez');

    fireEvent.click(screen.getByRole('button', { name: /replay tour/i }));
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skip tour' }));
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });
```

`TutorialModal` renders via the shared `Modal`, which needs `OverlayStackProvider` in its render tree. Update this test file's `renderSettings` helper to add that provider:

```tsx
import { OverlayStackProvider } from '../shared/useOverlayStack';

function renderSettings() {
  return render(
    <OverlayStackProvider>
      <ToastProvider>
        <WorkspaceSettings />
      </ToastProvider>
    </OverlayStackProvider>,
  );
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run components/settings/WorkspaceSettings.test.tsx`
Expected: FAIL — no "Replay tour" button exists yet.

- [ ] **Step 3: Add the control and modal to `WorkspaceSettings`**

`useState` is already imported on line 15 (`import { useEffect, useState } from 'react';`), so no import change is needed for it. Add the `TutorialModal` import alongside the existing ones:

```tsx
import TutorialModal from '../shared/TutorialModal';
```

Inside `WorkspaceSettings`, add local state (alongside the existing `email`/`role` state):

```tsx
  const [tourOpen, setTourOpen] = useState(false);
```

Change the heading block (currently lines 80–82) to put the new control on the same row as the heading:

```tsx
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="heading-lg mb-1">Workspace members</h2>
          <p className="body-sm">Everyone here shares this business profile and its connected platforms.</p>
        </div>
        <button type="button" className="btn-outline" onClick={() => setTourOpen(true)}>
          Replay tour
        </button>
      </div>
```

(This replaces the existing `<h2 className="heading-lg mb-1">Workspace members</h2>` and `<p className="body-sm mb-5">...</p>` lines — the `mb-5` spacing moves onto the new wrapping `div`.)

At the end of the component's returned JSX, immediately before the closing `</div>` of the outer `card p-6` container:

```tsx
      <TutorialModal open={tourOpen} onClose={() => setTourOpen(false)} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run components/settings/WorkspaceSettings.test.tsx`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend && npx vitest run`
Expected: PASS (no regressions).

- [ ] **Step 6: Commit**

```bash
git add frontend/components/settings/WorkspaceSettings.tsx frontend/components/settings/WorkspaceSettings.test.tsx
git commit -m "feat(settings): add Replay tour link to Workspace settings"
```

---

## Done criteria

- A brand-new operator finishing onboarding sees the 4-slide tutorial once, automatically, on their first `/dashboard` load.
- Refreshing `/dashboard` afterward never reopens it.
- The tutorial is skippable at any step (X, Escape, scrim click, or "Skip tour").
- Settings → Workspace has a "Replay tour" control that reopens the same modal on demand, any time.
- `cd frontend && npx vitest run` passes in full.
