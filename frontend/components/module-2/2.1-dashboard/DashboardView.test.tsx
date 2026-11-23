/**
 * CARD — Foundation: Dashboard & Radar Shell
 * DoD (Step 18, C-21/C-22/C-23): "Top market for International" must actually open a
 * populated drawer from a cold dashboard (no alert ever selected) — the
 * regression this guards is the drawer looking marketId up in an empty
 * rankedMarkets list and silently staying closed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { marketsForCategory, MOCK_MARKETS, CATEGORY_MARKET_SCORES } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';
import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { TargetSelectionProvider, useTargetSelection } from '../../../services/targetSelectionStore';
import { ToastProvider } from '../../shared/Toast';
import { ApiError } from '../../../services/apiError';
import { RETRY_COPY } from '../../shared/RetryNotice';

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
const analyzeMock = apiClient.forecast.analyze as unknown as ReturnType<typeof vi.fn>;

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
  // been selected — the exact precondition the "Top market for International" bug needs.
  listMock.mockResolvedValue(MOCK_NOTIFICATIONS.map((a) => ({ ...a })));
  statusMock.mockResolvedValue({ available: true });
  keywordTrendsMock.mockResolvedValue([]);
  forCategoryMock.mockImplementation((category: string) =>
    Promise.resolve(category in CATEGORY_MARKET_SCORES ? marketsForCategory(category) : []),
  );
});

describe('DashboardView — Top market for International (cold dashboard)', () => {
  it('opens a populated drawer without ever selecting an alert first', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // Precondition: cold dashboard, drawer closed, no alert ever selected.
    const topMarketTile = await screen.findByRole('button', { name: /Top market for International/i });
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

  // "Target this market" from the tile used to drop the pick (no alert was
  // selected), so Content Studio opened on its picker instead of Quick Post.
  it('targets the market from the tile and lands on Content Studio with it chosen', async () => {
    const user = userEvent.setup();
    function Probe() {
      const { target } = useTargetSelection();
      return <p data-testid="probe">{target ? `${target.alert.id}:${target.market.id}` : 'none'}</p>;
    }
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <ToastProvider>
          <TargetSelectionProvider>
            <OverlayStackProvider>
              <Routes>
                <Route path="/dashboard" element={<DashboardView />} />
                <Route path="/content" element={<Probe />} />
              </Routes>
            </OverlayStackProvider>
          </TargetSelectionProvider>
        </ToastProvider>
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: /Top market for International/i }));
    await waitFor(() => expect(drawer()).toHaveAttribute('data-open', 'true'));
    await user.click(screen.getByRole('button', { name: /Target this market/ }));

    // usa leads Adventure & Nature; n3 is the operator's own usa alert there.
    expect(await screen.findByTestId('probe')).toHaveTextContent('n3:usa');
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

    await screen.findByRole('button', { name: /Top market for International/i });
    expect(await screen.findByText(/Latest attempt failed/)).toBeInTheDocument();
    expect(screen.getByText(/connection refused/)).toBeInTheDocument();
  });

  it('shows no stale banner when nothing loaded is actually stale', async () => {
    renderDashboard();
    await screen.findByRole('button', { name: /Top market for International/i });

    expect(screen.queryByText(/Latest attempt failed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/days old/)).not.toBeInTheDocument();
  });
});

describe('DashboardView — model unavailable', () => {
  const zeroGpu = new ApiError({
    status: 503,
    method: 'POST',
    path: '/api/forecasting/analyze',
    body: {
      code: 'MOD22_BILSTM_UNAVAILABLE',
      message: 'The BiLSTM + Transformer demand model is unavailable.',
      dependency: 'bilstm',
      cause: 'inference failed for KR/coastal_island: You have exceeded your ZeroGPU runs limit.',
    },
  });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a failed Refresh shows the forecast notice, and Try again re-runs the forecast', async () => {
    const user = userEvent.setup();
    analyzeMock.mockRejectedValueOnce(new ApiError({ status: 503, method: 'POST', path: '/api/forecasting/analyze' }));
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /Refresh forecast/ }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("The forecast didn't update.");
    expect(alert).toHaveTextContent(RETRY_COPY.retry);
    expect(alert).not.toHaveTextContent('/api/forecasting/analyze');

    analyzeMock.mockResolvedValueOnce({ markets: [] });
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(analyzeMock).toHaveBeenCalledTimes(2));
  });

  it('a quota failure asks the operator to wait', async () => {
    const user = userEvent.setup();
    analyzeMock.mockRejectedValueOnce(zeroGpu);
    renderDashboard();

    await user.click(await screen.findByRole('button', { name: /Refresh forecast/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(RETRY_COPY.wait);
  });

  it('a failed load shows the load notice, and Try again re-reads without running the forecast', async () => {
    const user = userEvent.setup();
    listMock.mockRejectedValueOnce(new Error('offline'));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent("Your dashboard didn't load.");
    const listCalls = listMock.mock.calls.length;

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(listCalls));
    expect(analyzeMock).not.toHaveBeenCalled();
  });

  it('an unfinished profile keeps the "Complete onboarding first" guidance', async () => {
    ensureMock.mockRejectedValueOnce(
      new ApiError({ status: 409, method: 'POST', path: '/api/forecasting/ensure', body: { code: 'MOD22_PROFILE_NOT_READY' } }),
    );
    renderDashboard();

    expect(await screen.findByText('Complete onboarding first')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
