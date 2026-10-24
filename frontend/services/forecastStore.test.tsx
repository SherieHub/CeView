import { act, render, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MOCK_NOTIFICATIONS } from './fixtures/notifications';
import { marketsForCategory, CATEGORY_MARKET_SCORES } from './fixtures/markets';
import { ApiError } from './apiError';
import { saveForecastCache } from './forecastCache';
import type { ForecastSnapshot } from './forecastCache';
import type { DemandAlert } from '../types';

const mockProfile = { businessProfileId: 'bp-1', categories: ['Coastal & Island'] as string[] };

vi.mock('./profileContext', () => ({
  useProfile: () => ({ profile: mockProfile, setProfile: vi.fn(), isLoading: false }),
}));

vi.mock('./apiClient', () => ({
  apiClient: {
    notifications: { list: vi.fn(), markRead: vi.fn(), keywordTrends: vi.fn() },
    forecast: { analyze: vi.fn(), status: vi.fn(), ensure: vi.fn() },
    markets: { forCategory: vi.fn() },
  },
}));

import { apiClient } from './apiClient';
import { ForecastStoreProvider, STALE_AFTER_MS, useForecastEngine } from './forecastStore';
import { useDashboardState } from '../components/module-2/2.1-dashboard/useDashboardState';
import type { DashboardState } from '../components/module-2/2.1-dashboard/useDashboardState';

const listMock = apiClient.notifications.list as unknown as ReturnType<typeof vi.fn>;
const markReadMock = apiClient.notifications.markRead as unknown as ReturnType<typeof vi.fn>;
const keywordMock = apiClient.notifications.keywordTrends as unknown as ReturnType<typeof vi.fn>;
const analyzeMock = apiClient.forecast.analyze as unknown as ReturnType<typeof vi.fn>;
const statusMock = apiClient.forecast.status as unknown as ReturnType<typeof vi.fn>;
const ensureMock = apiClient.forecast.ensure as unknown as ReturnType<typeof vi.fn>;
const forCategoryMock = apiClient.markets.forCategory as unknown as ReturnType<typeof vi.fn>;

const CATEGORY = 'Coastal & Island';
const DEMO_CATEGORIES = ['Accommodation & Staycation', 'Coastal & Island', 'Adventure & Nature', 'Culinary & Gastronomy'];

// All unread, so a test that opens one starts from a known state.
const alerts = (): DemandAlert[] => MOCK_NOTIFICATIONS.map((a) => ({ ...a, isRead: false }));

function cached(over: Partial<ForecastSnapshot> = {}): ForecastSnapshot {
  return {
    alerts: alerts().slice(0, 2),
    keywordAlerts: [],
    marketsByCategory: { [CATEGORY]: marketsForCategory(CATEGORY) },
    aiServiceDown: false,
    readIds: [],
    fetchedAt: Date.now(),
    generatedAt: '2026-10-22T06:30:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockProfile.businessProfileId = 'bp-1';
  mockProfile.categories = [CATEGORY];
  listMock.mockResolvedValue(alerts());
  keywordMock.mockResolvedValue([]);
  statusMock.mockResolvedValue({ available: true });
  markReadMock.mockResolvedValue({ ok: true });
  ensureMock.mockResolvedValue({ refreshed: false, generatedAt: '2026-10-22T07:00:00Z' });
  analyzeMock.mockResolvedValue({ markets: [{}, {}] });
  forCategoryMock.mockImplementation((category: string) =>
    Promise.resolve(category in CATEGORY_MARKET_SCORES ? marketsForCategory(category) : []),
  );
});

const engine = () => renderHook(() => useForecastEngine({ persist: true }));
const settled = async (view: ReturnType<typeof engine>) => {
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  await waitFor(() => expect(view.result.current.syncing).toBe(false));
};

describe('forecast store — cached first paint', () => {
  it('is ready on the very first render when a snapshot was cached', () => {
    saveForecastCache('bp-1', [CATEGORY], cached());
    const { result } = engine();

    expect(result.current.status).toBe('ready');
    expect(result.current.snapshot?.alerts).toHaveLength(2);
  });

  it('starts in loading when there is nothing cached', () => {
    const { result } = engine();
    expect(result.current.status).toBe('loading');
    expect(result.current.snapshot).toBeNull();
  });

  it('ignores a snapshot cached for other categories', () => {
    saveForecastCache('bp-1', ['Urban & City'], cached());
    expect(engine().result.current.status).toBe('loading');
  });

  it('keeps the cached data on screen while the refresh runs, then replaces it', async () => {
    saveForecastCache('bp-1', [CATEGORY], cached());
    const view = engine();
    expect(view.result.current.snapshot?.alerts).toHaveLength(2);

    await settled(view);
    expect(view.result.current.snapshot?.alerts).toHaveLength(5);
  });

  it('writes what it reads back to the cache, keyed by profile', async () => {
    const view = engine();
    await settled(view);

    const raw = localStorage.getItem('ceview.forecast.bp-1');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).snapshot.alerts).toHaveLength(5);
  });
});

describe('forecast store — sync', () => {
  it('reads alerts, health and markets without waiting on ensure', async () => {
    ensureMock.mockReturnValue(new Promise(() => {})); // the pipeline is "still running"
    const view = engine();

    await waitFor(() => expect(view.result.current.status).toBe('ready'));
    expect(view.result.current.snapshot?.alerts).toHaveLength(5);
    expect(view.result.current.snapshot?.marketsByCategory[CATEGORY]?.length).toBeGreaterThan(0);
    expect(view.result.current.syncing).toBe(true); // still updating behind the data
  });

  it('reads once when the forecast was already fresh, and records when it was generated', async () => {
    const view = engine();
    await settled(view);

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(view.result.current.snapshot?.generatedAt).toBe('2026-10-22T07:00:00Z');
  });

  it('reads again once, after ensure reports that the pipeline ran', async () => {
    ensureMock.mockResolvedValue({ refreshed: true, generatedAt: '2026-10-22T08:00:00Z' });
    const view = engine();
    await settled(view);

    expect(listMock).toHaveBeenCalledTimes(2);
    expect(view.result.current.snapshot?.generatedAt).toBe('2026-10-22T08:00:00Z');
  });

  it('reports an unfinished profile as the error', async () => {
    ensureMock.mockRejectedValue(
      new ApiError({
        status: 409,
        method: 'POST',
        path: '/api/forecasting/ensure',
        body: { code: 'MOD22_PROFILE_NOT_READY', message: 'categories not set' },
      }),
    );
    const view = engine();

    await waitFor(() => expect(view.result.current.error).toBeInstanceOf(ApiError));
  });

  it('does not treat any other ensure failure as an error', async () => {
    ensureMock.mockRejectedValue(new Error('gemini quota'));
    const view = engine();
    await settled(view);

    expect(view.result.current.error).toBeNull();
    expect(view.result.current.snapshot?.alerts).toHaveLength(5);
  });

  it('starts a sync only once for concurrent callers', async () => {
    ensureMock.mockReturnValue(new Promise(() => {})); // keeps the first sync in flight
    const view = engine();
    await waitFor(() => expect(view.result.current.status).toBe('ready'));

    act(() => {
      void view.result.current.reload();
      void view.result.current.reload();
    });

    expect(ensureMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('syncs again when the operator’s categories change, keeping what is on screen', async () => {
    const view = engine();
    await settled(view);
    expect(forCategoryMock).toHaveBeenCalledTimes(1);

    mockProfile.categories = [CATEGORY, 'Culinary & Gastronomy'];
    view.rerender();

    await waitFor(() => expect(forCategoryMock).toHaveBeenCalledWith('Culinary & Gastronomy'));
    expect(view.result.current.snapshot).not.toBeNull();
  });
});

describe('forecast store — failures never blank the screen', () => {
  it('keeps the snapshot and says it is stale when a later refresh fails', async () => {
    const view = engine();
    await settled(view);

    listMock.mockRejectedValue(new Error('offline'));
    await act(async () => {
      await view.result.current.reload();
    });

    expect(view.result.current.snapshot?.alerts).toHaveLength(5);
    expect(view.result.current.refreshError).not.toBeNull();
    expect(view.result.current.error).toBeNull();
  });

  it('shows the error panel when there is nothing to fall back on', async () => {
    listMock.mockRejectedValue(new Error('offline'));
    const view = engine();

    await waitFor(() => expect(view.result.current.error).not.toBeNull());
    expect(view.result.current.refreshError).toBeNull();
  });

  it('clears the failure once a later read succeeds', async () => {
    const view = engine();
    await settled(view);
    listMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await view.result.current.reload();
    });
    expect(view.result.current.refreshError).not.toBeNull();

    await act(async () => {
      await view.result.current.reload();
    });
    expect(view.result.current.refreshError).toBeNull();
  });
});

describe('forecast store — read state and revalidation', () => {
  it('does not forget an alert opened since the last read', async () => {
    const view = engine();
    await settled(view);

    act(() => view.result.current.markRead('n1'));
    expect(view.result.current.isRead('n1')).toBe(true);
    expect(markReadMock).toHaveBeenCalledWith('n1');

    // The server has not caught up: it still reports n1 as unread.
    await act(async () => {
      await view.result.current.reload();
    });
    expect(view.result.current.isRead('n1')).toBe(true);
  });

  it('does not refresh a snapshot that is still fresh, and does once it is stale', async () => {
    const view = engine();
    await settled(view);
    const reads = listMock.mock.calls.length;

    act(() => view.result.current.revalidateIfStale(STALE_AFTER_MS));
    await settled(view);
    expect(listMock.mock.calls.length).toBe(reads);

    act(() => view.result.current.revalidateIfStale(0));
    await waitFor(() => expect(listMock.mock.calls.length).toBe(reads + 1));
  });

  it('runs the pipeline for a Refresh, then reads again', async () => {
    const view = engine();
    await settled(view);
    const reads = listMock.mock.calls.length;

    let result: unknown;
    await act(async () => {
      result = await view.result.current.refreshForecast();
    });

    expect(analyzeMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ markets: [{}, {}] });
    expect(listMock.mock.calls.length).toBe(reads + 1);
    expect(view.result.current.isRefreshing).toBe(false);
  });

  it('reports a failed Refresh without throwing, and keeps the data', async () => {
    const view = engine();
    await settled(view);
    analyzeMock.mockRejectedValue(new Error('quota'));

    let result: unknown = 'unset';
    await act(async () => {
      result = await view.result.current.refreshForecast();
    });

    expect(result).toBeNull();
    expect(view.result.current.error).not.toBeNull();
    expect(view.result.current.snapshot?.alerts).toHaveLength(5);
    expect(view.result.current.isRefreshing).toBe(false);
  });
});

describe('forecast store — navigating in and out of the dashboard', () => {
  function Probe({ onState }: { onState: (state: DashboardState) => void }) {
    onState(useDashboardState());
    return null;
  }

  it('shows the dashboard from the store at once on return, without reading again', async () => {
    mockProfile.categories = DEMO_CATEGORIES;
    const seen: DashboardState[] = [];
    const tree = (visible: boolean) => (
      <ForecastStoreProvider>{visible ? <Probe onState={(s) => seen.push(s)} /> : null}</ForecastStoreProvider>
    );

    const { rerender } = render(tree(true));
    await waitFor(() => expect(seen.at(-1)?.mode).toBe('normal'));
    await waitFor(() => expect(seen.at(-1)?.syncing).toBe(false));
    const reads = listMock.mock.calls.length;
    const markets = forCategoryMock.mock.calls.length;

    rerender(tree(false)); // navigate away
    seen.length = 0;
    rerender(tree(true)); // and back

    // The very first render after returning is already the real state, never skeletons.
    expect(seen[0].mode).toBe('normal');
    expect(seen[0].myAlerts).toHaveLength(5);
    expect(seen[0].topMarket).not.toBeNull();
    await act(async () => {});
    expect(listMock.mock.calls.length).toBe(reads);
    expect(forCategoryMock.mock.calls.length).toBe(markets);
  });
});
