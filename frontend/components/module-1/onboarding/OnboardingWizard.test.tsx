/**
 * CARD — Onboarding: Wizard Shell
 * Definition of Done: "cover the step-1 validity gate".
 *
 * Also covers the rail's defining property — it is a progress indicator, not
 * navigation, so its state is derived from the current index and its rows do
 * not move the wizard.
 *
 * Task 21 added: OnboardingWizard now calls useNavigate/useProfile/useToast
 * (Finish persists then navigates to /dashboard), so every render needs a
 * Router and a mocked profile context — useProfile is mocked rather than
 * driven through the real ProfileProvider for the same reason
 * BusinessProfileSettings.test.tsx gives: these assertions are about this
 * component's behavior, not the provider's fetch lifecycle. apiClient is
 * mocked wholesale so AnalysisStep's own on-mount analyze() call (it mounts
 * underneath the wizard once Step 5 is reached) never issues a real request.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OnboardingWizard from './OnboardingWizard';
import { DEMO_OB_DRAFT, EMPTY_OB_DRAFT, ObDraftProvider, stepValid } from './obDraft';
import type { ObDraft } from './obDraft';
import { ToastProvider } from '../../shared/Toast';
import type { BusinessProfile, BusinessProfileDto } from '../../../types';

const BASE_PROFILE: BusinessProfile = {
  businessProfileId: null,
  businessName: '',
  categories: [],
  coreServices: [],
  description: '',
  uvp: '',
  imagePreview: null,
  uniquenessScore: null,
  slogan: '',
  industry: '',
  vibes: [],
  website: '',
  logo: null,
  socials: {},
};

const profileState = { profile: BASE_PROFILE, setProfile: vi.fn(), isLoading: false };

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => profileState,
}));

const analyzeMock = vi.fn();
const uniquenessMock = vi.fn();
const saveMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    classification: {
      analyze: (...args: unknown[]) => analyzeMock(...args),
      uniqueness: (...args: unknown[]) => uniquenessMock(...args),
    },
    businessProfile: {
      save: (...args: unknown[]) => saveMock(...args),
    },
  },
}));

beforeEach(() => {
  profileState.profile = BASE_PROFILE;
  profileState.setProfile = vi.fn();
  analyzeMock.mockReset().mockReturnValue(new Promise(() => {})); // never resolves by default
  uniquenessMock.mockReset();
  saveMock.mockReset();
});

function renderWizard(initial: ObDraft) {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <ToastProvider>
        <Routes>
          <Route
            path="/onboarding"
            element={
              <ObDraftProvider initial={initial}>
                <OnboardingWizard />
              </ObDraftProvider>
            }
          />
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

/**
 * Scoped to the rail — step titles also appear as headings inside the step
 * panels, so an unscoped getByText matches twice.
 */
function railRow(title: string) {
  const rail = screen.getByRole('list', { name: 'Onboarding progress' });
  return within(rail).getByText(title).closest('[data-state]');
}

describe('stepValid', () => {
  it('gates step 1 on a business name longer than one character plus an industry', () => {
    expect(stepValid(EMPTY_OB_DRAFT, 0)).toBe(false);
    expect(stepValid({ ...EMPTY_OB_DRAFT, businessName: 'A' }, 0)).toBe(false);
    expect(stepValid({ ...EMPTY_OB_DRAFT, businessName: 'Ab' }, 0)).toBe(false);
    expect(stepValid({ ...EMPTY_OB_DRAFT, businessName: 'Ab', industry: 'Cafe' }, 0)).toBe(true);
  });

  it('gates step 2 on at least one vibe and one core service', () => {
    expect(stepValid({ ...EMPTY_OB_DRAFT, vibes: ['Serene'] }, 1)).toBe(false);
    expect(stepValid({ ...EMPTY_OB_DRAFT, coreServices: ['Diving'] }, 1)).toBe(false);
    expect(stepValid({ ...EMPTY_OB_DRAFT, vibes: ['Serene'], coreServices: ['Diving'] }, 1)).toBe(
      true
    );
  });

  it('gates step 3 on the 50-word description and 30-word UVP thresholds', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
    expect(stepValid({ ...EMPTY_OB_DRAFT, description: words(49), uvp: words(30) }, 2)).toBe(false);
    expect(stepValid({ ...EMPTY_OB_DRAFT, description: words(50), uvp: words(29) }, 2)).toBe(false);
    expect(stepValid({ ...EMPTY_OB_DRAFT, description: words(50), uvp: words(30) }, 2)).toBe(true);
  });

  it('never gates step 4 — every Assets & Links field is optional', () => {
    expect(stepValid(EMPTY_OB_DRAFT, 3)).toBe(true);
  });
});

describe('OnboardingWizard', () => {
  it('disables Continue until step 1 is valid', () => {
    renderWizard(EMPTY_OB_DRAFT);
    expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled();
  });

  it('enables Continue once step 1 is satisfied', () => {
    renderWizard(DEMO_OB_DRAFT);
    expect(screen.getByRole('button', { name: /Continue/ })).toBeEnabled();
  });

  it('disables Back on the first step', () => {
    renderWizard(DEMO_OB_DRAFT);
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();
  });

  it('marks earlier rail steps done and later ones pending as the index advances', () => {
    renderWizard(DEMO_OB_DRAFT);

    expect(railRow('Basic Info')).toHaveAttribute('data-state', 'current');
    expect(railRow('Brand Identity')).toHaveAttribute('data-state', 'pending');
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));

    expect(railRow('Basic Info')).toHaveAttribute('data-state', 'done');
    expect(railRow('Brand Identity')).toHaveAttribute('data-state', 'current');
    expect(screen.getByText('Step 2 of 5')).toBeInTheDocument();
  });

  it('reaches Assets & Links after three Continues and renders that step', () => {
    renderWizard(DEMO_OB_DRAFT);

    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    }

    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument();
    expect(railRow('Assets & Links')).toHaveAttribute('data-state', 'current');
    expect(screen.getByLabelText('Instagram handle or page name')).toBeInTheDocument();
  });

  it('does not let a rail row navigate — it is an indicator, not a link', () => {
    renderWizard(DEMO_OB_DRAFT);

    const rail = screen.getByRole('list', { name: 'Onboarding progress' });
    fireEvent.click(within(rail).getByText('Analysis'));

    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    expect(railRow('Analysis')).toHaveAttribute('data-state', 'pending');
  });

  it('blocks Finish on the terminal step until the analysis card lands', () => {
    renderWizard(DEMO_OB_DRAFT);

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    }

    expect(screen.getByText('Step 5 of 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finish/ })).toBeDisabled();
  });

  it('persists with the 0-1 scale conversion and navigates to /dashboard on Finish', async () => {
    analyzeMock.mockResolvedValue([{ name: 'Coastal & Island', percentage: 90 }]);
    // Must carry the cohort fields: AnalysisStep writes no score when
    // `sufficientCohort` is falsy, so a partial fixture silently produces a
    // draft with uniquenessScore: null and this assertion fails on the DTO.
    uniquenessMock.mockResolvedValue({
      overallScore: 72,
      semanticsScore: 70,
      categoryScore: 74,
      semanticPercentile: 72,
      cohortSize: 34,
      cohortMedianScore: 41,
      cohortCategories: ['Coastal & Island'],
      categoryDensity: 'dense',
      sufficientCohort: true,
      descriptionFeedback: '',
      categoryFeedback: '',
    });
    saveMock.mockImplementation((dto: BusinessProfileDto) => Promise.resolve(dto));

    renderWizard(DEMO_OB_DRAFT);

    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    }

    // AnalysisStep runs analyze() -> categories -> compute -> uniqueness() -> scored.
    await waitFor(() => expect(screen.getByText(/Compute uniqueness score/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const finishButton = await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Finish/ });
      expect(btn).toBeEnabled();
      return btn;
    });
    fireEvent.click(finishButton);

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: ['Coastal & Island'],
        // 100x-wrong-scale guard: the API's 72 (0-100) must land as 0.72 (0-1).
        uniquenessScore: 0.72,
      })
    );
  });
});
