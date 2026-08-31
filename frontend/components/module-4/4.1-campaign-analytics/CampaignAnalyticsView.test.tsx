import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CampaignAnalyticsView from './CampaignAnalyticsView';
import { MOCK_HISTORY, MOCK_REPORT } from '../../../services/fixtures/campaign';
import { PostStoreProvider } from '../../../services/postStore';
import { apiClient } from '../../../services/apiClient';
import { ApiError } from '../../../services/apiError';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    campaign: {
      history: vi.fn(() => Promise.resolve(MOCK_HISTORY)),
      report: vi.fn(() => Promise.resolve(MOCK_REPORT)),
      // IngestionForm now persists via this before calling onSubmit (Task
      // 16) — its response is intentionally discarded by the form, so an
      // empty resolution is enough to let submission proceed.
      ingest: vi.fn(() => Promise.resolve({ ok: true })),
    },
    // PreviouslyPublished (mounted for real by the full view since m4c7
    // landed) reads usePosts(), which needs apiClient.posts.list() to
    // resolve — not otherwise exercised by this shell-level test file, so an
    // empty list is enough to satisfy PostStoreProvider's seed fetch.
    posts: {
      list: vi.fn(() => Promise.resolve([])),
    },
  },
}));

function renderView() {
  return render(
    <PostStoreProvider>
      <CampaignAnalyticsView />
    </PostStoreProvider>
  );
}

// PesTrendChart is a stub, but per the Trend Charts card text ("this card
// only owns the toggle control and rendering"), the real 4/8-week toggle UI
// lives inside PesTrendChart itself, not the shell — the shell only holds
// `weeks` state and re-slices `window` when it changes. Replace the stub with
// a probe that surfaces its received props and lets the test trigger
// onWeeksChange the same way the real component eventually will.
vi.mock('./PesTrendChart', () => ({
  default: ({ window, weeks, onWeeksChange }: { window: unknown[]; weeks: number; onWeeksChange: (w: 4 | 8) => void }) => (
    <div>
      <div data-testid="pes-trend-probe" data-weeks={weeks} data-window-length={window.length} />
      <button type="button" onClick={() => onWeeksChange(8)}>probe-set-8-weeks</button>
    </div>
  ),
}));

function submitDefaultCampaign() {
  fireEvent.click(screen.getByRole('button', { name: /generate campaign analytics/i }));
}

describe('CampaignAnalyticsView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders only the ingestion form when no campaign has been submitted', () => {
    renderView();

    expect(screen.getByText(/no campaign data found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('pes-trend-probe')).not.toBeInTheDocument();
  });

  it('blocks submission with an inline error when a field is negative', () => {
    renderView();

    const impressionsInput = screen.getByLabelText(/impressions/i);
    fireEvent.change(impressionsInput, { target: { value: '-5' } });
    submitDefaultCampaign();

    expect(screen.getByRole('alert')).toHaveTextContent('All fields must be non-negative numbers.');
    expect(screen.getByText(/no campaign data found/i)).toBeInTheDocument();
  });

  it('transitions to the full view after a valid submission', async () => {
    renderView();

    submitDefaultCampaign();
    expect(screen.getByText(/computing analytics/i)).toBeInTheDocument();

    // waitFor's own polling loop also runs on the timer clock, so it can
    // never observe a change while fake timers are frozen — advance past the
    // form's setTimeout, then switch back to real timers before waiting.
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByTestId('pes-trend-probe')).toBeInTheDocument());

    expect(screen.queryByText(/no campaign data found/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new submission/i })).toBeInTheDocument();
  });

  it('shows the server-computed PES score/label in the gauge when the ingest response has one', async () => {
    vi.spyOn(apiClient.campaign, 'ingest').mockResolvedValue({
      pes: { overallScore: 0.5773, label: 'Fair Performance', breakdown: [] },
    } as never);

    renderView();
    submitDefaultCampaign();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByTestId('pes-trend-probe')).toBeInTheDocument());

    expect(screen.getByTestId('pes-score-value')).toHaveTextContent('0.58');
    expect(screen.getByTestId('pes-label')).toHaveTextContent('Fair Performance');
  });

  it('falls back to the client-computed PES when the ingest response has none', async () => {
    // Default mock resolves { ok: true } — no `pes` field, same as a
    // VITE_USE_FIXTURES=true run's ingest response.
    renderView();
    submitDefaultCampaign();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByTestId('pes-trend-probe')).toBeInTheDocument());

    // DEFAULT_CAMPAIGN_INPUT run through campaignMetrics.ts's computeMetrics/computePes.
    expect(screen.getByTestId('pes-score-value')).toBeInTheDocument();
  });

  it('re-slices the trend window when weeks changes from 4 to 8', async () => {
    renderView();

    submitDefaultCampaign();
    // waitFor's own polling loop also runs on the timer clock, so it can
    // never observe a change while fake timers are frozen — advance past the
    // form's setTimeout, then switch back to real timers before waiting.
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();
    // Wait for the window to actually be populated, not just for the probe to
    // mount: the probe appears as soon as `campaign` is set (synchronous with
    // submission), but `history` lands a tick later via a separate async
    // apiClient.campaign.history() call — asserting right after presence
    // alone races that fetch and can catch data-window-length at its
    // pre-fetch "0" value.
    await waitFor(() =>
      expect(screen.getByTestId('pes-trend-probe')).toHaveAttribute(
        'data-window-length',
        String(MOCK_HISTORY.slice(-4).length)
      )
    );

    expect(screen.getByTestId('pes-trend-probe')).toHaveAttribute('data-weeks', '4');

    // Simulates PesTrendChart's own toggle calling back up via onWeeksChange —
    // the real toggle UI belongs to that (still-stubbed) sibling card, not
    // this shell; this exercises the shell's own re-slicing logic.
    fireEvent.click(screen.getByRole('button', { name: 'probe-set-8-weeks' }));

    expect(screen.getByTestId('pes-trend-probe')).toHaveAttribute('data-weeks', '8');
    expect(screen.getByTestId('pes-trend-probe')).toHaveAttribute(
      'data-window-length',
      String(MOCK_HISTORY.slice(-8).length)
    );
  });

  it('"New submission" clears the campaign and returns to the ingestion form', async () => {
    renderView();

    submitDefaultCampaign();
    // waitFor's own polling loop also runs on the timer clock, so it can
    // never observe a change while fake timers are frozen — advance past the
    // form's setTimeout, then switch back to real timers before waiting.
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByTestId('pes-trend-probe')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /new submission/i }));

    expect(screen.getByText(/no campaign data found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('pes-trend-probe')).not.toBeInTheDocument();
  });

  it('renders the error panel when the report call fails', async () => {
    vi.spyOn(apiClient.campaign, 'report').mockRejectedValue(
      new ApiError({
        status: 503,
        method: 'POST',
        path: '/api/analytics/report',
        body: { code: 'ai_service_unreachable', message: 'fastapi unreachable' },
      }),
    );
    vi.spyOn(apiClient.campaign, 'history').mockResolvedValue([]);

    renderView();
    submitDefaultCampaign();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();

    expect(await screen.findByText(/setup required|something went wrong/i)).toBeInTheDocument();
  });

  it('shows a degraded state when the report comes back empty', async () => {
    vi.spyOn(apiClient.campaign, 'report').mockResolvedValue({} as never);
    vi.spyOn(apiClient.campaign, 'history').mockResolvedValue([]);

    renderView();
    submitDefaultCampaign();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();

    expect(await screen.findByText(/returned no content/i)).toBeInTheDocument();
  });

  it('keeps rendering successfully-loaded history when the report call fails', async () => {
    vi.spyOn(apiClient.campaign, 'report').mockRejectedValue(
      new ApiError({
        status: 503,
        method: 'POST',
        path: '/api/analytics/report',
        body: { code: 'ai_service_unreachable', message: 'fastapi unreachable' },
      }),
    );
    vi.spyOn(apiClient.campaign, 'history').mockResolvedValue(MOCK_HISTORY);

    renderView();
    submitDefaultCampaign();
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();

    await screen.findByText(/setup required|something went wrong/i);
    await waitFor(() =>
      expect(screen.getByTestId('pes-trend-probe')).toHaveAttribute(
        'data-window-length',
        String(MOCK_HISTORY.slice(-4).length),
      ),
    );
  });
});
