import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CampaignAnalyticsView from './CampaignAnalyticsView';
import { MOCK_HISTORY, MOCK_REPORT } from '../../../services/fixtures/campaign';

vi.mock('../../../services/apiClient', () => ({
  apiClient: {
    campaign: {
      history: vi.fn(() => Promise.resolve(MOCK_HISTORY)),
      report: vi.fn(() => Promise.resolve(MOCK_REPORT)),
    },
  },
}));

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
    render(<CampaignAnalyticsView />);

    expect(screen.getByText(/no campaign data found/i)).toBeInTheDocument();
    expect(screen.queryByTestId('pes-trend-probe')).not.toBeInTheDocument();
  });

  it('blocks submission with an inline error when a field is negative', () => {
    render(<CampaignAnalyticsView />);

    const impressionsInput = screen.getByLabelText(/impressions/i);
    fireEvent.change(impressionsInput, { target: { value: '-5' } });
    submitDefaultCampaign();

    expect(screen.getByRole('alert')).toHaveTextContent('All fields must be non-negative numbers.');
    expect(screen.getByText(/no campaign data found/i)).toBeInTheDocument();
  });

  it('transitions to the full view after a valid submission', async () => {
    render(<CampaignAnalyticsView />);

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

  it('re-slices the trend window when weeks changes from 4 to 8', async () => {
    render(<CampaignAnalyticsView />);

    submitDefaultCampaign();
    // waitFor's own polling loop also runs on the timer clock, so it can
    // never observe a change while fake timers are frozen — advance past the
    // form's setTimeout, then switch back to real timers before waiting.
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    vi.useRealTimers();
    await waitFor(() => expect(screen.getByTestId('pes-trend-probe')).toBeInTheDocument());

    expect(screen.getByTestId('pes-trend-probe')).toHaveAttribute('data-weeks', '4');
    expect(screen.getByTestId('pes-trend-probe')).toHaveAttribute(
      'data-window-length',
      String(MOCK_HISTORY.slice(-4).length)
    );

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
    render(<CampaignAnalyticsView />);

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
});
