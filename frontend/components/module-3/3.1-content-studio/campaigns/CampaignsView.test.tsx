import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BusinessProfile } from '@/types';
import CampaignsView from './CampaignsView';
import type { CampaignMode } from './CampaignsView';
import { useCampaignDrafts } from './campaignTypes';
import { OverlayStackProvider } from '../../../shared/useOverlayStack';
import { MOCK_MARKETS } from '../../../../services/fixtures/markets';
import { MOCK_CONTENT } from '../../../../services/fixtures/content';
import { MOCK_POSTS } from '../../../../services/fixtures/posts';

const forCategory = vi.fn();
const generate = vi.fn();
vi.mock('../../../../services/apiClient', () => ({
  apiClient: {
    markets: { forCategory: (...a: unknown[]) => forCategory(...a) },
    content: { generate: (...a: unknown[]) => generate(...a) },
  },
}));

const PROFILE: BusinessProfile = {
  businessProfileId: 'bp-1',
  businessName: 'Sunset Cove',
  categories: ['Coastal & Island'],
  coreServices: ['Guided dives', 'Island hopping tours'],
  description: 'A small dive resort in Moalboal.',
  uvp: 'The only eco-certified resort on this stretch of coast.',
  imagePreview: null,
  uniquenessScore: null,
  slogan: '',
  industry: '',
  vibes: [],
  website: '',
  logo: null,
  socials: {},
};

function Harness({ profile = PROFILE }: { profile?: BusinessProfile }) {
  const store = useCampaignDrafts();
  const [mode, setMode] = useState<CampaignMode>({ kind: 'list' });
  return (
    <MemoryRouter>
      <OverlayStackProvider>
        <CampaignsView
          campaigns={store.campaigns}
          mode={mode}
          onModeChange={setMode}
          profile={profile}
          posts={MOCK_POSTS}
          onSave={store.upsert}
          onDelete={store.remove}
          onPatchPost={store.patchPost}
          today="2026-10-16"
        />
      </OverlayStackProvider>
    </MemoryRouter>
  );
}

const generateButton = () => screen.getByRole('button', { name: /Generate My Campaign/ });

beforeEach(() => {
  forCategory.mockReset().mockResolvedValue(MOCK_MARKETS);
  generate.mockReset().mockResolvedValue(MOCK_CONTENT);
});

describe('CampaignsView — recommended campaign', () => {
  it('opens on the generation entry, using the profile instead of asking for it', async () => {
    render(<Harness />);
    expect(screen.getByRole('heading', { name: /Let.s plan your next campaign/ })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/this session only/);
    const known = screen.getByRole('list', { name: 'What CeView will use' });
    expect(within(known).getByText('Sunset Cove')).toBeInTheDocument();
    // No campaign name, market or platform fields to fill before generating.
    expect(screen.queryByLabelText('Campaign name')).toBeNull();
    await waitFor(() => expect(generateButton()).toBeEnabled());
    expect(forCategory).toHaveBeenCalledWith('Coastal & Island');
  });

  it('asks only for what is missing, and links to the profile', async () => {
    render(<Harness profile={{ ...PROFILE, description: '' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Business description');
    expect(screen.getByRole('link', { name: /Complete your Business Profile/ })).toHaveAttribute('href', '/settings/profile');
    // Markets loaded, and still blocked on the profile.
    expect(await screen.findByRole('button', { name: /Generate My Campaign/ })).toBeDisabled();
  });

  it('recommends a strategy with reasons, then plans, prepares and finalizes it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(generateButton()).toBeEnabled());
    await user.click(generateButton());

    // Stage 1 — the critical surge market leads, explained and labelled.
    expect(screen.getByRole('heading', { name: 'Your Recommended Campaign' })).toBeInTheDocument();
    const market = screen.getByRole('region', { name: 'Market opportunity' });
    expect(within(market).getByText(/Demand from South Korea/)).toBeInTheDocument();
    expect(within(market).getByText('Active surge')).toBeInTheDocument();
    expect(within(market).getByText('Demand-informed')).toBeInTheDocument();
    // Too few published posts to compare platforms — and it says so.
    expect(within(screen.getByRole('region', { name: 'Platform choice' })).getByText('Limited data')).toBeInTheDocument();
    expect(generate).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Looks Good — Continue/ }));

    // Stage 2 — captions come from the existing generator, for the chosen market.
    expect(await screen.findByRole('heading', { name: 'Your Content Plan' })).toBeInTheDocument();
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ market: 'korea', businessName: 'Sunset Cove', trend: 'surging' }));
    expect(screen.getByRole('button', { name: 'Review Meet Sunset Cove' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Review (?!strategy)/ }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Suggested').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Accept Content Plan/ }));

    // Stage 3 — nothing is approved until a post has media and a passing audit.
    expect(screen.getByRole('heading', { name: /Prepare & Approve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve ready posts/ })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /^Add photo:/ }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Finalize Campaign/ }));

    // Workspace — honest states, no invented results.
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/posts approved/)).toHaveTextContent(/^0 of \d+ posts approved$/);
    await user.click(screen.getByRole('tab', { name: 'Calendar' }));
    expect(screen.getByText('Scheduled — not connected yet')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Results' }));
    expect(screen.getByText('No campaign results yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All campaigns/ }));
    expect(screen.getByRole('button', { name: /Open South Korea/ })).toBeInTheDocument();
  }, 20000);

  it('lets the owner override a recommendation and restore it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(generateButton()).toBeEnabled());
    await user.click(generateButton());

    const market = screen.getByRole('region', { name: 'Market opportunity' });
    await user.click(within(market).getByRole('button', { name: /Edit/ }));
    await user.selectOptions(within(market).getByRole('combobox'), 'japan');
    expect(within(market).getByText('Your choice')).toBeInTheDocument();
    expect(within(market).getByText(/CeView recommended South Korea/)).toBeInTheDocument();

    await user.click(within(market).getByRole('button', { name: /Use the recommendation/ }));
    expect(within(market).queryByText('Your choice')).toBeNull();
  }, 20000);

  it('keeps the strategy and offers a way forward when captions fail to generate', async () => {
    generate.mockRejectedValueOnce(new Error('caption agent down'));
    const user = userEvent.setup();
    render(<Harness />);
    await waitFor(() => expect(generateButton()).toBeEnabled());
    await user.click(generateButton());
    await user.click(screen.getByRole('button', { name: /Looks Good — Continue/ }));

    await user.click(await screen.findByRole('button', { name: /Continue without captions/ }));
    expect(await screen.findByRole('heading', { name: 'Your Content Plan' })).toBeInTheDocument();
    // No invented captions in their place: the post's caption is empty.
    await user.click(screen.getByRole('button', { name: 'Review Meet Sunset Cove' }));
    expect(screen.getByLabelText('Recommended caption')).toHaveValue('');
  }, 20000);

  it('offers the manual flow as a fallback', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /Plan a campaign manually/ }));
    expect(screen.getByRole('heading', { name: 'Plan Your Campaign' })).toBeInTheDocument();
    expect(screen.getByLabelText('Campaign name')).toBeInTheDocument();
  });
});
