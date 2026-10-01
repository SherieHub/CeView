/**
 * CARD — Foundation: Dashboard & Radar Shell
 * DoD (Step 18, C-21/C-22/C-23): "Top market now" must actually open a
 * populated drawer from a cold dashboard (no alert ever selected) — the
 * regression this guards is the drawer looking marketId up in an empty
 * rankedMarkets list and silently staying closed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { marketsForCategory, MOCK_MARKETS, CATEGORY_MARKET_SCORES } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { TargetSelectionProvider } from '../../../services/targetSelectionStore';
import { ToastProvider } from '../../shared/Toast';

const mockProfile = {
  businessName: 'Cold Dashboard Test',
  categories: ['Accommodation & Staycation', 'Adventure & Nature'],
  uniquenessScore: 0.5,
};

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => ({ profile: mockProfile, setProfile: vi.fn(), isLoading: false }),
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    notifications: { list: vi.fn(), markRead: vi.fn(), keywordTrends: vi.fn() },
    forecast: { analyze: vi.fn(), status: vi.fn(), ensure: vi.fn() },
    markets: { forCategory: vi.fn() },
  },
}));

import { apiClient } from '../../../services/apiClient';
import DashboardView from './DashboardView';

const listMock = apiClient.notifications.list as unknown as ReturnType<typeof vi.fn>;
const keywordTrendsMock = apiClient.notifications.keywordTrends as unknown as ReturnType<typeof vi.fn>;
const statusMock = apiClient.forecast.status as unknown as ReturnType<typeof vi.fn>;
const ensureMock = apiClient.forecast.ensure as unknown as ReturnType<typeof vi.fn>;
const forCategoryMock = apiClient.markets.forCategory as unknown as ReturnType<typeof vi.fn>;

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <ToastProvider>
        <TargetSelectionProvider>
          <OverlayStackProvider>
            <DashboardView />
          </OverlayStackProvider>
        </TargetSelectionProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const drawer = () => document.querySelector('.drawer')!;

beforeEach(() => {
  vi.clearAllMocks();
  ensureMock.mockResolvedValue(undefined);
  // Cold dashboard: alerts exist (so mode isn't 'empty'), but nothing has ever
  // been selected — the exact precondition the "Top market now" bug needs.
  listMock.mockResolvedValue(MOCK_NOTIFICATIONS.map((a) => ({ ...a })));
  statusMock.mockResolvedValue({ available: true });
  keywordTrendsMock.mockResolvedValue([]);
  forCategoryMock.mockImplementation((category: string) =>
    Promise.resolve(category in CATEGORY_MARKET_SCORES ? marketsForCategory(category) : []),
  );
});

describe('DashboardView — Top market now (cold dashboard)', () => {
  it('opens a populated drawer without ever selecting an alert first', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Precondition: cold dashboard, drawer closed, no alert ever selected.
    const topMarketTile = await screen.findByRole('button', { name: /Top market now/i });
    expect(drawer()).toHaveAttribute('data-open', 'false');

    await user.click(topMarketTile);

    // The drawer must actually open, AND with real content — not an empty
    // shell — proving rankedMarkets was populated before/alongside the
    // navigation, not left empty from the never-selected-an-alert state.
    await waitFor(() => expect(drawer()).toHaveAttribute('data-open', 'true'));
    // The best-scoring leader across the operator's two categories: usa leads
    // 'Adventure & Nature' at 90, higher than korea's 87 lead of
    // 'Accommodation & Staycation' — see CATEGORY_MARKET_SCORES.
    const expectedLeader = marketsForCategory('Adventure & Nature')[0];
    expect(screen.getByRole('heading', { name: expectedLeader.name })).toBeInTheDocument();
  });
});

describe('DashboardView — stale banner (Step 18, C-21/C-22/C-23; H-11)', () => {
  // The banner used to be evaluated only from rankedMarkets, which stays
  // empty until an alert is selected — a stale dashboard looked fresh until
  // you clicked something. topMarket now carries its own staleness, loaded
  // independently of any alert selection.
  it('shows the stale banner from topMarket alone, with no alert ever selected', async () => {
    const staleUsa = {
      ...MOCK_MARKETS.find((m) => m.id === 'usa')!,
      // Higher than korea's 'Accommodation & Staycation' lead (87) so this is
      // unambiguously the cross-category best — the topMarket the tile shows.
      matchScore: 95,
      dataStale: true,
      dataAsOf: '2026-08-01T00:00:00Z',
      dataStaleCause: 'ConnectException: connection refused',
    };
    forCategoryMock.mockImplementation((category: string) =>
      Promise.resolve(category === 'Adventure & Nature' ? [staleUsa] : marketsForCategory(category)),
    );

    renderDashboard();

    await screen.findByRole('button', { name: /Top market now/i });
    expect(await screen.findByText(/Latest attempt failed/)).toBeInTheDocument();
    expect(screen.getByText(/connection refused/)).toBeInTheDocument();
  });

  it('shows no stale banner when nothing loaded is actually stale', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: /Top market now/i });

    expect(screen.queryByText(/Latest attempt failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/days old/)).not.toBeInTheDocument();
  });
});
