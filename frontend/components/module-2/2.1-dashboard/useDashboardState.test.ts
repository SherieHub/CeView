/**
 * CARD — Foundation: Dashboard & Radar Shell
 * DoD: covers useDashboardState()'s loading/success/failure transitions.
 *
 * Also pins the three invariants the port had to carry over from
 * ui-ux-prototype.html, each of which is easy to lose in a rewrite and silent
 * when lost.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';
import { marketsForCategory, CATEGORY_MARKET_SCORES } from '../../../services/fixtures/markets';
import { ApiError } from '../../../services/apiError';
import type { DemandAlert } from '@/types';

const mockProfile = { categories: [] as string[] };

vi.mock('../../../services/profileContext', () => ({
  useProfile: () => ({ profile: mockProfile, setProfile: vi.fn(), isLoading: false }),
}));

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    notifications: { list: vi.fn(), markRead: vi.fn(), keywordTrends: vi.fn() },
    forecast: { analyze: vi.fn(), status: vi.fn() },
    markets: { forCategory: vi.fn() },
  },
}));

import { apiClient } from '../../../services/apiClient';
import { useDashboardState } from './useDashboardState';

const listMock = apiClient.notifications.list as unknown as ReturnType<typeof vi.fn>;
const markReadMock = apiClient.notifications.markRead as unknown as ReturnType<typeof vi.fn>;
const keywordTrendsMock = apiClient.notifications.keywordTrends as unknown as ReturnType<
  typeof vi.fn
>;
const analyzeMock = apiClient.forecast.analyze as unknown as ReturnType<typeof vi.fn>;
const statusMock = apiClient.forecast.status as unknown as ReturnType<typeof vi.fn>;
const forCategoryMock = apiClient.markets.forCategory as unknown as ReturnType<typeof vi.fn>;

/** Deep copies so a test can never mutate the shared fixture by accident. */
function alerts(): DemandAlert[] {
  return MOCK_NOTIFICATIONS.map((a) => ({ ...a }));
}

function setup(categories: string[], list: DemandAlert[] = alerts(), available = true) {
  mockProfile.categories = categories;
  listMock.mockResolvedValue(list);
  statusMock.mockResolvedValue({ available });
  markReadMock.mockResolvedValue({ ok: true });
  analyzeMock.mockResolvedValue({ rerankedMarkets: 3 });
  // Empty by default: most tests don't care about the keyword-trend merge.
  keywordTrendsMock.mockResolvedValue([]);
  // Mirrors the real backend: a category with no scored markets comes back
  // empty rather than falling back to some other category's ranking.
  forCategoryMock.mockImplementation((category: string) =>
    Promise.resolve(category in CATEGORY_MARKET_SCORES ? marketsForCategory(category) : []),
  );
}

const DEMO_CATEGORIES = [
  'Accommodation & Staycation',
  'Coastal & Island',
  'Adventure & Nature',
  'Culinary & Gastronomy',
];

async function renderReady(...args: Parameters<typeof setup>) {
  setup(...args);
  const view = renderHook(() => useDashboardState());
  await waitFor(() => expect(view.result.current.mode).not.toBe('loading'));
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDashboardState — load transitions', () => {
  it('starts in loading and settles into normal once alerts arrive', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);
    expect(result.current.mode).toBe('normal');
  });

  it('falls back to degraded mode when the load fails, rather than looking empty', async () => {
    mockProfile.categories = DEMO_CATEGORIES;
    listMock.mockRejectedValue(new Error('offline'));
    statusMock.mockRejectedValue(new Error('offline'));
    forCategoryMock.mockResolvedValue([]);
    keywordTrendsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardState());
    await waitFor(() => expect(result.current.mode).not.toBe('loading'));

    // Not 'empty' — telling an operator they have no alerts when the request
    // simply failed is a lie about their data.
    expect(result.current.mode).toBe('ai-down');
  });

  it('keeps keyword-trend alerts even when they resolve BEFORE the primary load', async () => {
    // Regression guard. Keyword trends and the primary alert load are separate
    // effects; if both wrote to one `alerts` state, whichever resolved last
    // would clobber the other. Today keywordTrends is the slow one (~9s of
    // PyTrends vs ~0.15s), but the planned rank-markets cache would invert
    // that — so the hook must not depend on resolution order at all.
    mockProfile.categories = DEMO_CATEGORIES;

    const keyword = {
      ...alerts()[0],
      id: 'keyword-1',
      title: 'Keyword Trend Alert — Coastal & Island',
      alertLevel: 'INFO' as const,
    };

    // Keyword trends resolve immediately; the primary list resolves later.
    keywordTrendsMock.mockResolvedValue([keyword]);
    listMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(alerts()), 20)),
    );
    statusMock.mockResolvedValue({ available: true });
    forCategoryMock.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardState());
    await waitFor(() => expect(result.current.mode).not.toBe('loading'));

    // Both sources must survive: the late primary load must not erase the
    // early keyword alert.
    await waitFor(() =>
      expect(result.current.myAlerts.some((a) => a.id === 'keyword-1')).toBe(true),
    );
    expect(result.current.myAlerts.length).toBeGreaterThan(1);
  });

  it('reports ai-down when the forecast service says it is unavailable', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES, alerts(), false);
    expect(result.current.mode).toBe('ai-down');
  });

  it('exposes the error when the alert load fails', async () => {
    mockProfile.categories = DEMO_CATEGORIES;
    listMock.mockRejectedValue(
      new ApiError({
        status: 503,
        method: 'GET',
        path: '/api/notifications',
        body: { code: 'MOD22_MARKETS_FAILED', message: 'boom' },
      }),
    );
    statusMock.mockResolvedValue({ available: true });
    forCategoryMock.mockResolvedValue([]);
    keywordTrendsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardState());
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
  });

  it('keeps alerts when only the health check fails', async () => {
    mockProfile.categories = DEMO_CATEGORIES;
    listMock.mockResolvedValue(alerts());
    statusMock.mockRejectedValue(new Error('down'));
    markReadMock.mockResolvedValue({ ok: true });
    forCategoryMock.mockImplementation((category: string) =>
      Promise.resolve(category in CATEGORY_MARKET_SCORES ? marketsForCategory(category) : []),
    );
    keywordTrendsMock.mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardState());
    await waitFor(() => expect(result.current.myAlerts.length).toBeGreaterThan(0));
    // A failing health probe still has to be reflected as degraded — it just
    // must not have blanked the alerts to get there.
    expect(result.current.mode).toBe('ai-down');
  });
});

describe('useDashboardState — the two distinct empties', () => {
  // The prototype is careful about this and it is easy to collapse: they have
  // different causes, different copy and different remedies.
  it('reports empty when no forecast has ever run', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES, []);
    expect(result.current.mode).toBe('empty');
  });

  it('stays in normal mode when alerts exist but none match the categories', async () => {
    const { result } = await renderReady(['Wellness & Spa']);

    expect(result.current.mode).toBe('normal');
    expect(result.current.myAlerts).toHaveLength(0);
  });
});

describe('useDashboardState — category scoping', () => {
  it('filters alerts to the operator’s own categories', async () => {
    const { result } = await renderReady(['Culinary & Gastronomy']);

    expect(result.current.myAlerts.map((a) => a.id)).toEqual(['n8']);
  });

  it('counts unread and surges against the filtered set, not everything', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);

    expect(result.current.myAlerts).toHaveLength(5);
    expect(result.current.unreadCount).toBe(3);
    expect(result.current.surgeCount).toBe(2);
  });
});

describe('useDashboardState — selection', () => {
  it('opens a market ranking scoped to the selected alert’s category', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);

    act(() => result.current.selectAlert('n1')); // Accommodation & Staycation
    expect(result.current.showMarkets).toBe(true);
    await waitFor(() => expect(result.current.rankedMarkets[0]?.id).toBe('korea'));

    act(() => result.current.selectAlert('n3')); // Adventure & Nature
    await waitFor(() => expect(result.current.rankedMarkets[0]?.id).toBe('usa'));
  });

  it('collapses when the open alert is clicked again', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);

    act(() => result.current.selectAlert('n1'));
    act(() => result.current.selectAlert('n1'));

    expect(result.current.selectedAlert).toBeNull();
    expect(result.current.showMarkets).toBe(false);
    // Collapsing does not un-read it.
    expect(result.current.isRead('n1')).toBe(true);
  });

  it('marks an alert read as a side effect of viewing it', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);
    expect(result.current.isRead('n1')).toBe(false);

    act(() => result.current.selectAlert('n1'));

    expect(result.current.isRead('n1')).toBe(true);
    expect(result.current.unreadCount).toBe(2);
    expect(markReadMock).toHaveBeenCalledWith('n1');
  });

  // ui-ux-prototype.html:2382-2383. A selection that no longer belongs to any
  // of the operator's categories must not render a markets column.
  it('drops a stale selection when the categories no longer cover it', async () => {
    const { result, rerender } = await renderReady(DEMO_CATEGORIES);

    act(() => result.current.selectAlert('n8')); // Culinary & Gastronomy
    expect(result.current.showMarkets).toBe(true);

    mockProfile.categories = ['Coastal & Island'];
    rerender();

    expect(result.current.selectedAlert).toBeNull();
    expect(result.current.showMarkets).toBe(false);
  });
});

describe('useDashboardState — read state ownership', () => {
  // The prototype did `n.isRead = true` on the module-level MOCK_NOTIFICATIONS.
  // Ported literally that leaks between tests and makes the suite
  // order-dependent, so read state lives in the hook instead.
  it('never mutates the shared notification fixture', async () => {
    const before = MOCK_NOTIFICATIONS.map((a) => a.isRead);
    const { result } = await renderReady(DEMO_CATEGORIES);

    act(() => result.current.selectAlert('n1'));
    act(() => result.current.selectAlert('n2'));

    expect(MOCK_NOTIFICATIONS.map((a) => a.isRead)).toEqual(before);
  });

  it('survives a failed markRead without breaking the local read state', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);
    markReadMock.mockRejectedValue(new Error('offline'));

    act(() => result.current.selectAlert('n1'));

    expect(result.current.isRead('n1')).toBe(true);
  });
});

describe('useDashboardState — feed filter', () => {
  it('narrows to unread and to surges', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);

    act(() => result.current.setFeedFilter('unread'));
    expect(result.current.visibleAlerts.map((a) => a.id)).toEqual(['n1', 'n2', 'n8']);

    act(() => result.current.setFeedFilter('surge'));
    expect(result.current.visibleAlerts.map((a) => a.id)).toEqual(['n1', 'n8']);

    act(() => result.current.setFeedFilter('all'));
    expect(result.current.visibleAlerts).toHaveLength(5);
  });
});

describe('useDashboardState — summary derivations', () => {
  it('names the surge markets once each', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);
    // n1 and n8 are both South Korea.
    expect(result.current.surgeMarkets).toEqual(['South Korea']);
  });

  it('picks the best-scoring market across every category the operator covers', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);

    // Adventure & Nature ranks usa at 90, the highest of any category's leader.
    await waitFor(() => expect(result.current.topMarket).toMatchObject({ id: 'usa', matchScore: 90 }));
  });

  it('has no top market when the operator covers no known category', async () => {
    const { result } = await renderReady(['Wellness & Spa']);
    await waitFor(() => expect(forCategoryMock).toHaveBeenCalledWith('Wellness & Spa'));
    expect(result.current.topMarket).toBeNull();
  });
});

describe('useDashboardState — refresh', () => {
  it('re-runs the pipeline, reloads alerts, and clears the refreshing flag', async () => {
    const { result } = await renderReady(DEMO_CATEGORIES);

    await act(async () => {
      await result.current.refresh();
    });

    expect(analyzeMock).toHaveBeenCalled();
    expect(listMock).toHaveBeenCalledTimes(2);
    expect(result.current.isRefreshing).toBe(false);
  });
});

describe('useDashboardState — keyword-trend merge', () => {
  // Task 7a: keyword-trend notifications round-trip to PyTrends via FastAPI and
  // can take tens of seconds or fail outright — neither should ever touch the
  // primary alert feed or the dashboard's error state.
  it('leaves demand alerts intact and error null when the keyword-trend fetch fails', async () => {
    setup(DEMO_CATEGORIES);
    keywordTrendsMock.mockRejectedValue(new Error('pytrends timeout'));

    const { result } = renderHook(() => useDashboardState());
    await waitFor(() => expect(result.current.mode).not.toBe('loading'));

    expect(result.current.myAlerts).toHaveLength(5);
    expect(result.current.error).toBeNull();
  });
});

describe('useDashboardState — forceMode', () => {
  it('pins the mode for the dev preview routes without touching the real data', async () => {
    setup(DEMO_CATEGORIES);
    const { result } = renderHook(() => useDashboardState({ forceMode: 'ai-down' }));

    await waitFor(() => expect(result.current.myAlerts).toHaveLength(5));
    expect(result.current.mode).toBe('ai-down');
  });
});
