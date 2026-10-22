import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import AdPlannerDrawer from './AdPlannerDrawer';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { apiClient } from '../../../services/apiClient';
import { mockLinks } from '../../../services/fixtures/attributionLinks';
import type { DemandAlert, Market } from '../../../types';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    campaign: { costRates: vi.fn() },
    attribution: { codes: vi.fn() },
  },
}));

const api = apiClient as unknown as {
  campaign: { costRates: ReturnType<typeof vi.fn> };
  attribution: { codes: ReturnType<typeof vi.fn> };
};

const ALERT = {
  id: 'alert-1',
  category: 'Accommodation & Staycation',
  windowOpenDate: '2026-10-19T00:00:00+08:00',
} as DemandAlert;
const MARKET = { id: 'korea', name: 'South Korea' } as Market;

function renderDrawer() {
  return render(
    <MemoryRouter>
      <OverlayStackProvider>
        <AdPlannerDrawer
          open
          onClose={() => {}}
          alert={ALERT}
          market={MARKET}
          caption="Sunset villas in Moalboal. Mention code KR-ACCO-1019 when you book."
          mediaDataUrl="data:image/png;base64,AAA"
          link={mockLinks()[0]}
        />
      </OverlayStackProvider>
    </MemoryRouter>,
  );
}

describe('AdPlannerDrawer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.campaign.costRates.mockResolvedValue({
      periods: 4, totalSpend: 4000, totalImpressions: 50000, totalClicks: 1000,
      costPerThousandImpressions: 80, costPerClick: 4,
    });
    api.attribution.codes.mockResolvedValue([{
      attributionCodeId: 'c1', code: 'KR-ACCO-1019', category: 'Accommodation & Staycation',
      targetMarket: 'korea', windowStart: '2026-10-19T00:00:00+08:00', windowEnd: '2026-11-02T00:00:00+08:00',
      status: 'ACTIVE', totalBookings: 0, totalRevenue: 0, byKind: [], reportedBookings: null,
      trackedExceedsReported: false,
    }]);
  });

  it('turns "5,000 people in South Korea" into a plan with a budget from the operator’s own history', async () => {
    renderDrawer();
    const plan = await screen.findByRole('region', { name: 'Your ad plan' });
    expect(within(plan).getByText('Awareness')).toBeInTheDocument();
    // The daily figure depends on how much of the window is left today; the
    // arithmetic itself is pinned in adPlan.test.ts with a fixed clock.
    expect(await within(plan).findByText(/^₱\d+ a day$/)).toBeInTheDocument();
    expect(within(plan).getByText(/Your past ads cost ₱80 per 1,000 views/)).toBeInTheDocument();
    expect(await within(plan).findByText('KR-ACCO-1019')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Meta Ads Manager/ })).toHaveAttribute('href', 'https://adsmanager.facebook.com/');
  });

  it('switches the walkthrough to TikTok and flags the image', async () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'TikTok' }));
    expect(await screen.findByText(/need a video/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Step by step in TikTok' })).toBeInTheDocument();
  });

  it('tracks progress through the steps', async () => {
    renderDrawer();
    await screen.findByRole('region', { name: 'Your ad plan' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mark "Open Meta Ads Manager" done' }));
    expect(screen.getByText(/^1 of \d+ done$/)).toBeInTheDocument();
  });

  it('explains why TikTok message ads are not planned', async () => {
    renderDrawer();
    fireEvent.click(screen.getByRole('radio', { name: /Get messages/ }));
    fireEvent.click(screen.getByRole('button', { name: 'TikTok' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/message ads on Facebook & Instagram only/);
  });

  it('still plans without history, saying why there is no estimate', async () => {
    api.campaign.costRates.mockRejectedValue(new Error('offline'));
    renderDrawer();
    expect(await screen.findByText(/No past ad spend to estimate from yet/)).toBeInTheDocument();
  });
});
