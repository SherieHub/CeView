/**
 * Regression test for the ProfileGate race: OnboardingWizard.test.tsx mocks
 * useProfile directly and never mounts the real ProfileGate, so it couldn't
 * catch this. ProfileGate redirects /onboarding -> /dashboard itself,
 * reactively, the instant profile.uniquenessScore becomes non-null — which
 * is exactly what handleFinish's setProfile call does, one line before its
 * own navigate('/dashboard') call. Under react-router v7's data router,
 * that redirect can win the race against the wizard's own navigate (see
 * services/justOnboardedFlag.ts's header comment for the full mechanism),
 * so any "just onboarded" signal must survive regardless of which of the
 * two navigations actually lands. This mounts the REAL ProfileGate and
 * ProfileProvider (only apiClient is mocked) to prove it does.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import OnboardingWizard from './OnboardingWizard';
import { DEMO_OB_DRAFT, ObDraftProvider } from './obDraft';
import { ToastProvider } from '../../shared/Toast';
import { ProfileProvider, ProfileGate } from '../../../services/profileContext';
import { consumeJustOnboarded } from '../../../services/justOnboardedFlag';

vi.mock('../../../services/auth', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

const analyzeMock = vi.fn();
const uniquenessMock = vi.fn();
const saveMock = vi.fn();
const loadMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    classification: {
      analyze: (...args: unknown[]) => analyzeMock(...args),
      uniqueness: (...args: unknown[]) => uniquenessMock(...args),
    },
    businessProfile: {
      save: (...args: unknown[]) => saveMock(...args),
      load: (...args: unknown[]) => loadMock(...args),
    },
  },
}));

function DashboardStub() {
  // Also proves the actual URL landed on /dashboard, independent of which
  // of the two navigations (the wizard's or ProfileGate's) won the race.
  const location = useLocation();
  return <div>Dashboard at {location.pathname}</div>;
}

beforeEach(() => {
  consumeJustOnboarded(); // drain any flag left set by a prior test
  analyzeMock.mockReset().mockResolvedValue([{ name: 'Coastal & Island', percentage: 90 }]);
  uniquenessMock.mockReset().mockResolvedValue({
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
  saveMock.mockReset().mockImplementation((dto) => Promise.resolve(dto));
  loadMock.mockReset().mockResolvedValue({
    businessProfileId: null,
    businessName: '',
    categories: [],
    coreServices: [],
    description: '',
    uvp: '',
    imagePreview: null,
    uniquenessScore: null,
  });
});

describe('OnboardingWizard + real ProfileGate', () => {
  it('the justOnboarded flag survives ProfileGate redirecting to /dashboard on Finish', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <ProfileGate />,
          children: [
            {
              path: 'onboarding',
              element: (
                <ObDraftProvider initial={DEMO_OB_DRAFT}>
                  <OnboardingWizard />
                </ObDraftProvider>
              ),
            },
            { path: 'dashboard', element: <DashboardStub /> },
          ],
        },
      ],
      { initialEntries: ['/onboarding'] },
    );

    render(
      <ProfileProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ProfileProvider>,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument(),
    );
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    }

    await waitFor(() => expect(screen.getByText(/Compute uniqueness score/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Compute uniqueness score/ }));

    const finishButton = await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Finish/ });
      expect(btn).toBeEnabled();
      return btn;
    });
    fireEvent.click(finishButton);

    await waitFor(() => expect(screen.getByText('Dashboard at /dashboard')).toBeInTheDocument());
    expect(consumeJustOnboarded()).toBe(true);
  });
});
