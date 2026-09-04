/**
 * The whole linear journey, end to end: pick a caption, run the audit, publish
 * through the modal.
 *
 * Exists because the steps are gated on each other and the gates were re-cut
 * when destinations and authorisation moved into the modal. Two dead ends this
 * covers, both of which shipped briefly and neither of which any single-panel
 * test could see:
 *   - the audit demanded a platform and an authorisation that only the modal
 *     could set, but the modal was only reachable through the audit;
 *   - ticking a platform inside the modal reset the audit that had unlocked it,
 *     so Confirm silently did nothing.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ContentStudioView from './ContentStudioView';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { DEMO_DRAFT } from './previewFixtures';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { MOCK_OMCS } from '../../../services/fixtures/omcs';
import { buildContentResponse } from './testFixtures';
import type { BusinessProfile } from '../../../types';

const PROFILE: BusinessProfile = {
  businessProfileId: 'bp-1', businessName: 'Sunset Cove', categories: ['Coastal & Island'],
  coreServices: [], description: 'Beachfront.', uvp: 'Eco-certified.', imagePreview: null,
  uniquenessScore: 0.82, slogan: '', industry: '', vibes: [], website: '', logo: null, socials: {},
};

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => ({ profile: PROFILE, setProfile: vi.fn(), isLoading: false }),
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    markets: { list: vi.fn(() => Promise.resolve(MOCK_MARKETS)) },
    content: { generate: vi.fn(() => Promise.resolve(buildContentResponse('groq'))) },
    creativeDirection: { generate: vi.fn(() => Promise.resolve({ visualGuide: [], shots: [], moodboard: { palette: '', references: [] } })) },
    compliance: { omcsAnalyze: vi.fn(() => Promise.resolve(MOCK_OMCS)) },
  },
}));

beforeEach(() => localStorage.clear());

function renderStudio() {
  return render(
    <OverlayStackProvider>
      <ContentStudioView initialDraft={DEMO_DRAFT} initialPosts={[]} />
    </OverlayStackProvider>,
  );
}

describe('Content Studio journey', () => {
  it('runs the audit, opens the modal, and publishes to a platform chosen there', async () => {
    const user = userEvent.setup();
    const { container } = renderStudio();

    await waitFor(() => expect(container.querySelectorAll('.cap-card').length).toBe(1), { timeout: 6000 });

    // The audit gate needs caption + media only — both seeded — so it is live.
    const run = screen.getByRole('button', { name: /Run Compliance Audit/ });
    expect(run).not.toBeDisabled();
    await user.click(run);

    await waitFor(() => expect(container.querySelector('.omcs-dial')).not.toBeNull(), { timeout: 12000 });

    // Publish appears only now, and opens the modal rather than publishing.
    await user.click(await screen.findByRole('button', { name: /^Publish/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Publish' });

    // Choosing a destination here must NOT invalidate the audit behind it.
    await user.click(within(dialog).getByRole('checkbox', { name: /TikTok/ }));
    await user.click(within(dialog).getByRole('checkbox', { name: /authorised to publish/ }));

    const confirm = within(dialog).getByRole('button', { name: /Confirm & Publish/ });
    expect(confirm).not.toBeDisabled();
    await user.click(confirm);

    // The modal closes and the board gains the published records.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Publish' })).toBeNull());
    await waitFor(() => expect(container.querySelectorAll('.post-grid .post-card').length).toBe(2));
  }, 40000);
});
