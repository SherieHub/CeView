/**
 * CARD — Task 25: wire Content Studio to the real backend.
 *
 * Covers the generate request built from profile + selected market, the
 * known-500 error surface, and the stubbed-content banner (source: 'fallback'
 * — the single most misleading state in the app if it silently renders as
 * real content).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentStudioView from './ContentStudioView';
import { buildContentResponse } from './testFixtures';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { MOCK_CREATIVE_DIRECTION } from '../../../services/fixtures/creativeDirection';
import { ApiError } from '../../../services/apiError';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import type { BusinessProfile } from '../../../types';

const BASE_PROFILE: BusinessProfile = {
  businessProfileId: 'bp-1',
  businessName: 'Sunset Cove Beach Resort',
  categories: ['Coastal & Island'],
  coreServices: ['Scuba Diving'],
  description: 'A twelve-room beachfront property above the reef wall.',
  uvp: 'The only eco-certified resort on this stretch of coast.',
  imagePreview: null,
  uniquenessScore: 0.82,
  slogan: '',
  industry: '',
  vibes: [],
  website: '',
  logo: null,
  socials: {},
};

/**
 * These cases mount the WHOLE screen — five panels, the step rail, the brief
 * drawer and a board of posts — and then query it by role, which walks the tree
 * computing accessible names. Testing Library's default 1000ms budget is
 * marginal for a tree this size once vitest is running files in parallel: the
 * suite passed in isolation and flaked in a directory run, with the failure
 * moving between cases from run to run. A longer budget, not a smaller tree.
 */
const SLOW = { timeout: 8000 } as const;

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => ({ profile: BASE_PROFILE, setProfile: vi.fn(), isLoading: false }),
}));

const generateMock = vi.fn();
const creativeDirectionMock = vi.fn();

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    markets: { list: vi.fn(() => Promise.resolve(MOCK_MARKETS)) },
    content: { generate: (...args: unknown[]) => generateMock(...args) },
    creativeDirection: {
      generate: (...args: unknown[]) => creativeDirectionMock(...args),
    },
    compliance: { omcsAnalyze: vi.fn(() => Promise.reject(new Error('not used in this test'))) },
  },
}));

beforeEach(() => {
  // The brief drawer auto-opens on a first visit and writes a flag on close.
  // Clearing keeps each case independent of the order they run in.
  localStorage.clear();
  generateMock.mockReset();
  creativeDirectionMock.mockReset();
  creativeDirectionMock.mockResolvedValue({ visualGuide: [], shots: [], moodboard: { palette: '', references: [] } });
});

/**
 * The view mounts CampaignBriefDrawer, which joins the shared overlay stack —
 * so it needs the provider that App/AppShell supply in the real tree. Without
 * it every case here dies on "useOverlayStack must be used within an
 * OverlayStackProvider" before reaching its own assertion.
 */
function renderStudio() {
  return render(
    <OverlayStackProvider>
      <ContentStudioView />
    </OverlayStackProvider>,
  );
}

describe('ContentStudioView — generate request', () => {
  it('builds the generate request from profile + selected market once markets load', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    expect(generateMock).toHaveBeenCalledWith({
      market: MOCK_MARKETS[0].id,
      businessName: BASE_PROFILE.businessName,
      description: BASE_PROFILE.description,
      categories: BASE_PROFILE.categories,
      trend: MOCK_MARKETS[0].spikeIndicator ? 'surging' : 'steady',
    });
  });

  it('renders ApiErrorPanel naming the dependency when generate() is rejected as a missing dependency', async () => {
    generateMock.mockRejectedValue(
      new ApiError({ status: 503, method: 'POST', path: '/api/content/generate', body: { error: 'ai_service_unreachable', dependency: 'fastapi-sbert' } }),
    );

    renderStudio();

    await waitFor(() => expect(screen.getByText('fastapi-sbert is unavailable')).toBeInTheDocument(), SLOW);
  });

  it('shows the stubbed-content banner when source is "fallback"', async () => {
    generateMock.mockResolvedValue(buildContentResponse('fallback'));

    renderStudio();

    await waitFor(() => expect(screen.getByText(/showing stubbed content/i)).toBeInTheDocument(), SLOW);
  });

  it('does not show the stubbed-content banner for real ("groq") content', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);
    expect(screen.queryByText(/showing stubbed content/i)).not.toBeInTheDocument();
  });

  // The Draft -> Attach handoff: choosing an option in the grid is what fills
  // the single editable caption below it. The cards are no longer editable, so
  // this is the only path from a generated option to a publishable draft.
  it('stages a selected option into the composer', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    const select = await screen.findAllByRole('button', { name: 'Select' }, SLOW);
    await userEvent.click(select[0]);

    expect((screen.getByLabelText('Staged caption') as HTMLTextAreaElement).value)
      .toBe('Instagram caption text');
  });

  // The shot list lives only in the drawer now, so the composer must still
  // offer a way in at the moment the operator is choosing media. This replaced
  // an inline accordion that duplicated the drawer wholesale.
  it('opens the visual guide from the link beside the upload control', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    // The shared beforeEach resolves an EMPTY direction, and the drawer guards
    // each section on its array being non-empty — so this case needs real
    // direction data or there would be nothing to find.
    creativeDirectionMock.mockResolvedValue(MOCK_CREATIVE_DIRECTION);

    renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    // Dismiss the first-run auto-open so the assertion below is about the link.
    // The shared Drawer keeps its children mounted when closed — it slides
    // off-canvas so the transition can run — so "is the content in the DOM" is
    // not the signal. It sets aria-hidden while closed, which takes the dialog
    // out of the accessibility tree, and getByRole honours that.
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Visual Guide' })).toBeNull(), SLOW);

    await userEvent.click(screen.getByRole('button', { name: 'Review Visual Guide' }));

    const drawer = await screen.findByRole('dialog', { name: 'Visual Guide' });
    expect(within(drawer).getByText('Visual direction')).toBeTruthy();
    expect(within(drawer).getByText('Shot list')).toBeTruthy();
    // Media guidance only — the moodboard and caption rationale were removed.
    expect(within(drawer).queryByText('Moodboard')).toBeNull();
  });

  // The sidebar's active row already says Content Studio; repeating it above
  // the title pushed the market selector up level with a label rather than
  // with the heading it scopes.
  it('shows no eyebrow above the page title', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    const { container } = renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    expect(container.querySelector('.page-head .eyebrow')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: /Create content that fits the market/ })).toBeTruthy();
    // The market selector still lives in the head's actions slot.
    expect(container.querySelector('.page-head-actions .studio-select')).not.toBeNull();
  });

  // The floating trigger is icon-only so it does not sit over the content it
  // floats above. Its name therefore has to come from aria-label — without it
  // the control is announced as "button" and is unreachable by voice.
  it('keeps the visual-guide trigger reachable with no visible label', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));
    renderStudio();
    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);

    const trigger = screen.getByRole('button', { name: 'Visual Guide' });
    expect(trigger.className).toContain('brief-trigger');
    // Icon only — no text node of its own beyond the first-run tooltip.
    expect(trigger.textContent).not.toContain('Visual Guide');

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Visual Guide' })).toBeNull(), SLOW);

    await userEvent.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Visual Guide' })).toBeTruthy();
  });

  // Progressive disclosure, end to end: nothing on the screen offers Publish
  // until the audit has returned a pass.
  it('keeps Publish hidden before the audit has run', async () => {
    generateMock.mockResolvedValue(buildContentResponse('groq'));

    renderStudio();

    await waitFor(() => expect(generateMock).toHaveBeenCalled(), SLOW);
    expect(screen.queryByRole('button', { name: /^Publish/ })).toBeNull();
  });
});
