# Content Studio — Linear Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/content` (Module 3.1) from a two-column master/detail workspace into a centred, single-column, step-by-step journey with a slide-out campaign-brief drawer, progressive disclosure of the Publish action, and a dark full-screen publishing modal with per-platform device previews.

**Architecture:** The screen becomes one narrow centred column (`--studio-measure`, 760px) with a sticky numbered step rail in the left margin driven by an IntersectionObserver scroll-spy. Reference material that is not part of the linear flow (Copywriting Matrix rationale, Moodboard) moves out of the column into a right-hand `Drawer`, reusing the existing shared overlay stack. Publishing moves out of the page entirely into a dark full-screen modal built on brand chrome tokens, with a split control/preview layout.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind v4 (`@theme` tokens in `frontend/styles/index.css`), Vitest + @testing-library/react, lucide-react icons.

---

## Repo rules that apply to every task

- **Claude must never run `git commit` or `git push` in this repo** (`.claude/CLAUDE.md`). The commit steps below are written for a human operator. If an agent is executing this plan, it must stop at each commit step and hand back.
- All Module 3 code lives under `frontend/components/module-3/3.1-content-studio/`. All styling lives in `frontend/styles/index.css` — this codebase uses semantic classes in `@layer components`, **not** inline Tailwind utility soup. Follow the existing `CONTENT STUDIO` block.
- Consult `.claude/skills/tourism-app-branding/SKILL.md` before writing any CSS. Never hardcode a hex outside `@theme`.
- Test command is `npx vitest run <path>` from `frontend/`. Typecheck is `npx tsc --noEmit` from `frontend/`.
- `frontend/components/module-3/3.2-calendar/CalendarView.tsx:61` has a **pre-existing** `COLORS.GOLD` type error. `npx tsc --noEmit` will always report exactly that one error. Any *other* error is yours.
- The full suite has **3 pre-existing failures** in `services/auth.test.tsx` and `components/auth/CompleteProfilePage.test.tsx`. Baseline is `347 passed | 3 failed`.

---

## What this plan retires

Delete these once their replacements land. They are the current two-column architecture and exist only to serve it.

| Retired | Location | Replaced by |
|---|---|---|
| `.studio-grid`, `.studio-col`, `.studio-rail` (incl. sticky, `max-height`, scrollbar styling) | `frontend/styles/index.css` CONTENT STUDIO block | `.studio-flow` (Task 2) |
| `.studio-board` top margin rule | same | `.studio-flow` gap |
| Right-rail composition in `ContentStudioView` | `ContentStudioView.tsx` | Task 3 |
| Per-card `<textarea>`, Copy and Approve buttons in `CaptionOptionCard` | `AIContentMatrixPanel.tsx` | `CaptionOptionGrid` Select (Task 10) |
| Auto-run audit effect (fires when `agreementChecked` flips) | `CompliancePanel.tsx:15-18` | Explicit Run button (Task 13) |
| Platform picker, visibility, comments, paid-partnership, agreement checkbox | `PublishComposer.tsx` | `PublishModal` left panel (Task 17) |

**Note for the reviewer:** Phases 1–4 deliberately remove the reserved 420px rail, the sticky behaviour, and the 3fr/1fr split added in the preceding week. That is intended — this spec supersedes them.

---

## File structure

**Create:**

| File | Responsibility |
|---|---|
| `frontend/components/module-3/3.1-content-studio/studioSteps.ts` | The single source of truth for the step list (id, number, label, section id). Imported by the rail and by the sections. |
| `frontend/components/module-3/3.1-content-studio/useStepProgress.ts` | IntersectionObserver scroll-spy → currently-active step id. |
| `frontend/components/module-3/3.1-content-studio/StudioStepRail.tsx` | The floating numbered indicators in the left margin. |
| `frontend/components/module-3/3.1-content-studio/CampaignBriefDrawer.tsx` | Slide-out reference drawer; hosts Moodboard + Copywriting Matrix rationale. |
| `frontend/components/module-3/3.1-content-studio/useFirstRunDrawer.ts` | FTUE: localStorage flag, auto-open once, tooltip visibility. |
| `frontend/components/module-3/3.1-content-studio/CaptionOptionGrid.tsx` | 1×3 caption selection grid with truncation + Expand + Select. |
| `frontend/components/module-3/3.1-content-studio/ShotListAccordion.tsx` | Collapsed "Review Shot List & Visual Direction" accordion above the media block. |
| `frontend/components/module-3/3.1-content-studio/platformPreview.ts` | Per-platform preview specs (aspect ratio, caption cutoff, chrome kind). |
| `frontend/components/module-3/3.1-content-studio/PhonePreview.tsx` | Stylised smartphone bezel rendering one platform's treatment. |
| `frontend/components/module-3/3.1-content-studio/PublishModal.tsx` | Dark full-screen split-panel publishing modal. |

**Modify:** `ContentStudioView.tsx`, `AIContentMatrixPanel.tsx`, `PublishComposer.tsx`, `CompliancePanel.tsx`, `VisualDirectionBoard.tsx`, `contentStudioTypes.ts`, `previewFixtures.ts`, `frontend/styles/index.css`, `frontend/components/shared/Modal.tsx`.

---

## Facts you will need (verified against the codebase)

- `PLATFORM_CHAR_LIMITS` is exported from `AIContentMatrixPanel.tsx`: instagram 2200, tiktok 300, facebook 500, naver 5000.
- **`MOCK_CONTENT.captions.naver` has only 2 options and `optionMetadata: []`.** The 3-column grid must render 2 cards without collapsing. Do not assume 3.
- **Instagram/TikTok/Facebook each ship 3 options WITH full `optionMetadata`.** Any drawer or panel that renders per-option rationale therefore repeats each of the five REASON_FIELDS labels three times — assert with `getAllByText(...).toHaveLength(3)`, never `getByText`, which throws on multiple matches.
- Caption fold points are documented in `MOCK_CONTENT`'s own metadata: Instagram "hook lands inside the first 125 characters before the fold"; Facebook "hook inside ~250 chars"; TikTok "the entire caption is the hook because TikTok shows no fold". These are the numbers `platformPreview.ts` uses.
- `components/shared/Drawer.tsx` already provides: right-side 560px panel, overlay-stack push/pop, Escape + scrim close, optional `footer`. **Reuse it. Do not write a second drawer.**
- `useOverlayStack` (`components/shared/useOverlayStack.tsx`) provides `push`/`pop`/`dismissTop`/`isOpen`, body scroll lock, and Escape handling. `AppShell` renders the shared `#scrim`.
- `components/shared/Modal.tsx` is a 520px centred white panel. Phase 5 needs a full-screen dark variant — Task 16 adds a `variant` prop rather than forking the component.
- localStorage precedent is `AppShell.tsx`'s `ceview.sidebarCollapsed`, always wrapped in try/catch (private mode throws). Follow it.
- Brand dark-surface tokens already exist: `--gradient-chrome`, `--color-chrome-deep`, `--color-chrome-light`, `--chrome-raised`, `--chrome-line`, `--color-text-inverse`, `--color-text-inverse-muted`. **Phase 5 uses these — do not invent a grey palette.**
- `.studio-screen` overrides `--color-text-muted` to `#63707F` for AA contrast. Keep that override on the new root.

---

# Phase 1 — Workspace Architecture & Navigation

### Task 1: Step definitions

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/studioSteps.ts`
- Test: `frontend/components/module-3/3.1-content-studio/studioSteps.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { STUDIO_STEPS } from './studioSteps';

describe('STUDIO_STEPS', () => {
  it('numbers the steps from 1 with unique ids and DOM-safe section ids', () => {
    expect(STUDIO_STEPS.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(STUDIO_STEPS.map((s) => s.label)).toEqual(['Draft', 'Attach', 'Validate']);

    const ids = STUDIO_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    STUDIO_STEPS.forEach((s) => {
      expect(s.sectionId).toMatch(/^studio-step-[a-z]+$/);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/studioSteps.test.ts`
Expected: FAIL — `Failed to resolve import "./studioSteps"`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * The linear journey's steps — one source of truth shared by the left-margin
 * rail (StudioStepRail) and the sections themselves, so a heading and its
 * indicator can never drift apart.
 *
 * `sectionId` is the DOM id the section element carries; the rail's
 * scroll-spy observes those nodes and its links target them.
 */
export interface StudioStep {
  id: 'draft' | 'attach' | 'validate';
  number: number;
  label: string;
  sectionId: string;
}

export const STUDIO_STEPS: StudioStep[] = [
  { id: 'draft', number: 1, label: 'Draft', sectionId: 'studio-step-draft' },
  { id: 'attach', number: 2, label: 'Attach', sectionId: 'studio-step-attach' },
  { id: 'validate', number: 3, label: 'Validate', sectionId: 'studio-step-validate' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/studioSteps.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/studioSteps.ts frontend/components/module-3/3.1-content-studio/studioSteps.test.ts
git commit -m "feat(module-3): add studio step definitions"
```

---

### Task 2: Single-column layout CSS

**Files:**
- Modify: `frontend/styles/index.css` (CONTENT STUDIO block — replace `.studio-grid` / `.studio-col` / `.studio-rail`)

- [ ] **Step 1: Delete the retired two-column rules**

In the `CONTENT STUDIO` block, delete every rule whose selector is `.studio-grid`, `.studio-col`, `.studio-rail`, `.studio-rail::-webkit-scrollbar*`, and the `.studio-board { margin-top }` rule, **including** the `@media (min-width: 1280px)` block that sets `grid-template-columns: minmax(0, 3fr) minmax(300px, 1fr)` and the sticky rail. Keep `.studio-screen`, `.studio-head*`, `.studio-note*`, `.studio-aside`, `.studio-block`, `.studio-list*`, `.cap-*`, `.audit-*`, `.omcs-*`, `.plat-*`, `.media-*`, `.composer-*`, `.post-*`.

- [ ] **Step 2: Add the linear-flow layout**

Add at the top of the CONTENT STUDIO block, directly after `.studio-screen`:

```css
  /* LINEAR WORKSPACE.
     One centred column, not a master/detail grid. The journey is
     draft -> attach -> validate -> publish, and a second column invited the
     operator to work two steps at once. --studio-measure is wider than §5's
     880px prose cap because the caption grid needs three cards abreast, and
     narrower than --content-max because a single column of form controls at
     1440px is unusable.

     The rail lives in the left margin via padding on the flow, NOT as a grid
     track: a track would recentre the column every time the rail appeared or
     collapsed. */
  .studio-flow {
    --studio-measure: 760px;
    --studio-rail-w: 132px;
    display: grid;
    gap: var(--space-lg);
    max-width: var(--studio-measure);
    margin-inline: auto;
    position: relative;
  }
  @media (min-width: 1280px) {
    .studio-flow {
      /* Shifts the column right by half the rail so the COLUMN stays optically
         centred in the canvas once the rail occupies the margin beside it. */
      margin-inline: auto;
      padding-left: 0;
      transform: translateX(calc(var(--studio-rail-w) / 2));
    }
  }
  /* Each numbered section is a scroll target for the rail. scroll-margin-top
     clears the sticky topbar, otherwise an anchored heading lands underneath
     it. */
  .studio-section {
    scroll-margin-top: calc(var(--topbar-h) + var(--space-md));
  }
```

- [ ] **Step 3: Verify the stylesheet still compiles**

Run: `npx vite build`
Expected: `✓ built in …`, no CSS error.

- [ ] **Step 4: Confirm the retired rules are gone from the bundle**

Run: `grep -c "studio-rail" dist/assets/index-*.css || echo "0 — retired"`
Expected: `0 — retired`

- [ ] **Step 5: Commit**

```bash
git add frontend/styles/index.css
git commit -m "refactor(module-3): replace two-column studio grid with linear flow"
```

---

### Task 3: Scroll-spy hook

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/useStepProgress.ts`
- Test: `frontend/components/module-3/3.1-content-studio/useStepProgress.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useStepProgress } from './useStepProgress';
import { STUDIO_STEPS } from './studioSteps';

// jsdom has no IntersectionObserver. Capture the callback so the test can
// drive intersection directly — this is the only way to assert scroll-spy
// behaviour without a real layout engine.
let trigger: (entries: Partial<IntersectionObserverEntry>[]) => void;

beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: (e: IntersectionObserverEntry[]) => void) {
        trigger = (entries) => cb(entries as IntersectionObserverEntry[]);
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

function Probe() {
  const active = useStepProgress();
  return <span data-testid="active">{active}</span>;
}

describe('useStepProgress', () => {
  it('starts on the first step and follows the most-visible section', () => {
    STUDIO_STEPS.forEach((s) => {
      const el = document.createElement('section');
      el.id = s.sectionId;
      document.body.appendChild(el);
    });

    render(<Probe />);
    expect(screen.getByTestId('active')).toHaveTextContent('draft');

    act(() => {
      trigger([
        { target: document.getElementById('studio-step-draft')!, isIntersecting: false, intersectionRatio: 0 },
        { target: document.getElementById('studio-step-attach')!, isIntersecting: true, intersectionRatio: 0.9 },
      ]);
    });
    expect(screen.getByTestId('active')).toHaveTextContent('attach');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/useStepProgress.test.tsx`
Expected: FAIL — `Failed to resolve import "./useStepProgress"`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Scroll-spy for the step rail: reports which studio section currently owns
 * the viewport.
 *
 * IntersectionObserver rather than a scroll listener — a scroll handler would
 * run on every frame and still need getBoundingClientRect per section, which
 * is exactly the layout thrash the observer exists to avoid.
 *
 * `rootMargin` biases the "active" band to the upper third of the viewport:
 * without it the last section can never win, because a short final section is
 * never the most-visible one on screen.
 */
import { useEffect, useState } from 'react';
import { STUDIO_STEPS } from './studioSteps';
import type { StudioStep } from './studioSteps';

export function useStepProgress(): StudioStep['id'] {
  const [active, setActive] = useState<StudioStep['id']>(STUDIO_STEPS[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const nodes = STUDIO_STEPS
      .map((step) => ({ step, el: document.getElementById(step.sectionId) }))
      .filter((entry): entry is { step: StudioStep; el: HTMLElement } => entry.el != null);

    if (nodes.length === 0) return;

    const ratios = new Map<string, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratios.set((entry.target as HTMLElement).id, entry.isIntersecting ? entry.intersectionRatio : 0);
        });

        let bestId: StudioStep['id'] | null = null;
        let bestRatio = 0;
        nodes.forEach(({ step }) => {
          const ratio = ratios.get(step.sectionId) ?? 0;
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = step.id;
          }
        });
        if (bestId) setActive(bestId);
      },
      { rootMargin: '-10% 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    nodes.forEach(({ el }) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return active;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/useStepProgress.test.tsx`
Expected: PASS, 1 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/useStepProgress.ts frontend/components/module-3/3.1-content-studio/useStepProgress.test.tsx
git commit -m "feat(module-3): add step scroll-spy hook"
```

---

### Task 4: Step rail component

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/StudioStepRail.tsx`
- Modify: `frontend/styles/index.css`
- Test: `frontend/components/module-3/3.1-content-studio/StudioStepRail.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StudioStepRail from './StudioStepRail';

vi.mock('./useStepProgress', () => ({ useStepProgress: () => 'attach' }));

describe('StudioStepRail', () => {
  it('renders one anchor per step and marks the active one', () => {
    const { container } = render(<StudioStepRail />);

    const links = container.querySelectorAll('.step-rail a');
    expect(links.length).toBe(3);
    expect(links[0]).toHaveAttribute('href', '#studio-step-draft');
    expect(screen.getByText('Draft')).toBeTruthy();
    expect(screen.getByText('Attach')).toBeTruthy();
    expect(screen.getByText('Validate')).toBeTruthy();

    expect(links[1].getAttribute('aria-current')).toBe('step');
    expect(links[0].getAttribute('aria-current')).toBeNull();
    // Steps before the active one read as done, so the rail shows progress.
    expect(links[0].getAttribute('data-state')).toBe('done');
    expect(links[1].getAttribute('data-state')).toBe('current');
    expect(links[2].getAttribute('data-state')).toBe('todo');
  });

  it('is labelled as navigation for assistive tech', () => {
    render(<StudioStepRail />);
    expect(screen.getByRole('navigation', { name: 'Studio progress' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/StudioStepRail.test.tsx`
Expected: FAIL — `Failed to resolve import "./StudioStepRail"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
/**
 * The floating numbered progress indicators in the left margin.
 *
 * Anchors, not buttons: each step IS a place in the document, so the browser's
 * own fragment navigation (plus scroll-margin-top on .studio-section) does the
 * scrolling, and the steps are reachable and announced as links.
 */
import { STUDIO_STEPS } from './studioSteps';
import { useStepProgress } from './useStepProgress';

export default function StudioStepRail() {
  const active = useStepProgress();
  const activeIndex = STUDIO_STEPS.findIndex((s) => s.id === active);

  return (
    <nav className="step-rail" aria-label="Studio progress">
      <ol>
        {STUDIO_STEPS.map((step, index) => {
          const state = index < activeIndex ? 'done' : index === activeIndex ? 'current' : 'todo';
          return (
            <li key={step.id}>
              <a
                href={`#${step.sectionId}`}
                data-state={state}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                <span className="step-rail-no">{step.number}</span>
                <span className="step-rail-label">{step.label}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

- [ ] **Step 4: Add the rail styles**

Append to the CONTENT STUDIO block in `frontend/styles/index.css`:

```css
  /* Step rail. Absolutely positioned into the flow's left margin rather than
     given a grid track, so appearing and disappearing never re-centres the
     column beside it. Hidden below 1280px, where there is no margin to sit in
     — the numbered headings in the column carry the sequence there. */
  .step-rail {
    display: none;
  }
  @media (min-width: 1280px) {
    .step-rail {
      display: block;
      position: absolute;
      top: 0;
      left: calc(var(--studio-rail-w) * -1);
      width: var(--studio-rail-w);
      height: 100%;
    }
    .step-rail > ol {
      position: sticky;
      top: calc(var(--topbar-h) + var(--space-lg));
      display: grid;
      gap: var(--space-md);
    }
  }
  .step-rail a {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-text-muted);
    transition: color 0.16s ease;
  }
  .step-rail a:hover {
    color: var(--color-navy-primary);
  }
  .step-rail a[data-state='current'] {
    color: var(--color-navy-dark);
  }
  .step-rail-no {
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    flex: none;
    border-radius: var(--radius-full);
    background: var(--color-white);
    border: 1px solid rgba(27, 58, 92, 0.12);
    font-size: 0.8125rem;
    font-weight: 700;
    color: inherit;
    transition: background 0.16s ease, border-color 0.16s ease;
  }
  /* Current and done both take the accent gradient — the same treatment
     .rank-no[data-lead] and the wizard's .ob-dot use, so "reached" reads the
     same way across the app. */
  .step-rail a[data-state='current'] .step-rail-no,
  .step-rail a[data-state='done'] .step-rail-no {
    background: var(--gradient-accent);
    border-color: transparent;
    color: var(--color-navy-dark);
  }
  @media (prefers-reduced-motion: reduce) {
    .step-rail a,
    .step-rail-no {
      transition: none;
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/StudioStepRail.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/StudioStepRail.tsx frontend/components/module-3/3.1-content-studio/StudioStepRail.test.tsx frontend/styles/index.css
git commit -m "feat(module-3): add floating step rail"
```

---

### Task 5: Campaign brief drawer

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/CampaignBriefDrawer.tsx`
- Modify: `frontend/styles/index.css`
- Test: `frontend/components/module-3/3.1-content-studio/CampaignBriefDrawer.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampaignBriefDrawer from './CampaignBriefDrawer';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { MOCK_CREATIVE_DIRECTION } from '../../../services/fixtures/creativeDirection';
import { MOCK_CONTENT } from '../../../services/fixtures/content';

function setup(open: boolean, onClose = vi.fn()) {
  render(
    <OverlayStackProvider>
      <CampaignBriefDrawer
        open={open}
        onClose={onClose}
        showWelcome={false}
        direction={MOCK_CREATIVE_DIRECTION}
        content={MOCK_CONTENT}
        platform="instagram"
      />
    </OverlayStackProvider>,
  );
  return onClose;
}

describe('CampaignBriefDrawer', () => {
  it('carries the moodboard and the copywriting rationale', () => {
    setup(true);
    expect(screen.getByText('Moodboard')).toBeTruthy();
    expect(screen.getByText('Sea glass green')).toBeTruthy();
    expect(screen.getByText('Copywriting matrix')).toBeTruthy();
    // One rationale block per caption option, and Instagram ships three — so
    // this label is expected three times. getAllByText with an explicit count
    // asserts every option's rationale rendered; the single-match getByText
    // this replaced threw on the second match.
    expect(screen.getAllByText('Business context')).toHaveLength(3);
  });

  it('shows the welcome note only when asked', () => {
    render(
      <OverlayStackProvider>
        <CampaignBriefDrawer
          open
          onClose={vi.fn()}
          showWelcome
          direction={MOCK_CREATIVE_DIRECTION}
          content={MOCK_CONTENT}
          platform="instagram"
        />
      </OverlayStackProvider>,
    );
    expect(screen.getByTestId('brief-welcome')).toBeTruthy();
  });

  it('closes on the drawer control', async () => {
    const onClose = setup(true);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/CampaignBriefDrawer.test.tsx`
Expected: FAIL — `Failed to resolve import "./CampaignBriefDrawer"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
/**
 * Slide-out campaign brief — the reference material that informs the work but
 * is not a step in it: the moodboard, and the per-option rationale behind the
 * generated captions.
 *
 * Built on the shared Drawer so it joins the same overlay stack as the Market
 * Radar drawer: Escape and the scrim close it, and a modal opened above it
 * (the publish modal) closes first.
 */
import { BookOpen, Palette, Sparkles } from 'lucide-react';
import Drawer from '../../shared/Drawer';
import type { ContentResponse, CreativeDirection, PlatformId } from '../../../types';

const REASON_FIELDS: Array<[string, string]> = [
  ['core_business_context', 'Business context'],
  ['market_cultural_localization', 'Cultural localisation'],
  ['psychological_elements', 'Psychological elements'],
  ['creative_tone_atmosphere', 'Tone & atmosphere'],
  ['algorithmic_platform_architecture', 'Platform fit'],
];

export interface CampaignBriefDrawerProps {
  open: boolean;
  onClose: () => void;
  /** FTUE only — the one-time explanation of what this panel is for. */
  showWelcome: boolean;
  direction: CreativeDirection | null;
  content: ContentResponse | null;
  platform: PlatformId;
}

export default function CampaignBriefDrawer({
  open,
  onClose,
  showWelcome,
  direction,
  content,
  platform,
}: CampaignBriefDrawerProps) {
  const captions = content?.captions[platform] ?? null;

  return (
    <Drawer open={open} onClose={onClose} label="Campaign brief">
      <div className="brief-head">
        <span className="conn-ico" aria-hidden="true"><BookOpen /></span>
        <div className="studio-head-text">
          <h2 className="heading-md">Campaign brief</h2>
          <p className="body-sm">Reference material for this market and platform.</p>
        </div>
      </div>

      {showWelcome && (
        <p className="studio-note" data-testid="brief-welcome">
          <Sparkles size={16} aria-hidden="true" />
          This panel holds the moodboard and the reasoning behind each caption. It stays out of your
          way — reopen it any time with “View Campaign Brief”.
        </p>
      )}

      {direction && (
        <div className="studio-block">
          <h3><Palette size={15} aria-hidden="true" /> Moodboard</h3>
          <p className="body-xs">{direction.moodboard.palette}</p>
          <ul className="chip-row mt-3">
            {direction.moodboard.references.map((ref) => (
              <li key={ref} className="chip">{ref}</li>
            ))}
          </ul>
        </div>
      )}

      {captions && (
        <div className="studio-block">
          <h3>Copywriting matrix</h3>
          {captions.options.map((_, index) => {
            const meta = captions.optionMetadata[index];
            if (!meta) return null;
            return (
              <div key={index} className="brief-option">
                <span className="badge badge--teal">Option {index + 1}</span>
                <h4 className="cap-title">{captions.optionNames[index] ?? `Option ${index + 1}`}</h4>
                <dl className="cap-why-list">
                  {REASON_FIELDS.map(([field, label]) => (
                    <div key={field}>
                      <dt>{label}</dt>
                      <dd>{(meta as unknown as Record<string, string>)[field]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 4: Add the drawer's own styles**

Append to the CONTENT STUDIO block:

```css
  .brief-head {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    padding-bottom: var(--space-sm);
    margin-bottom: var(--space-md);
    border-bottom: 1px solid rgba(27, 58, 92, 0.07);
  }
  .brief-option + .brief-option {
    margin-top: var(--space-md);
  }
  .brief-option .cap-title {
    margin-bottom: var(--space-xs);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/CampaignBriefDrawer.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/CampaignBriefDrawer.tsx frontend/components/module-3/3.1-content-studio/CampaignBriefDrawer.test.tsx frontend/styles/index.css
git commit -m "feat(module-3): add campaign brief slide-out drawer"
```

---

# Phase 2 — First-Time User Experience

### Task 6: FTUE hook

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/useFirstRunDrawer.ts`
- Test: `frontend/components/module-3/3.1-content-studio/useFirstRunDrawer.test.tsx`

**Contract:** first visit → drawer opens automatically and `showWelcome` is true. Once the operator closes it manually, a localStorage flag is written and it never auto-opens again. The pulsing tooltip shows only when the flag is unset *and* the drawer is not currently open — i.e. discoverability for anyone who dismissed the auto-open without it registering.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { useFirstRunDrawer, BRIEF_SEEN_KEY } from './useFirstRunDrawer';

function Probe() {
  const { open, showWelcome, showTooltip, openDrawer, closeDrawer } = useFirstRunDrawer();
  return (
    <div>
      <span data-testid="open">{String(open)}</span>
      <span data-testid="welcome">{String(showWelcome)}</span>
      <span data-testid="tooltip">{String(showTooltip)}</span>
      <button onClick={openDrawer}>open</button>
      <button onClick={closeDrawer}>close</button>
    </div>
  );
}

describe('useFirstRunDrawer', () => {
  beforeEach(() => localStorage.clear());

  it('auto-opens with a welcome on the first visit', () => {
    render(<Probe />);
    expect(screen.getByTestId('open')).toHaveTextContent('true');
    expect(screen.getByTestId('welcome')).toHaveTextContent('true');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
  });

  it('records the dismissal and stays closed afterwards', () => {
    const { unmount } = render(<Probe />);
    act(() => { screen.getByText('close').click(); });
    expect(screen.getByTestId('open')).toHaveTextContent('false');
    expect(localStorage.getItem(BRIEF_SEEN_KEY)).toBe('true');
    unmount();

    render(<Probe />);
    expect(screen.getByTestId('open')).toHaveTextContent('false');
    expect(screen.getByTestId('welcome')).toHaveTextContent('false');
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
  });

  // The tooltip exists for exactly one situation: auto-open was skipped, so
  // the drawer never introduced itself. That happens when storage is blocked
  // (private mode, blocked site data) — we refuse to auto-open something whose
  // dismissal we would be unable to remember, because it would then ambush the
  // operator on every single load.
  it('falls back to the tooltip when storage is blocked and auto-open is skipped', () => {
    const orig = Storage.prototype.getItem;
    Storage.prototype.getItem = () => { throw new Error('blocked'); };
    try {
      expect(() => render(<Probe />)).not.toThrow();
      expect(screen.getByTestId('open')).toHaveTextContent('false');
      expect(screen.getByTestId('welcome')).toHaveTextContent('false');
      expect(screen.getByTestId('tooltip')).toHaveTextContent('true');
    } finally {
      Storage.prototype.getItem = orig;
    }
  });

  it('drops the tooltip once the drawer has been opened and dismissed', () => {
    render(<Probe />);
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
    act(() => { screen.getByText('close').click(); });
    expect(screen.getByTestId('tooltip')).toHaveTextContent('false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/useFirstRunDrawer.test.tsx`
Expected: FAIL — `Failed to resolve import "./useFirstRunDrawer"`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * FTUE for the campaign-brief drawer.
 *
 * The drawer is genuinely useful and completely invisible, so it introduces
 * itself once and then gets out of the way permanently. The flag is written on
 * the operator's own dismissal rather than on open, so an auto-open they never
 * looked at does not count as having been shown.
 *
 * Key naming and the try/catch follow AppShell's `ceview.sidebarCollapsed` —
 * private mode and blocked site data make every access throw, and the feature
 * must degrade to "never auto-opens" rather than crashing the screen.
 */
import { useCallback, useState } from 'react';

export const BRIEF_SEEN_KEY = 'ceview.contentStudio.briefSeen';

interface BriefFlag {
  seen: boolean;
  /** False when storage threw — private mode, blocked site data. */
  ok: boolean;
}

function readFlag(): BriefFlag {
  try {
    return { seen: localStorage.getItem(BRIEF_SEEN_KEY) === 'true', ok: true };
  } catch {
    return { seen: false, ok: false };
  }
}

export interface FirstRunDrawer {
  open: boolean;
  showWelcome: boolean;
  showTooltip: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

export function useFirstRunDrawer(): FirstRunDrawer {
  const [flag] = useState(readFlag);
  const [seen, setSeen] = useState(flag.seen);
  // First render decides. Auto-open requires BOTH that the operator has never
  // dismissed it and that storage works — auto-opening when the dismissal
  // cannot be recorded would ambush them on every load forever.
  const [open, setOpen] = useState(() => flag.ok && !flag.seen);
  const [firstRun] = useState(() => !flag.seen);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setSeen(true);
    try {
      localStorage.setItem(BRIEF_SEEN_KEY, 'true');
    } catch {
      // Nothing to do — it will auto-open again next time, which is the safe
      // failure for a discovery aid.
    }
  }, []);

  const openDrawer = useCallback(() => setOpen(true), []);

  return {
    open,
    showWelcome: firstRun && open,
    // The fallback path: auto-open was skipped (storage blocked), so nothing
    // has introduced the drawer and the trigger pulses instead. Goes quiet the
    // moment the drawer is opened, and stays quiet after a dismissal.
    showTooltip: !seen && !open,
    openDrawer,
    closeDrawer,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/useFirstRunDrawer.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/useFirstRunDrawer.ts frontend/components/module-3/3.1-content-studio/useFirstRunDrawer.test.tsx
git commit -m "feat(module-3): add first-run drawer behaviour"
```

---

### Task 7: Sticky brief button with pulsing tooltip

**Files:**
- Modify: `frontend/styles/index.css`

- [ ] **Step 1: Add the button and tooltip styles**

Append to the CONTENT STUDIO block:

```css
  /* Sticky trigger for the campaign brief. Fixed to the right edge, vertically
     centred, so it is reachable from any scroll position without occupying a
     row in the column. */
  .brief-trigger {
    position: fixed;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    z-index: 25;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: 12px 16px;
    border-radius: var(--radius-md) 0 0 var(--radius-md);
    background: var(--gradient-chrome);
    color: var(--color-text-inverse);
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 600;
    box-shadow: var(--shadow-overlay);
    cursor: pointer;
  }
  .brief-trigger svg {
    flex: none;
  }
  /* Hidden while the drawer it opens is on screen — the drawer covers this
     edge, and a trigger under an open panel is a dead control. */
  .brief-trigger[data-hidden='true'] {
    display: none;
  }

  /* Onboarding pulse. Two rings on the same delay-offset animation so the
     button reads as "there is something here" without moving the button
     itself, which would shift the hit target under the cursor. */
  .brief-trigger[data-pulse='true']::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 2px solid var(--color-mint-primary);
    animation: brief-pulse 2s var(--ease-brand) infinite;
    pointer-events: none;
  }
  @keyframes brief-pulse {
    0%   { opacity: 0.9; transform: scale(1); }
    70%  { opacity: 0;   transform: scale(1.18); }
    100% { opacity: 0;   transform: scale(1.18); }
  }
  .brief-tip {
    position: absolute;
    right: calc(100% + 12px);
    top: 50%;
    transform: translateY(-50%);
    white-space: nowrap;
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    background: var(--color-navy-dark);
    color: var(--color-text-inverse);
    font-size: 0.8125rem;
    font-weight: 500;
    box-shadow: var(--shadow-card);
  }
  /* A decorative attention-getter must not animate for anyone who asked for
     less motion; the tooltip alone still carries the discovery. */
  @media (prefers-reduced-motion: reduce) {
    .brief-trigger[data-pulse='true']::after {
      animation: none;
      opacity: 0.9;
      transform: none;
    }
  }
```

- [ ] **Step 2: Verify the stylesheet compiles**

Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 3: Confirm the rules shipped**

Run: `grep -c "brief-trigger" dist/assets/index-*.css`
Expected: a non-zero count.

- [ ] **Step 4: Commit**

```bash
git add frontend/styles/index.css
git commit -m "feat(module-3): style sticky brief trigger and onboarding pulse"
```

---

### Task 8: Preview reset helper for the FTUE flag

**Files:**
- Modify: `frontend/components/module-3/3.1-content-studio/previewFixtures.ts`

The FTUE is one-shot, which makes it untestable by hand after the first look. The preview route needs a way to replay it.

- [ ] **Step 1: Append the helper**

```ts
/**
 * TEMPORARY. Clears the campaign-brief FTUE flag so /preview/content replays
 * the first-run auto-open on every reload — the behaviour is one-shot by
 * design, which otherwise makes it impossible to look at twice.
 *
 * Call it from the preview screen only. Delete with the rest of this file.
 */
export function resetBriefFtue(): void {
  try {
    localStorage.removeItem('ceview.contentStudio.briefSeen');
  } catch {
    // Storage blocked — the FTUE will not auto-open anyway.
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the pre-existing `CalendarView.tsx(61,106)` error.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/previewFixtures.ts
git commit -m "chore(module-3): add preview-only FTUE reset helper"
```

---

# Phase 3 — AI Caption Selection Grid

### Task 9: Caption grid CSS

**Files:**
- Modify: `frontend/styles/index.css`

- [ ] **Step 1: Add the grid and truncation styles**

Append to the CONTENT STUDIO block:

```css
  /* 1 row x 3 columns of caption options, side by side for comparison.
     auto-fit, not repeat(3): MOCK_CONTENT.captions.naver ships only TWO
     options, and a hard three-column track would leave a dead cell. */
  .cap-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-md);
    align-items: start;
  }
  @media (min-width: 900px) {
    .cap-grid {
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
  }
  /* Uniform height comes from clamping the body to four lines, not from
     stretching the cards: equal-height cards with unequal content just move
     the ragged edge inside the card. */
  .cap-body {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: pre-wrap;
    font-family: var(--font-body);
    font-size: 0.875rem;
    line-height: 1.55;
    color: var(--color-text-body);
  }
  .cap-body[data-expanded='true'] {
    -webkit-line-clamp: unset;
    overflow: visible;
  }
  .cap-expand {
    margin-top: var(--space-xs);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-cyan-deep);
    cursor: pointer;
  }
  /* The selected option keeps the app's one selection idiom — the 3px mint
     left border used by the sidebar's active row and the selected alert. */
  .cap-card[data-selected='true'] {
    border-left-color: var(--color-mint-primary);
    box-shadow: 0 1px 2px rgba(27, 58, 92, 0.06), var(--shadow-card-hover);
  }
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 3: Commit**

```bash
git add frontend/styles/index.css
git commit -m "feat(module-3): style caption selection grid"
```

---

### Task 10: Caption option grid component

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/CaptionOptionGrid.tsx`
- Test: `frontend/components/module-3/3.1-content-studio/CaptionOptionGrid.test.tsx`

**Behaviour change:** the per-card `<textarea>`, Copy button and Approve button are gone. Editing happens once, in the Staged Caption field. A card offers exactly two actions: Expand (read the rest) and Select (send it down to the staged field).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CaptionOptionGrid from './CaptionOptionGrid';
import { MOCK_CONTENT } from '../../../services/fixtures/content';

describe('CaptionOptionGrid', () => {
  it('renders one card per option with its name', () => {
    render(
      <CaptionOptionGrid
        captions={MOCK_CONTENT.captions.instagram}
        selectedIndex={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('article').length).toBe(3);
    expect(screen.getByText('Witty, Trend-Conscious & High-Energy')).toBeTruthy();
  });

  it('renders the two-option Naver set without a placeholder card', () => {
    render(
      <CaptionOptionGrid
        captions={MOCK_CONTENT.captions.naver}
        selectedIndex={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByRole('article').length).toBe(2);
  });

  it('sends the option text up on Select and marks the card selected', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <CaptionOptionGrid
        captions={MOCK_CONTENT.captions.instagram}
        selectedIndex={null}
        onSelect={onSelect}
      />,
    );
    const cards = screen.getAllByRole('article');
    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Select' }));

    expect(onSelect).toHaveBeenCalledWith(1, MOCK_CONTENT.captions.instagram.options[1]);

    rerender(
      <CaptionOptionGrid
        captions={MOCK_CONTENT.captions.instagram}
        selectedIndex={1}
        onSelect={onSelect}
      />,
    );
    expect(screen.getAllByRole('article')[1]).toHaveAttribute('data-selected', 'true');
    expect(within(screen.getAllByRole('article')[1]).getByRole('button', { name: 'Selected' })).toBeTruthy();
  });

  it('expands and collapses a clamped option', async () => {
    render(
      <CaptionOptionGrid
        captions={MOCK_CONTENT.captions.instagram}
        selectedIndex={null}
        onSelect={vi.fn()}
      />,
    );
    const card = screen.getAllByRole('article')[0];
    const toggle = within(card).getByRole('button', { name: 'Expand' });
    expect(within(card).getByTestId('cap-body-0')).toHaveAttribute('data-expanded', 'false');

    await userEvent.click(toggle);
    expect(within(card).getByTestId('cap-body-0')).toHaveAttribute('data-expanded', 'true');
    expect(within(card).getByRole('button', { name: 'Collapse' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/CaptionOptionGrid.test.tsx`
Expected: FAIL — `Failed to resolve import "./CaptionOptionGrid"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
/**
 * The AI caption options, three abreast, for comparison at a glance.
 *
 * These cards are no longer editable. The old design gave every option its own
 * textarea, which meant three drafts could diverge silently and only one of
 * them ever reached the composer. Selection is now the card's whole job; the
 * staged caption below is the single editable copy.
 */
import { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { PlatformCaptions } from '../../../types';

export interface CaptionOptionGridProps {
  captions: PlatformCaptions;
  /** Index of the option currently staged, or null. Owned by the parent. */
  selectedIndex: number | null;
  onSelect: (index: number, text: string) => void;
}

export default function CaptionOptionGrid({ captions, selectedIndex, onSelect }: CaptionOptionGridProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="cap-grid">
      {captions.options.map((text, index) => {
        const isSelected = selectedIndex === index;
        const isExpanded = expanded === index;
        return (
          <article key={index} className="cap-card" data-selected={isSelected}>
            <div className="cap-head">
              <span className="badge badge--teal">Option {index + 1}</span>
              {isSelected && (
                <span className="chip chip--success">
                  <Check aria-hidden="true" /> Staged
                </span>
              )}
            </div>
            <h3 className="cap-title">{captions.optionNames[index] ?? `Option ${index + 1}`}</h3>

            <p className="cap-body" data-expanded={isExpanded} data-testid={`cap-body-${index}`}>
              {text}
            </p>
            <button
              type="button"
              className="cap-expand"
              aria-expanded={isExpanded}
              onClick={() => setExpanded(isExpanded ? null : index)}
            >
              {isExpanded ? 'Collapse' : 'Expand'}
              {isExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            </button>

            <div className="cap-actions">
              <button
                type="button"
                className="btn-primary btn-primary--sm"
                onClick={() => onSelect(index, text)}
              >
                <Check size={15} aria-hidden="true" />
                {isSelected ? 'Selected' : 'Select'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/CaptionOptionGrid.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/CaptionOptionGrid.tsx frontend/components/module-3/3.1-content-studio/CaptionOptionGrid.test.tsx
git commit -m "feat(module-3): add caption selection grid"
```

---

### Task 11: Snap-to-staged transition

**Files:**
- Modify: `frontend/styles/index.css`
- Modify: `frontend/components/module-3/3.1-content-studio/PublishComposer.tsx`

The spec asks for a visual transition that "snaps the chosen text seamlessly down into the active Staged Caption input". Implement it as a brief highlight on the destination field, triggered by a changing key.

- [ ] **Step 1: Add the flash style**

```css
  /* Confirms where a selected option landed. A highlight on the DESTINATION,
     not an animation of the text flying down: the two are far apart on a long
     page and a travelling element would be off-screen for most of its trip. */
  @keyframes staged-flash {
    from { box-shadow: 0 0 0 3px rgba(95, 214, 166, 0.55), var(--shadow-card); }
    to   { box-shadow: 0 0 0 3px rgba(95, 214, 166, 0), var(--shadow-card); }
  }
  .textarea[data-flash='true'] {
    animation: staged-flash 0.9s var(--ease-brand);
  }
  @media (prefers-reduced-motion: reduce) {
    .textarea[data-flash='true'] {
      animation: none;
    }
  }
```

- [ ] **Step 2: Accept and apply a flash token in the composer**

In `PublishComposer.tsx`, extend `ComposerSlotProps` usage: add `stageToken?: number` to the props destructure and render the staged textarea with:

```tsx
        <textarea
          id="staged-caption"
          className={`textarea ${overLimit ? 'is-invalid' : ''}`}
          data-flash={stageToken != null && stageToken > 0}
          key={`staged-${stageToken ?? 0}`}
          value={draft.caption}
          onChange={(event) => onDraftChange({ caption: event.target.value, agreementChecked: false })}
          placeholder="Approve a matrix option or write your own caption."
        />
```

The changing `key` remounts the element, which restarts the CSS animation — the only reliable way to replay a one-shot animation on repeat selections.

- [ ] **Step 3: Add `stageToken` to the type**

In `contentStudioTypes.ts`, extend `ComposerSlotProps`:

```ts
import type { ReactNode } from 'react';

export interface ComposerSlotProps {
  draft: PublishDraftState;
  onDraftChange: (patch: Partial<PublishDraftState>) => void;
  audit: AuditState;
  /** Increments each time an option is staged, to replay the highlight. */
  stageToken?: number;
  /**
   * Slot rendered directly above the Publication media block — the shot-list
   * accordion (Task 12). A slot rather than a direct import so the composer
   * does not depend on the creative-direction fetch that lives in the view.
   */
  accordion?: ReactNode;
}
```

Both `stageToken` and `accordion` are added here in one edit. Task 15 Step 6 destructures
`accordion`; without this declaration that step is a TypeScript error.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the pre-existing `CalendarView.tsx(61,106)` error.

- [ ] **Step 5: Commit**

```bash
git add frontend/styles/index.css frontend/components/module-3/3.1-content-studio/PublishComposer.tsx frontend/components/module-3/3.1-content-studio/contentStudioTypes.ts
git commit -m "feat(module-3): flash the staged caption field on selection"
```

---

# Phase 4 — Media, Contextual Guidance & Validation

### Task 12: Shot list accordion

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/ShotListAccordion.tsx`
- Modify: `frontend/styles/index.css`
- Test: `frontend/components/module-3/3.1-content-studio/ShotListAccordion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ShotListAccordion from './ShotListAccordion';
import { MOCK_CREATIVE_DIRECTION } from '../../../services/fixtures/creativeDirection';

describe('ShotListAccordion', () => {
  it('starts closed', () => {
    render(<ShotListAccordion direction={MOCK_CREATIVE_DIRECTION} onOpenBrief={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /Review Shot List & Visual Direction/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Hero — sardine run, mid-shoal')).toBeNull();
  });

  it('reveals the shot list and the guide on open', async () => {
    render(<ShotListAccordion direction={MOCK_CREATIVE_DIRECTION} onOpenBrief={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Review Shot List & Visual Direction/ }));
    expect(screen.getByText('Hero — sardine run, mid-shoal')).toBeTruthy();
    expect(screen.getAllByText(/^Lighting: /).length).toBe(4);
  });

  it('offers a link into the full brief', async () => {
    const onOpenBrief = vi.fn();
    render(<ShotListAccordion direction={MOCK_CREATIVE_DIRECTION} onOpenBrief={onOpenBrief} />);
    // The accordion starts closed, so the link does not exist until it opens.
    await userEvent.click(screen.getByRole('button', { name: /Review Shot List & Visual Direction/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review Full Brief' }));
    expect(onOpenBrief).toHaveBeenCalled();
  });

  it('renders nothing at all without a direction', () => {
    const { container } = render(<ShotListAccordion direction={null} onOpenBrief={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/ShotListAccordion.test.tsx`
Expected: FAIL — `Failed to resolve import "./ShotListAccordion"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
/**
 * Shot list and visual direction, collapsed, sitting immediately above the
 * upload control — the instructions land at the moment they are actionable
 * rather than in a panel the operator scrolled past ten minutes earlier.
 *
 * Closed by default: it is guidance for the minority of sessions where the
 * asset has not been shot yet.
 */
import { useState } from 'react';
import { Camera, ChevronDown } from 'lucide-react';
import type { CreativeDirection } from '../../../types';

export interface ShotListAccordionProps {
  direction: CreativeDirection | null;
  /** Opens the campaign-brief drawer — the fuller reference behind this. */
  onOpenBrief: () => void;
}

export default function ShotListAccordion({ direction, onOpenBrief }: ShotListAccordionProps) {
  const [open, setOpen] = useState(false);
  if (!direction) return null;

  return (
    <div className="accordion">
      <button
        type="button"
        className="accordion-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="conn-ico" aria-hidden="true"><Camera /></span>
        <span className="accordion-title">Review Shot List &amp; Visual Direction</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && (
        <div className="accordion-body">
          <ol className="studio-list">
            {direction.visualGuide.map((item, index) => (
              <li key={item}>
                <span className="badge badge--teal">{index + 1}</span>
                <span className="body-sm">{item}</span>
              </li>
            ))}
          </ol>

          <div className="studio-block">
            <h3>Shot list</h3>
            <div className="studio-list studio-list--stack">
              {direction.shots.map((shot) => (
                <div key={shot.label}>
                  <p className="heading-sm">{shot.label}</p>
                  <p className="body-xs mt-1">{shot.description}</p>
                  <span className="chip chip--wrap mt-3">Lighting: {shot.lighting}</span>
                </div>
              ))}
            </div>
          </div>

          <button type="button" className="link-inline" onClick={onOpenBrief}>
            Review Full Brief
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add the accordion styles**

```css
  /* Inline disclosure sitting inside a card, above the control it explains. */
  .accordion {
    border-radius: var(--radius-sm);
    border: 1px solid rgba(27, 58, 92, 0.08);
    background: var(--color-off-white);
  }
  .accordion-toggle {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-sm);
    text-align: left;
    cursor: pointer;
  }
  .accordion-title {
    flex: 1;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-navy-dark);
  }
  .accordion-toggle svg:last-child {
    flex: none;
    color: var(--color-cyan-deep);
    transition: transform 0.2s var(--ease-brand);
  }
  .accordion-toggle[aria-expanded='true'] svg:last-child {
    transform: rotate(180deg);
  }
  .accordion-body {
    padding: 0 var(--space-sm) var(--space-sm);
  }
  /* A button that behaves as a link — it opens an overlay, not a URL, so it
     must not be an <a> with a fake href. */
  .link-inline {
    margin-top: var(--space-md);
    font-family: var(--font-body);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-cyan-deep);
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  @media (prefers-reduced-motion: reduce) {
    .accordion-toggle svg:last-child {
      transition: none;
    }
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/ShotListAccordion.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/ShotListAccordion.tsx frontend/components/module-3/3.1-content-studio/ShotListAccordion.test.tsx frontend/styles/index.css
git commit -m "feat(module-3): add inline shot list accordion"
```

---

### Task 13: Explicit audit trigger

**Files:**
- Modify: `frontend/components/module-3/3.1-content-studio/CompliancePanel.tsx`
- Test: `frontend/components/module-3/3.1-content-studio/CompliancePanel.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CompliancePanel from './CompliancePanel';
import type { PublishDraftState } from './contentStudioTypes';

vi.mock('../../../services/apiClient', () => ({
  apiClient: { compliance: { omcsAnalyze: vi.fn(() => Promise.resolve({})) } },
}));

const READY: PublishDraftState = {
  caption: 'A caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: true,
};

describe('CompliancePanel', () => {
  it('does NOT start the audit on its own when the draft becomes ready', () => {
    const onAuditChange = vi.fn();
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={onAuditChange}
      />,
    );
    expect(onAuditChange).not.toHaveBeenCalled();
  });

  it('starts the audit only when the button is pressed', async () => {
    const onAuditChange = vi.fn();
    render(
      <CompliancePanel
        draft={READY}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={onAuditChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Run Compliance Audit/ }));
    expect(onAuditChange).toHaveBeenCalledWith({ status: 'running', step: 0, result: null });
  });

  it('disables the button until the draft is complete', () => {
    render(
      <CompliancePanel
        draft={{ ...READY, mediaDataUrl: null }}
        audit={{ status: 'idle', step: 0, result: null }}
        onAuditChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Run Compliance Audit/ })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/CompliancePanel.test.tsx`
Expected: FAIL — the first test fails because the auto-run effect calls `onAuditChange` on mount.

- [ ] **Step 3: Replace the auto-run effect with a button**

Delete this effect entirely from `CompliancePanel.tsx`:

```tsx
  useEffect(() => {
    if (!ready || audit.status !== 'idle') return;
    onAuditChange({ status: 'running', step: 0, result: null });
  }, [ready, audit.status, onAuditChange]);
```

Then, in the `audit.status === 'idle'` branch, render the trigger after the existing prompt:

```tsx
      {audit.status === 'idle' && (
        <>
          <p className="studio-note">
            Add a caption, media, and a publish destination, then confirm authorisation to begin the six-step audit.
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            disabled={!ready}
            onClick={() => onAuditChange({ status: 'running', step: 0, result: null })}
          >
            <ShieldCheck size={16} aria-hidden="true" /> Run Compliance Audit
          </button>
        </>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/CompliancePanel.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/CompliancePanel.tsx frontend/components/module-3/3.1-content-studio/CompliancePanel.test.tsx
git commit -m "feat(module-3): require an explicit compliance audit trigger"
```

---

### Task 14: Progressive disclosure of Publish

**Files:**
- Modify: `frontend/components/module-3/3.1-content-studio/ContentBoard.tsx`
- Test: `frontend/components/module-3/3.1-content-studio/ContentBoard.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ContentBoard from './ContentBoard';
// MOCK_POSTS, not previewFixtures' DEMO_BOARD_POSTS: previewFixtures.ts is
// marked for deletion once the design is signed off, and a permanent test must
// not break when it goes.
import { MOCK_POSTS } from '../../../services/fixtures/posts';
import type { PublishDraftState } from './contentStudioTypes';

const DRAFT: PublishDraftState = {
  caption: 'x', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: true,
};

describe('ContentBoard publish disclosure', () => {
  it('hides the Publish button entirely before a passing audit', () => {
    render(
      <ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish={false} onPublished={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Publish/ })).toBeNull();
  });

  it('reveals it once the audit passes', () => {
    render(
      <ContentBoard draft={DRAFT} posts={MOCK_POSTS} canPublish onPublished={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Publish/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/ContentBoard.test.tsx`
Expected: FAIL — the button currently renders always, merely `disabled`.

- [ ] **Step 3: Replace the disabled button with a conditional one**

In `ContentBoard.tsx`, replace the `<button …disabled={!canPublish}…>` in `.studio-head` with:

```tsx
        {/* Progressive disclosure: hidden, not disabled. A greyed-out Publish
            invited the operator to hunt for what unlocks it; absent, the audit
            above is unambiguously the next thing to do. */}
        {canPublish && (
          <button
            type="button"
            className="btn-primary studio-head-act"
            title="Publish selected content"
            onClick={onPublished}
          >
            <Send size={16} aria-hidden="true" />
            Publish {draft.platforms.length ? `to ${draft.platforms.length} platform${draft.platforms.length === 1 ? '' : 's'}` : ''}
          </button>
        )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/ContentBoard.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/ContentBoard.tsx frontend/components/module-3/3.1-content-studio/ContentBoard.test.tsx
git commit -m "feat(module-3): hide Publish until the audit passes"
```

---

### Task 15: Recompose the view as a linear flow

**Files:**
- Modify: `frontend/components/module-3/3.1-content-studio/ContentStudioView.tsx`
- Modify: `frontend/components/module-3/3.1-content-studio/AIContentMatrixPanel.tsx`
- Modify: `frontend/components/module-3/3.1-content-studio/PublishComposer.tsx`
- Modify: `frontend/components/module-3/3.1-content-studio/VisualDirectionBoard.tsx` (delete — its content now lives in the accordion and the drawer)
- Test: `frontend/components/module-3/3.1-content-studio/ContentStudioView.test.tsx` (update existing)

- [ ] **Step 1: Delete the retired panel and its test**

```bash
git rm frontend/components/module-3/3.1-content-studio/VisualDirectionBoard.tsx frontend/components/module-3/3.1-content-studio/VisualDirectionBoard.test.tsx
```

The creative direction is now fetched by `ContentStudioView` and passed to both `ShotListAccordion` and `CampaignBriefDrawer`.

Then delete the two slot types that are now orphaned. In `contentStudioTypes.ts` remove:

```ts
export interface MatrixSlotProps {
  activePlatform: PlatformId;
  onPlatformChange: (platform: PlatformId) => void;
  onStageCaption: (caption: string) => void;
  stagedCaption: string;
}
export interface VisualDirectionSlotProps { activePlatform: PlatformId; }
```

`MatrixSlotProps` is already unreferenced today (AIContentMatrixPanel declares its own
`AIContentMatrixPanelProps`), and `VisualDirectionSlotProps` had exactly one consumer —
the file just deleted. Verify with:

```bash
grep -rn "MatrixSlotProps\|VisualDirectionSlotProps" --include=*.ts --include=*.tsx frontend/ | grep -v node_modules
```

Expected: no output.

- [ ] **Step 1b: Break the audit/publish deadlock (CORRECTION)**

Removing the platform picker and the authorisation checkbox from the composer creates a
circular deadlock, because two gates still demand the values those controls set:

- `CompliancePanel`'s `ready` requires `draft.agreementChecked && draft.platforms.length`,
  so "Run Compliance Audit" can never enable.
- `ContentStudioView`'s `canPublish` requires the same two, so Publish never appears, so
  the modal that now owns those controls can never be opened to set them.

The gates were written for the old screen, where the composer owned all of it. Re-cut them
along the new boundary: **the audit judges the caption against the media, so it needs only
those two. Choosing destinations and authorising publication are publishing concerns, and
they now live in the modal, where "Confirm & Publish" already gates on them (Task 19).**

In `CompliancePanel.tsx`:

```ts
  // Caption + media only. The audit scores caption-to-media consistency; it has
  // no opinion on which platforms the post is bound for, and authorisation is
  // about publishing rather than about running a check. Both of those moved to
  // the publish modal — requiring them here deadlocked the screen, because the
  // modal is only reachable through the audit this gate blocks.
  const ready = Boolean(draft.caption.trim() && draft.mediaDataUrl);
```

In `ContentStudioView.tsx`:

```ts
  // Reveals the Publish button. Platform choice and the authorisation tick are
  // the modal's job now, so they gate "Confirm & Publish" in there rather than
  // the button that opens it.
  const canPublish = Boolean(draft.caption.trim() && draft.mediaDataUrl && audit.result?.status === 'Pass');
```

In `PublishComposer.tsx`, `blockReason` still reports on platforms, authorisation and the
audit — none of which the composer owns any more, so it would tell the operator to use
controls that are not on screen. Reduce it to what this panel is responsible for:

```ts
function blockReason(draft: PublishDraftState) {
  if (!draft.caption.trim()) return 'Select an option above, or write your own caption.';
  if (!draft.mediaDataUrl) return 'Add a PNG, JPG, or WEBP image to run the audit.';
  return null;
}
```

and call it as `blockReason(draft)`. Drop `audit` from the composer's destructured props
if nothing else uses it.

The character counter also read its limit from `draft.platforms`, which is now always
empty until the modal opens — so every caption would be measured against the 5000
fallback. Pass the platform being drafted instead: add `platform: PlatformId` to
`ComposerSlotProps`, have the view pass `activePlatform`, and use
`PLATFORM_CHAR_LIMITS[platform]`.

Task 13's two existing CompliancePanel tests still pass under the new `ready`: its READY
fixture has both a caption and media, and its disabled-case nulls `mediaDataUrl`.

- [ ] **Step 2: Move the creative-direction fetch into the view**

Add to `ContentStudioView.tsx`, beside the existing content fetch:

```tsx
  const [direction, setDirection] = useState<CreativeDirection | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.creativeDirection
      .generate()
      .then((result) => { if (!cancelled) setDirection(result); })
      .catch(() => { if (!cancelled) setDirection(null); });
    return () => { cancelled = true; };
  }, []);
```

Import `CreativeDirection` from `'../../../types'`.

- [ ] **Step 3: Add the selection and drawer state**

```tsx
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [stageToken, setStageToken] = useState(0);
  const brief = useFirstRunDrawer();

  const stageCaption = (index: number, text: string) => {
    setSelectedOption(index);
    setStageToken((t) => t + 1);
    patchDraft({ caption: text, agreementChecked: false });
  };

  // A different platform has a different option set, so a stale index would
  // mark the wrong card as staged.
  useEffect(() => { setSelectedOption(null); }, [activePlatform]);
```

- [ ] **Step 4: Replace the render body**

```tsx
  return (
    <section className="studio-screen" aria-label="Content Studio">
      <PageHead
        eyebrow="Content Studio"
        title="Create content that fits the market"
        subtitle="Choose an AI direction, stage your media, then validate it before publishing."
        actions={
          markets.length > 0 ? (
            <label className="studio-market">
              <span className="studio-market-label">Target market</span>
              <select
                className="studio-select"
                value={selectedMarketId ?? ''}
                onChange={(event) => setSelectedMarketId(event.target.value)}
              >
                {markets.map((market) => (
                  <option key={market.id} value={market.id}>{market.name}</option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      />

      {marketsError != null && <div className="mb-4"><ApiErrorPanel error={marketsError} label="Markets" /></div>}

      {stubbed && (
        <div className="banner banner--warn mb-4" role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            <b>Showing stubbed content.</b> The AI service returned placeholder captions instead of
            a real generation — nothing below reflects an actual model output.
          </div>
        </div>
      )}

      {contentError != null && <div className="mb-4"><ApiErrorPanel error={contentError} label="Content Studio" /></div>}

      <div className="studio-flow">
        <StudioStepRail />

        <section id="studio-step-draft" className="studio-section">
          <AIContentMatrixPanel
            activePlatform={activePlatform}
            onPlatformChange={setActivePlatform}
            onSelectCaption={stageCaption}
            selectedOption={selectedOption}
            content={content}
            loading={contentLoading}
          />
        </section>

        <section id="studio-step-attach" className="studio-section">
          <PublishComposer
            draft={draft}
            onDraftChange={patchDraft}
            audit={audit}
            stageToken={stageToken}
            accordion={<ShotListAccordion direction={direction} onOpenBrief={brief.openDrawer} />}
          />
        </section>

        <section id="studio-step-validate" className="studio-section">
          <CompliancePanel draft={draft} audit={audit} onAuditChange={setAudit} />
        </section>

        <div className="studio-board">
          <ContentBoard draft={draft} posts={posts} canPublish={canPublish} onPublished={publish} />
        </div>
      </div>

      <button
        type="button"
        className="brief-trigger"
        data-hidden={brief.open}
        data-pulse={brief.showTooltip}
        onClick={brief.openDrawer}
      >
        <BookOpen size={16} aria-hidden="true" />
        View Campaign Brief
        {brief.showTooltip && <span className="brief-tip">Your moodboard and caption rationale live here</span>}
      </button>

      <CampaignBriefDrawer
        open={brief.open}
        onClose={brief.closeDrawer}
        showWelcome={brief.showWelcome}
        direction={direction}
        content={content}
        platform={activePlatform}
      />
    </section>
  );
```

Add the imports: `BookOpen` from `lucide-react`; `StudioStepRail`, `ShotListAccordion`, `CampaignBriefDrawer` from their new files; `useFirstRunDrawer` from `./useFirstRunDrawer`.

- [ ] **Step 5: Swap the matrix's card list for the grid**

In `AIContentMatrixPanel.tsx`, delete the whole `CaptionOptionCard` function and the `REASON_FIELDS` constant (the rationale now lives in the drawer). Change the props to:

```tsx
export interface AIContentMatrixPanelProps {
  activePlatform?: PlatformId;
  onPlatformChange?: (platform: PlatformId) => void;
  /** Called when an option is chosen, to stage it in the composer below. */
  onSelectCaption?: (index: number, text: string) => void;
  /** Index of the staged option for the active platform, or null. */
  selectedOption?: number | null;
  content?: ContentResponse | null;
  loading?: boolean;
}
```

and replace the caption-rendering block with:

```tsx
      {!loading && captions && (
        <div className="mt-4">
          <CaptionOptionGrid
            captions={captions}
            selectedIndex={selectedOption ?? null}
            onSelect={(index, text) => onSelectCaption?.(index, text)}
          />
        </div>
      )}
```

Keep `PLATFORM_CHAR_LIMITS` exported — `PublishComposer` and `platformPreview.ts` both import it.

- [ ] **Step 6: Accept the accordion slot in the composer**

In `PublishComposer.tsx`, add `accordion?: ReactNode` to the destructured props and render it immediately above the Publication media group:

```tsx
        <div>
          {accordion}
          <span className="field-label mt-5 block">Publication media</span>
          {/* …existing media markup unchanged… */}
        </div>
```

Also **delete** the platform picker `<fieldset>`, the `.composer-opts` block and the `.composer-agree` label — those move to the publish modal in Task 17. Keep the staged caption, the media block and the `reason` line.

- [ ] **Step 7: Update the existing view test**

`ContentStudioView.test.tsx` currently asserts on the removed per-card Approve flow. Replace its staging assertion with:

```tsx
  it('stages a selected option into the composer', async () => {
    generateMock.mockResolvedValue(buildContentResponse());
    render(<ContentStudioView />);

    const select = await screen.findAllByRole('button', { name: 'Select' });
    await userEvent.click(select[0]);

    expect((screen.getByLabelText('Staged caption') as HTMLTextAreaElement).value)
      .toBe('Instagram caption text');
  });
```

- [ ] **Step 8: Run the module's tests**

Run: `npx vitest run components/module-3`
Expected: PASS — all files green.

- [ ] **Step 9: Typecheck and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: only the pre-existing `CalendarView.tsx(61,106)` error; `✓ built`.

- [ ] **Step 10: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio frontend/styles/index.css
git commit -m "refactor(module-3): recompose content studio as a linear flow"
```

---

# Phase 5 — Dark Mode Publishing Modal

### Task 16: Full-screen modal variant

**Files:**
- Modify: `frontend/components/shared/Modal.tsx`
- Modify: `frontend/styles/index.css`
- Test: `frontend/components/shared/Modal.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';
import { OverlayStackProvider } from './useOverlayStack';

describe('Modal variants', () => {
  it('defaults to the centred panel', () => {
    const { container } = render(
      <OverlayStackProvider>
        <Modal open onClose={vi.fn()} title="T"><p>body</p></Modal>
      </OverlayStackProvider>,
    );
    expect(container.querySelector('.modal-panel')).not.toBeNull();
    expect(container.querySelector('.modal-panel--full')).toBeNull();
  });

  it('renders full-screen without the default chrome when asked', () => {
    const { container } = render(
      <OverlayStackProvider>
        <Modal open onClose={vi.fn()} variant="full" label="Publish"><p>body</p></Modal>
      </OverlayStackProvider>,
    );
    expect(container.querySelector('.modal-panel--full')).not.toBeNull();
    expect(screen.getByRole('dialog', { name: 'Publish' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/shared/Modal.test.tsx`
Expected: FAIL — `variant` is not a prop.

- [ ] **Step 3: Extend the component**

```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** 'full' is an edge-to-edge surface that owns its own header. */
  variant?: 'panel' | 'full';
  /** Names the dialog when it has no visible `title`. */
  label?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, variant = 'panel', label, children }: ModalProps) {
  const { push, pop, isOpen } = useOverlayStack();

  useEffect(() => {
    if (open) push('modal');
    else pop('modal');
    return () => pop('modal');
  }, [open, push, pop]);

  if (!open) return null;

  return (
    <div
      className="modal on fixed inset-0 z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={label ?? title}
      data-open={isOpen('modal')}
    >
      <div className={`modal-panel ${variant === 'full' ? 'modal-panel--full' : ''}`}>
        {variant === 'panel' && (
          <div className="mb-4 flex items-center justify-between">
            {title && <h2 className="heading-md">{title}</h2>}
            <button type="button" onClick={onClose} aria-label="Close" className="icon-btn">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the full-screen surface**

```css
  /* Edge-to-edge variant. Owns no header of its own — the publishing modal
     supplies one, because its header carries platform tabs. */
  .modal-panel--full {
    max-width: none;
    width: 100vw;
    height: 100dvh;
    padding: 0;
    border-radius: 0;
    background: var(--color-chrome-deep);
    overflow: hidden;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/shared/Modal.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/shared/Modal.tsx frontend/components/shared/Modal.test.tsx frontend/styles/index.css
git commit -m "feat(shared): add full-screen modal variant"
```

---

### Task 17: Platform preview specs

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/platformPreview.ts`
- Test: `frontend/components/module-3/3.1-content-studio/platformPreview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { PLATFORM_PREVIEWS, truncateForPlatform } from './platformPreview';

describe('platformPreview', () => {
  it('describes every platform the composer can target', () => {
    expect(Object.keys(PLATFORM_PREVIEWS).sort()).toEqual(['facebook', 'instagram', 'naver', 'tiktok']);
    expect(PLATFORM_PREVIEWS.instagram.aspect).toBe('4 / 5');
    expect(PLATFORM_PREVIEWS.tiktok.aspect).toBe('9 / 16');
    expect(PLATFORM_PREVIEWS.facebook.aspect).toBe('1 / 1');
  });

  it('cuts a caption at the platform fold and flags the remainder', () => {
    const long = 'x'.repeat(400);
    const ig = truncateForPlatform(long, 'instagram');
    expect(ig.visible.length).toBe(125);
    expect(ig.truncated).toBe(true);

    // TikTok shows no fold — the whole caption is the hook.
    const tt = truncateForPlatform('short caption', 'tiktok');
    expect(tt.visible).toBe('short caption');
    expect(tt.truncated).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/platformPreview.test.ts`
Expected: FAIL — `Failed to resolve import "./platformPreview"`.

- [ ] **Step 3: Write minimal implementation**

```ts
/**
 * Per-platform preview treatment for the publishing modal's phone frame.
 *
 * The fold values are not invented: MOCK_CONTENT's own optionMetadata states
 * them for each platform — Instagram "hook lands inside the first 125
 * characters before the fold", Facebook "hook inside ~250 chars", TikTok "the
 * entire caption is the hook because TikTok shows no fold". Naver is long-form
 * editorial, so its fold is the excerpt length rather than a feed truncation.
 */
import type { PlatformId } from '../../../types';

export interface PlatformPreview {
  label: string;
  /** CSS aspect-ratio for the media inside the bezel. */
  aspect: string;
  /** Characters visible before the platform's "more" link. */
  fold: number;
  /** Which UI overlay the frame draws. */
  chrome: 'grid' | 'feed' | 'post' | 'blog';
}

export const PLATFORM_PREVIEWS: Record<PlatformId, PlatformPreview> = {
  instagram: { label: 'Instagram Grid', aspect: '4 / 5', fold: 125, chrome: 'grid' },
  tiktok: { label: 'TikTok Feed', aspect: '9 / 16', fold: 300, chrome: 'feed' },
  facebook: { label: 'Facebook Post', aspect: '1 / 1', fold: 250, chrome: 'post' },
  naver: { label: 'Naver Blog', aspect: '4 / 3', fold: 400, chrome: 'blog' },
};

export interface TruncatedCaption {
  visible: string;
  truncated: boolean;
}

export function truncateForPlatform(caption: string, platform: PlatformId): TruncatedCaption {
  const { fold } = PLATFORM_PREVIEWS[platform];
  if (caption.length <= fold) return { visible: caption, truncated: false };
  return { visible: caption.slice(0, fold), truncated: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/platformPreview.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/platformPreview.ts frontend/components/module-3/3.1-content-studio/platformPreview.test.ts
git commit -m "feat(module-3): add platform preview specs"
```

---

### Task 18: Phone preview component

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/PhonePreview.tsx`
- Modify: `frontend/styles/index.css`
- Test: `frontend/components/module-3/3.1-content-studio/PhonePreview.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PhonePreview from './PhonePreview';

const CAPTION = 'y'.repeat(400);

describe('PhonePreview', () => {
  it('applies the platform aspect ratio to the media', () => {
    const { container } = render(
      <PhonePreview platform="instagram" caption={CAPTION} mediaDataUrl="data:image/png;base64,x" />,
    );
    const media = container.querySelector('.phone-media') as HTMLElement;
    expect(media.style.aspectRatio).toBe('4 / 5');
  });

  it('reformats when the platform changes', () => {
    const { container, rerender } = render(
      <PhonePreview platform="instagram" caption={CAPTION} mediaDataUrl="data:image/png;base64,x" />,
    );
    rerender(<PhonePreview platform="tiktok" caption={CAPTION} mediaDataUrl="data:image/png;base64,x" />);
    expect((container.querySelector('.phone-media') as HTMLElement).style.aspectRatio).toBe('9 / 16');
    expect(container.querySelector('.phone-frame')).toHaveAttribute('data-chrome', 'feed');
  });

  it('cuts the caption at the fold and offers more', () => {
    render(<PhonePreview platform="instagram" caption={CAPTION} mediaDataUrl={null} />);
    expect(screen.getByTestId('phone-caption').textContent).toContain('y'.repeat(125));
    expect(screen.getByText('… more')).toBeTruthy();
  });

  it('shows a placeholder when no media is staged', () => {
    render(<PhonePreview platform="instagram" caption="hi" mediaDataUrl={null} />);
    expect(screen.getByTestId('phone-media-empty')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/PhonePreview.test.tsx`
Expected: FAIL — `Failed to resolve import "./PhonePreview"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
/**
 * Stylised phone frame showing the staged post as the chosen platform would
 * render it: the platform's aspect ratio, its caption fold, and a hint of its
 * own UI furniture.
 *
 * Approximate by design. It exists to catch "the crop eats the subject" and
 * "the hook is below the fold" before publishing, not to be a pixel-accurate
 * emulator of four apps.
 */
import { Heart, MessageCircle, Send } from 'lucide-react';
import { PLATFORM_PREVIEWS, truncateForPlatform } from './platformPreview';
import type { PlatformId } from '../../../types';

export interface PhonePreviewProps {
  platform: PlatformId;
  caption: string;
  mediaDataUrl: string | null;
}

export default function PhonePreview({ platform, caption, mediaDataUrl }: PhonePreviewProps) {
  const spec = PLATFORM_PREVIEWS[platform];
  const { visible, truncated } = truncateForPlatform(caption, platform);

  return (
    <div className="phone-frame" data-chrome={spec.chrome}>
      <div className="phone-notch" aria-hidden="true" />
      <div className="phone-screen">
        <div className="phone-media" style={{ aspectRatio: spec.aspect }}>
          {mediaDataUrl ? (
            <img src={mediaDataUrl} alt="" />
          ) : (
            <span className="phone-media-empty" data-testid="phone-media-empty">No media staged</span>
          )}
        </div>

        <div className="phone-actions" aria-hidden="true">
          <Heart size={16} /><MessageCircle size={16} /><Send size={16} />
        </div>

        <p className="phone-caption" data-testid="phone-caption">
          {visible}
          {truncated && <span className="phone-more">… more</span>}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the bezel styles**

```css
  /* Phone bezel. Fixed 300px width so the aspect-ratio on .phone-media is what
     changes between platforms, not the frame — a resizing bezel would read as
     a different device rather than a different crop. */
  .phone-frame {
    width: 300px;
    margin-inline: auto;
    padding: 12px;
    border-radius: 38px;
    background: #0B1A2A;
    border: 1px solid var(--chrome-line);
    box-shadow: var(--shadow-overlay);
    position: relative;
  }
  .phone-notch {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
    width: 84px;
    height: 6px;
    border-radius: var(--radius-full);
    background: rgba(255, 255, 255, 0.22);
  }
  .phone-screen {
    border-radius: 28px;
    background: var(--color-white);
    overflow: hidden;
    padding-top: 28px;
  }
  .phone-media {
    width: 100%;
    background: var(--color-mint-pale);
    display: grid;
    place-items: center;
    overflow: hidden;
    /* The ratio itself is set inline per platform. */
  }
  .phone-media img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .phone-media-empty {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--color-text-muted);
  }
  .phone-actions {
    display: flex;
    gap: var(--space-sm);
    padding: 10px var(--space-sm) 0;
    color: var(--color-navy-dark);
  }
  .phone-caption {
    padding: var(--space-xs) var(--space-sm) var(--space-sm);
    font-family: var(--font-body);
    font-size: 0.8125rem;
    line-height: 1.5;
    color: var(--color-navy-dark);
    white-space: pre-wrap;
    word-break: break-word;
  }
  .phone-more {
    color: var(--color-text-muted);
  }
  /* TikTok is full-bleed: no action row above the caption, and the caption
     sits over the media rather than beneath it. */
  .phone-frame[data-chrome='feed'] .phone-actions {
    display: none;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/PhonePreview.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/PhonePreview.tsx frontend/components/module-3/3.1-content-studio/PhonePreview.test.tsx frontend/styles/index.css
git commit -m "feat(module-3): add phone preview frame"
```

---

### Task 19: Publish modal

**Files:**
- Create: `frontend/components/module-3/3.1-content-studio/PublishModal.tsx`
- Modify: `frontend/styles/index.css`
- Test: `frontend/components/module-3/3.1-content-studio/PublishModal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PublishModal from './PublishModal';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { PublishDraftState } from './contentStudioTypes';

const DRAFT: PublishDraftState = {
  caption: 'A staged caption', mediaDataUrl: 'data:image/png;base64,x', platforms: ['instagram'],
  visibility: 'public', commentsEnabled: true, paidPartnership: false, agreementChecked: false,
};

function setup(over: Partial<PublishDraftState> = {}, onConfirm = vi.fn(), onDraftChange = vi.fn()) {
  // Spreads the render result so cases can reach `container` as well as the
  // spies — the DOM assertions below query by class, which screen cannot do.
  const view = render(
    <OverlayStackProvider>
      <PublishModal
        open
        draft={{ ...DRAFT, ...over }}
        onDraftChange={onDraftChange}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    </OverlayStackProvider>,
  );
  return { ...view, onConfirm, onDraftChange };
}

describe('PublishModal', () => {
  it('splits controls from the preview', () => {
    const { container } = setup();
    expect(container.querySelector('.pub-controls')).not.toBeNull();
    expect(container.querySelector('.pub-preview .phone-frame')).not.toBeNull();
  });

  it('reformats the preview when a platform tab is clicked', async () => {
    const { container } = setup();
    await userEvent.click(screen.getByRole('tab', { name: 'TikTok Feed' }));
    expect((container.querySelector('.phone-media') as HTMLElement).style.aspectRatio).toBe('9 / 16');
  });

  it('blocks confirm until the agreement is ticked', async () => {
    const { onConfirm } = setup();
    expect(screen.getByRole('button', { name: /Confirm & Publish/ })).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms once authorised', async () => {
    const onConfirm = vi.fn();
    setup({ agreementChecked: true }, onConfirm);
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Publish/ }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/PublishModal.test.tsx`
Expected: FAIL — `Failed to resolve import "./PublishModal"`.

- [ ] **Step 3: Write minimal implementation**

```tsx
/**
 * Full-screen publishing modal.
 *
 * Publishing is the one irreversible action on this screen, so it gets the
 * whole viewport and a dark surface: everything behind it is out of scope
 * while it is open, and the operator's last look at the post happens with
 * nothing else competing.
 *
 * Left panel = decisions. Right panel = consequences. The platform tabs sit
 * above the phone because they change what the phone shows, not what the
 * controls do.
 */
import { useState } from 'react';
import { Lock, Send } from 'lucide-react';
import Modal from '../../shared/Modal';
import PhonePreview from './PhonePreview';
import { PLATFORM_PREVIEWS } from './platformPreview';
import type { PlatformId } from '../../../types';
import type { PublishDraftState } from './contentStudioTypes';

const PLATFORM_LABELS: Record<PlatformId, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', naver: 'Naver Blog',
};

export interface PublishModalProps {
  open: boolean;
  draft: PublishDraftState;
  onDraftChange: (patch: Partial<PublishDraftState>) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PublishModal({ open, draft, onDraftChange, onClose, onConfirm }: PublishModalProps) {
  // Preview platform is independent of the publish targets: the operator needs
  // to check how it looks on TikTok even before ticking TikTok as a target.
  const [previewPlatform, setPreviewPlatform] = useState<PlatformId>(draft.platforms[0] ?? 'instagram');

  const togglePlatform = (platform: PlatformId) => onDraftChange({
    platforms: draft.platforms.includes(platform)
      ? draft.platforms.filter((p) => p !== platform)
      : [...draft.platforms, platform],
  });

  return (
    <Modal open={open} onClose={onClose} variant="full" label="Publish">
      <div className="pub-shell">
        <div className="pub-controls">
          <h2 className="pub-title">Publish</h2>

          <fieldset className="pub-group">
            <legend>Publish to</legend>
            <div className="plat-grid">
              {(Object.keys(PLATFORM_LABELS) as PlatformId[]).map((platform) => (
                <label key={platform} className="plat-opt" data-on={draft.platforms.includes(platform)}>
                  <input
                    type="checkbox"
                    checked={draft.platforms.includes(platform)}
                    onChange={() => togglePlatform(platform)}
                  />
                  {PLATFORM_LABELS[platform]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="pub-group">
            <label className="field-label" htmlFor="pub-caption">Final caption</label>
            <textarea
              id="pub-caption"
              className="textarea"
              value={draft.caption}
              onChange={(event) => onDraftChange({ caption: event.target.value })}
            />
          </div>

          <label className="composer-agree">
            <input
              type="checkbox"
              checked={draft.agreementChecked}
              onChange={(event) => onDraftChange({ agreementChecked: event.target.checked })}
            />
            <span>
              <Lock size={15} className="mr-1 inline" aria-hidden="true" />
              I confirm I am authorised to publish this media and caption.
            </span>
          </label>
        </div>

        <div className="pub-preview">
          <div className="seg seg--wrap" role="tablist" aria-label="Preview platform">
            {(Object.keys(PLATFORM_PREVIEWS) as PlatformId[]).map((platform) => (
              <button
                key={platform}
                type="button"
                role="tab"
                aria-selected={previewPlatform === platform}
                onClick={() => setPreviewPlatform(platform)}
              >
                {PLATFORM_PREVIEWS[platform].label}
              </button>
            ))}
          </div>

          <PhonePreview
            platform={previewPlatform}
            caption={draft.caption}
            mediaDataUrl={draft.mediaDataUrl}
          />
        </div>

        <div className="pub-foot">
          <button type="button" className="btn-outline btn-outline--inverse" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-cta"
            disabled={!draft.agreementChecked || draft.platforms.length === 0}
            onClick={onConfirm}
          >
            <Send size={16} aria-hidden="true" /> Confirm &amp; Publish
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Add the dark split-screen styles**

```css
  /* Dark publishing surface. Uses the brand's chrome tokens rather than a new
     grey ramp — --gradient-chrome is the same surface the sidebar and the
     onboarding rail run, so the modal reads as this product in a dark mood
     rather than as a different application. */
  .pub-shell {
    display: grid;
    grid-template-rows: 1fr auto;
    grid-template-columns: minmax(0, 1fr);
    height: 100dvh;
    background: var(--gradient-chrome);
    color: var(--color-text-inverse);
    overflow-y: auto;
  }
  @media (min-width: 900px) {
    .pub-shell {
      grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
      grid-template-rows: 1fr auto;
      overflow: hidden;
    }
    .pub-foot {
      grid-column: 1 / -1;
    }
    .pub-controls,
    .pub-preview {
      overflow-y: auto;
    }
  }
  .pub-controls {
    padding: var(--space-lg) var(--space-md);
    background: rgba(0, 0, 0, 0.18);
    border-right: 1px solid var(--chrome-line);
  }
  .pub-title {
    font-family: var(--font-heading);
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text-inverse);
    margin-bottom: var(--space-md);
  }
  .pub-group {
    margin-bottom: var(--spacing-8);
  }
  .pub-group legend,
  .pub-controls .field-label {
    color: var(--color-text-inverse);
    margin-bottom: 10px;
  }
  /* Controls sitting ON chrome take white tints, never white cards — a white
     card on a dark rail breaks the surface (branding §5). */
  .pub-controls .plat-opt {
    background: var(--chrome-raised);
    border-color: var(--chrome-line);
    color: var(--color-text-inverse);
  }
  .pub-controls .plat-opt[data-on='true'] {
    border-color: var(--color-mint-primary);
    background: rgba(95, 214, 166, 0.16);
  }
  .pub-controls .textarea {
    background: var(--chrome-raised);
    border-color: var(--chrome-line);
    color: var(--color-text-inverse);
    box-shadow: none;
  }
  .pub-controls .composer-agree {
    background: var(--chrome-raised);
    color: var(--color-text-inverse);
  }
  .pub-preview {
    display: grid;
    gap: var(--space-md);
    justify-items: center;
    align-content: start;
    padding: var(--space-lg) var(--space-md);
  }
  /* Sticky, bottom-right, always reachable however far the left panel has
     been scrolled. */
  .pub-foot {
    position: sticky;
    bottom: 0;
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-chrome-deep);
    border-top: 1px solid var(--chrome-line);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/PublishModal.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/PublishModal.tsx frontend/components/module-3/3.1-content-studio/PublishModal.test.tsx frontend/styles/index.css
git commit -m "feat(module-3): add dark publishing modal"
```

---

### Task 20: Wire the modal to the revealed Publish button

**Files:**
- Modify: `frontend/components/module-3/3.1-content-studio/ContentStudioView.tsx`
- Test: `frontend/components/module-3/3.1-content-studio/ContentStudioView.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
  it('opens the publishing modal from the revealed Publish button', async () => {
    generateMock.mockResolvedValue(buildContentResponse());
    render(<ContentStudioView initialDraft={DEMO_DRAFT} />);

    // Publish is hidden until the audit passes, so drive the flow to that point
    // through the UI rather than reaching into state.
    await userEvent.click(screen.getByRole('checkbox', { name: /authorised to publish/ }));
    await userEvent.click(screen.getByRole('button', { name: /Run Compliance Audit/ }));

    const publish = await screen.findByRole('button', { name: /^Publish/ }, { timeout: 8000 });
    await userEvent.click(publish);

    expect(await screen.findByRole('dialog', { name: 'Publish' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Confirm & Publish/ })).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/module-3/3.1-content-studio/ContentStudioView.test.tsx`
Expected: FAIL — no dialog named "Publish".

- [ ] **Step 3: Add the modal state and confirm handler**

```tsx
  const [publishOpen, setPublishOpen] = useState(false);

  const confirmPublish = () => {
    publish();
    setPublishOpen(false);
  };
```

Change `ContentBoard`'s `onPublished` to open the modal instead of publishing directly:

```tsx
          <ContentBoard
            draft={draft}
            posts={posts}
            canPublish={canPublish}
            onPublished={() => setPublishOpen(true)}
          />
```

and mount the modal beside the drawer:

```tsx
      <PublishModal
        open={publishOpen}
        draft={draft}
        onDraftChange={patchDraft}
        onClose={() => setPublishOpen(false)}
        onConfirm={confirmPublish}
      />
```

Import `PublishModal` from `./PublishModal`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/module-3/3.1-content-studio/ContentStudioView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full verification**

Run: `npx tsc --noEmit`
Expected: only `CalendarView.tsx(61,106)`.

Run: `npx vitest run`
Expected: `3 failed` (the pre-existing auth failures) and every other test passing. Total passing should be **higher** than the 347 baseline.

Run: `npx vite build`
Expected: `✓ built`.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/module-3/3.1-content-studio/ContentStudioView.tsx frontend/components/module-3/3.1-content-studio/ContentStudioView.test.tsx
git commit -m "feat(module-3): open publishing modal from the revealed Publish action"
```

---

## Manual verification checklist

Run `npm run dev` in `frontend/` and open `http://localhost:3001/preview/content`.

- [ ] The page is one centred column; there is no right-hand rail.
- [ ] Numbered indicators (1 Draft, 2 Attach, 3 Validate) run as a single horizontal row above the AI Copywriting Matrix card, at every width, with connectors between them.
- [ ] Scrolling moves the highlight down the rail; clicking a step scrolls to that section with the heading clear of the topbar.
- [ ] The cards run the same width as the dashboard's — `.studio-flow` has no cap of its own, so `.app-main > *` centres both screens at `--content-max` with identical side margins. Flip between /dashboard and /content and confirm the left and right edges line up.
- [ ] The campaign brief drawer opens by itself on the very first load, with the welcome note.
- [ ] Closing it and reloading leaves it closed and hides the welcome note.
- [ ] Clearing `ceview.contentStudio.briefSeen` in DevTools → Application → Local Storage replays the auto-open.
- [ ] The "View Campaign Brief" tab is fixed to the right edge and reopens the drawer.
- [ ] Caption options render three abreast, clamped to four lines, with a working Expand.
- [ ] Naver renders **two** cards, not two plus a gap.
- [ ] Select highlights the staged caption field and copies the text into it.
- [ ] "Review Shot List & Visual Direction" is closed on arrival and sits directly above the upload zone.
- [ ] "Review Full Brief" inside it opens the drawer.
- [ ] "Run Compliance Audit" is disabled until caption + media + platform + authorisation are all present, and the audit does **not** start on its own.
- [ ] No Publish button exists anywhere until the audit returns a passing score.
- [ ] Publish opens a full-screen dark modal; controls left, phone right.
- [ ] Switching platform tabs changes the image crop and the caption cut-off inside the bezel.
- [ ] "Confirm & Publish" stays visible at the bottom-right while the left panel scrolls.
- [ ] Escape closes the modal, then the drawer — one overlay per press.
- [ ] With `prefers-reduced-motion` enabled (DevTools → Rendering), the brief-button pulse and the staged-caption flash do not animate.

---

## Risks and decisions worth a second look

1. **The rail is decorative below 1280px.** The steps vanish rather than reflowing to a horizontal stepper. 1280px was chosen over 1180px because at 1180px the 132px rail encroaches on the sidebar boundary: the containing block is only ~836px after the 248px sidebar and .app-main's 2x48px padding, leaving the rail ~20px of clearance before a scrollbar. The rail clears fully at 1236px; 1280px gives ~70px of margin. A horizontal sticky stepper for narrow widths is a follow-up, not part of this plan.

2. **Naver has no `optionMetadata`.** `CampaignBriefDrawer` renders nothing under "Copywriting matrix" for Naver. That is faithful to the fixture, but it will look like a bug. Consider a "No rationale for this platform" line if it bothers you in review.

3. **The publish modal has no focus trap.** `Modal` sets `aria-modal` but nothing keeps Tab inside the dialog — pre-existing across the app, and it becomes more visible on a full-screen modal. Worth its own task if accessibility is in scope for this milestone.

4. **Removing the per-card textarea is a real capability loss.** Today an operator can tune option 2 in place and approve it. After Task 10 they must Select first and edit in the staged field. That is the intended simplification, but it is a behaviour change worth confirming before Task 10 lands.

5. **Phase 5 could be its own plan.** Tasks 16–20 are self-contained and depend on Phase 4 only for the reveal. If the review cycle is long, ship Phases 1–4 and split Phase 5 out.
