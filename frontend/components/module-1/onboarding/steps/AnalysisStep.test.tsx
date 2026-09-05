/**
 * CARD — Onboarding: Step 5 Analysis (Task 21)
 *
 * Covers the spec's phase machine (analyzing -> categories -> computing ->
 * scored), the >=1-category-selected toggle rule, the ApiErrorPanel surface
 * on a failed analyze(), and the pass/warn banner split at the 70 threshold
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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalysisStep from './AnalysisStep';
import { EMPTY_OB_DRAFT, ObDraftProvider, stepValid, useObDraft } from '../obDraft';
import type { ObDraft } from '../obDraft';
import { ToastProvider } from '../../../shared/Toast';
import { ApiError } from '../../../../services/apiError';
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

  it('renders ApiErrorPanel naming the dependency when analyze() is rejected as a missing dependency', async () => {
    analyzeMock.mockRejectedValue(
      new ApiError({
        status: 503,
        method: 'POST',
        path: '/api/classification/analyze',
        body: { code: 'ai_service_unreachable', dependency: 'fastapi-sbert' },
      })
    );
    renderStep();

    expect(await screen.findByText('fastapi-sbert is unavailable')).toBeInTheDocument();
  });

  it('shows the pass banner at >=70 and the warn banner below it', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue(SCORES); // overallScore: 72
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByText(/Strong differentiation/)).toBeInTheDocument();
    expect(screen.queryByText(/Room to sharpen your positioning/)).not.toBeInTheDocument();
  });

  it('shows the warn banner with a link back to Step 3 below 70', async () => {
    await reachCategories();
    uniquenessMock.mockResolvedValue({ ...SCORES, overallScore: 69 });
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    expect(await screen.findByText(/Room to sharpen your positioning/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Strengthen my UVP/ })).toBeInTheDocument();
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
    expect(diagnostics.querySelector('.heading-xl')).toBeNull();
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
});
