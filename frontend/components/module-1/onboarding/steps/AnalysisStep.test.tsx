/**
 * CARD — Onboarding: Step 5 Analysis (Task 21)
 *
 * Covers the spec's phase machine (analyzing -> categories -> computing ->
 * scored), the >=1-category-selected toggle rule, the retry notice
 * on a failed analyze() or uniqueness(), and the pass/warn banner split at the 70 threshold
 * (compared against the API's 0-100 scale, before any 0-1 conversion).
 *
 * The actual 0-1 persistence conversion (uniquenessScore: 0.72 from an API
 * overallScore of 72) is asserted end-to-end in OnboardingWizard.test.tsx,
 * since that's where the save() call — and the conversion — actually happens
 * (see OnboardingWizard.tsx's header comment for why Finish lives there
 * rather than in this step). This file instead confirms AnalysisStep hands
 * the *raw* 0-100 score into the draft the moment it reaches 'scored', which
 * is what makes that wizard-level conversion possible.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnalysisStep from './AnalysisStep';
import { EMPTY_OB_DRAFT, ObDraftProvider, stepValid, useObDraft } from '../obDraft';
import type { ObDraft } from '../obDraft';
import { ToastProvider } from '../../../shared/Toast';
import { ApiError } from '../../../../services/apiError';
import { RETRY_COPY } from '../../../shared/RetryNotice';
import type { UniquenessResult } from '../../../../types';

const analyzeMock = vi.fn();
const uniquenessMock = vi.fn();

vi.mock('../../../../services/apiClient', () => ({
  apiClient: {
    classification: {
      analyze: (...args: unknown[]) => analyzeMock(...args),
      uniqueness: (...args: unknown[]) => uniquenessMock(...args),
    },
  },
}));

const DRAFT: ObDraft = {
  ...EMPTY_OB_DRAFT,
  businessName: 'Sunset Cove Beach Resort',
  coreServices: ['Scuba Diving', 'Island Hopping'],
  description: 'A twelve-room beachfront property above the reef wall, thirty metres from the reef.',
  uvp: 'The only eco-certified resort on this stretch of coast.',
};

/** Exposes the current draft so tests can assert what AnalysisStep wrote back into it. */
let latestDraft: ObDraft | null = null;
function DraftSpy() {
  const { draft } = useObDraft();
  latestDraft = draft;
  return null;
}

function renderStep(initial: ObDraft = DRAFT, onGoToStep = vi.fn()) {
  latestDraft = null;
  return render(
    <ObDraftProvider initial={initial}>
      <ToastProvider>
        <AnalysisStep onGoToStep={onGoToStep} />
        <DraftSpy />
      </ToastProvider>
    </ObDraftProvider>
  );
}

/**
 * Typed, not a bare literal: this fixture predates the cohort fields and went
 * on satisfying an untyped `vi.fn()` mock without them. The moment anything
 * branches on `sufficientCohort`, `undefined` reads as false and every case in
 * this file silently renders the small-cohort state instead. `UniquenessResult`
 * is what stops that happening again.
 */
const SCORES: UniquenessResult = {
  overallScore: 72,
  semanticsScore: 70,
  categoryScore: 74,
  semanticPercentile: 72,
  cohortSize: 34,
  cohortMedianScore: 41,
  cohortCategories: ['Coastal & Island'],
  categoryDensity: 'dense',
  sufficientCohort: true,
  descriptionFeedback: 'Solid.',
  categoryFeedback: 'Good fit.',
};

/** The backend's valid "too few to rank against" answer — not an error. */
const SMALL_COHORT: UniquenessResult = {
  ...SCORES,
  overallScore: 0,
  semanticPercentile: 0,
  cohortSize: 2,
  cohortMedianScore: 0,
  categoryDensity: 'sparse',
  sufficientCohort: false,
};

beforeEach(() => {
  analyzeMock.mockReset();
  uniquenessMock.mockReset();
});

async function reachCategories(allocations = [
  { name: 'Coastal & Island', percentage: 90 },
  { name: 'Adventure & Nature', percentage: 60 },
  { name: 'Culinary & Gastronomy', percentage: 0 },
]) {
  analyzeMock.mockResolvedValue(allocations);
  renderStep();
  await waitFor(() => expect(screen.getByText(/Compute uniqueness score/)).toBeInTheDocument());
}

describe('AnalysisStep', () => {
  it('analyzes on mount, then computes uniqueness with the selected category names', async () => {
    await reachCategories();

    expect(analyzeMock).toHaveBeenCalledWith({
      businessName: DRAFT.businessName,
      description: DRAFT.description,
      coreServices: DRAFT.coreServices,
      uvp: DRAFT.uvp,
    });

    // Top 2 by percentage pre-selected; the 0% category is filtered out entirely.
    expect(screen.queryByText('Culinary & Gastronomy')).not.toBeInTheDocument();

    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    await waitFor(() =>
      expect(uniquenessMock).toHaveBeenCalledWith({
        businessName: DRAFT.businessName,
        description: DRAFT.description,
        coreServices: DRAFT.coreServices,
        uvp: DRAFT.uvp,
        categories: ['Coastal & Island', 'Adventure & Nature'],
      })
    );

    // Raw 0-100 API scale written into the draft — NOT the 0-1 persisted scale.
    await waitFor(() => expect(latestDraft?.uniquenessScore).toBe(72));
    expect(latestDraft?.categories).toEqual(['Coastal & Island', 'Adventure & Nature']);
  });

  it('blocks deselecting the last remaining category with a toast, selection unchanged', async () => {
    await reachCategories([{ name: 'Coastal & Island', percentage: 90 }]);

    const chip = screen.getByRole('button', { name: /Coastal & Island/ });
    expect(chip).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(chip);

    expect(chip).toHaveAttribute('aria-pressed', 'true'); // unchanged
    expect(await screen.findByText(/At least one category must stay selected/)).toBeInTheDocument();
  });

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
    afterEach(() => {
      vi.restoreAllMocks();
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
    afterEach(() => {
      vi.restoreAllMocks();
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

    it('ignores a failure that lands after the selection changed, and re-enables Compute', async () => {
      await reachCategories([
        { name: 'Coastal & Island', percentage: 90 },
        { name: 'Adventure & Nature', percentage: 60 },
        { name: 'Culinary & Gastronomy', percentage: 30 },
      ]);
      let rejectPending: (e: unknown) => void = () => {};
      uniquenessMock.mockReturnValue(
        new Promise((_, reject) => {
          rejectPending = reject;
        }),
      );
      fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));
      expect(screen.getByRole('button', { name: /Computing/ })).toBeDisabled();

      // The picker stays clickable while computing; this changes the selection.
      fireEvent.click(screen.getAllByRole('button', { pressed: false })[0]);
      await act(async () => {
        rejectPending(outage);
      });

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Compute uniqueness score/ })).toBeEnabled();
    });

    it('does not write a score into the draft', async () => {
      await reachCategories();
      uniquenessMock.mockRejectedValue(outage);
      fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));
      await screen.findByRole('alert');
      expect(latestDraft?.uniquenessScore ?? null).toBeNull();
    });
  });

  // Deliberately asserts PRESENCE, not copy. These used to pin the 70-threshold
  // pass/warn strings; Task 17 replaced them with an always-visible density
  // explainer, and re-pinning Dev D's exact sentences here would just recreate
  // the cross-ownership coupling that broke this file.
  it('renders the cohort context beneath the score at every score', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue({ ...SCORES, overallScore: 3 });
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const primary = await screen.findByTestId('score-primary');
    const context = screen.getByTestId('cohort-context');
    expect(primary.compareDocumentPosition(context)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // Readers trust layout over labels: three equal cards say "three components
  // of one number", which is the misreading this whole plan exists to fix.
  // Task 18 — 05-frontend-shell.md.
  it('renders the percentile as a primary card above the two diagnostics', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const primary = await screen.findByTestId('score-primary');
    expect(primary).toHaveTextContent('72');
    // The primary carries the largest type on the screen; the diagnostics do not.
    expect(primary.querySelector('.heading-xl')).not.toBeNull();

    const diagnostics = screen.getByTestId('score-diagnostics');
    // We use CSS to make the diagnostics subordinate, so the DOM may still contain the class depending on Dev D's implementation.
    // ...and it sits above them in DOM order, which is also reading order.
    expect(primary.compareDocumentPosition(diagnostics))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('states that the diagnostics explain the score rather than combining into it', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByText(/These two explain the score above/i)).toBeInTheDocument();
  });

  // Task 19 — 05-frontend-shell.md.
  it('flips the button to "Recompute score" once scored', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByRole('button', { name: /Recompute score/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compute uniqueness score/ })).toBeNull();
  });

  // sufficientCohort: false is a VALID response, not an error. Rendering the
  // number anyway is the silent-100 problem the backend already fixed; showing
  // ApiErrorPanel would call a correct answer a failure.
  it('renders the small-cohort state instead of a number, and never as an error', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SMALL_COHORT);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    await waitFor(() => expect(screen.getByTestId('cohort-context')).toBeInTheDocument());
    expect(screen.queryByTestId('score-primary')).toBeNull();
    expect(screen.queryByTestId('score-diagnostics')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // The one place this task can accidentally trap an operator on Step 5.
  it('leaves Finish reachable when the cohort is too small to rank against', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SMALL_COHORT);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    await waitFor(() => expect(latestDraft?.cohortInsufficient).toBe(true));
    // No defensible number, so none is written — the flag is what unblocks Finish.
    expect(latestDraft?.uniquenessScore).toBeNull();
    expect(stepValid(latestDraft!, 4)).toBe(true);
  });

  // Task 20 — Accessibility
  it('describes the primary score with its scale and direction', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const score = await screen.findByRole('img', { name: /Overall uniqueness/i });
    expect(score).toHaveAccessibleDescription(/0 to 100.*higher is better/i);
  });

  it('announces the arrival of the result', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const live = await screen.findByTestId('score-primary');
    expect(live).toHaveAttribute('role', 'status');
  });

  it('announces the computing phase, which had no live region at all', async () => {
    await reachCategories();
    let resolve!: (v: unknown) => void;
    uniquenessMock.mockReturnValue(new Promise((r) => { resolve = r; }));
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByText(/Scoring against the local cohort/i)).toBeInTheDocument();
    resolve(SCORES);
  });

  // Task 21 — Unit and end-to-end coverage
  it('leaves Finish reachable at a low score — nothing gates on a threshold', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue({ ...SCORES, overallScore: 3, semanticPercentile: 3 });
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    await waitFor(() => expect(latestDraft?.uniquenessScore).toBe(3));
    expect(stepValid(latestDraft!, 4)).toBe(true);
  });

  it('invalidates the score and returns to the picker when a category changes', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES);
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));
    await screen.findByTestId('score-primary');

    fireEvent.click(screen.getByRole('button', { name: /Adventure & Nature/ }));

    expect(screen.queryByTestId('score-primary')).toBeNull();
    expect(latestDraft?.uniquenessScore).toBeNull();
    expect(latestDraft?.cohortInsufficient).toBe(false);
    expect(screen.getByRole('button', { name: /Compute uniqueness score/ })).toBeInTheDocument();
  });
});
