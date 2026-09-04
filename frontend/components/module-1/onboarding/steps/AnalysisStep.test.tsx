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
import { EMPTY_OB_DRAFT, ObDraftProvider, useObDraft } from '../obDraft';
import type { ObDraft } from '../obDraft';
import { ToastProvider } from '../../../shared/Toast';
import { ApiError } from '../../../../services/apiError';

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

const SCORES = {
  overallScore: 72,
  semanticsScore: 70,
  categoryScore: 74,
  descriptionFeedback: 'Solid.',
  categoryFeedback: 'Good fit.',
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
});
