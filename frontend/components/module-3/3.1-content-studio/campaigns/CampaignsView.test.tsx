import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CampaignsView from './CampaignsView';
import type { CampaignMode } from './CampaignsView';
import { useCampaignDrafts } from './campaignTypes';
import { MOCK_MARKETS } from '../../../../services/fixtures/markets';

vi.mock('../../../../services/apiClient', () => ({
  apiClient: { markets: { forCategory: vi.fn(() => Promise.resolve(MOCK_MARKETS)) } },
}));

function Harness({ onOpenPost = vi.fn() }: { onOpenPost?: (...args: unknown[]) => void }) {
  const store = useCampaignDrafts();
  const [mode, setMode] = useState<CampaignMode>({ kind: 'list' });
  return (
    <MemoryRouter>
      <CampaignsView
        campaigns={store.campaigns}
        mode={mode}
        onModeChange={setMode}
        categories={['Coastal & Island']}
        onSave={store.upsert}
        onDelete={store.remove}
        onPostStatus={store.setPostStatus}
        onOpenPost={onOpenPost}
      />
    </MemoryRouter>
  );
}

describe('CampaignsView', () => {
  it('shows an honest empty state and the preview notice, with no fabricated campaigns', () => {
    render(<Harness />);
    expect(screen.getByText('Your next campaign starts here.')).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/session only/);
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('builds a campaign, keeps it for the session and opens its workspace', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getAllByRole('button', { name: /New Campaign/ })[0]);
    // The brief gates Continue until a name and a platform are set.
    expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled();
    await user.type(screen.getByLabelText('Campaign name'), 'Golden Week Escapes');
    await user.click(screen.getByRole('button', { name: 'Instagram' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    await user.click(screen.getByRole('button', { name: /Add post/ }));
    await user.type(screen.getByLabelText('Content direction for post 1'), 'Sunrise dive teaser');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByRole('button', { name: 'Save campaign' }));

    expect(screen.getByRole('heading', { name: 'Golden Week Escapes' })).toBeInTheDocument();
    expect(screen.getByText('Unsaved draft')).toBeInTheDocument();

    // Results never shows numbers it does not have.
    await user.click(screen.getByRole('tab', { name: 'Results' }));
    expect(screen.getByText(/Campaign reporting isn.t available yet/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /All campaigns/ }));
    expect(screen.getByRole('button', { name: 'Open Golden Week Escapes' })).toBeInTheDocument();
  });

  it('opens a planned post in the composer through the callback', async () => {
    const user = userEvent.setup();
    const onOpenPost = vi.fn();
    render(<Harness onOpenPost={onOpenPost} />);

    await user.click(screen.getAllByRole('button', { name: /New Campaign/ })[0]);
    await user.type(screen.getByLabelText('Campaign name'), 'Plan');
    await user.click(screen.getByRole('button', { name: 'TikTok' }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByRole('button', { name: /Add post/ }));
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await user.click(screen.getByRole('button', { name: /Open in composer/ }));

    expect(onOpenPost).toHaveBeenCalledTimes(1);
    expect(onOpenPost.mock.calls[0][0]).toMatchObject({ name: 'Plan', platforms: ['tiktok'] });
  });
});
