/**
 * CARD — Dashboard: AI Status Banner & Refresh Forecast (+ Signal Summary)
 *
 * The three small slot components that own the dashboard's status surface.
 * Grouped in one file because each is a handful of assertions and they share
 * the same concern: telling the operator what state the forecast data is in.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AiStatusBanner from './AiStatusBanner';
import RefreshForecastButton from './RefreshForecastButton';
import SignalSummary from './SignalSummary';
import { ToastProvider } from '../../shared/Toast';

function withToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('AiStatusBanner', () => {
  it('stays out of the way when the service is healthy', () => {
    const { container } = render(<AiStatusBanner visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the degraded state rather than changing numbers silently', () => {
    render(<AiStatusBanner visible />);

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('AI Forecast Service Unavailable');
    expect(banner).toHaveTextContent('last successful forecast run');
  });
});

describe('RefreshForecastButton', () => {
  it('disables itself and reports progress while the pipeline runs', async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onRefresh = vi.fn(() => new Promise<void>((r) => (resolve = r)));

    withToast(<RefreshForecastButton isRefreshing={false} degraded={false} onRefresh={onRefresh} />);
    await user.click(screen.getByRole('button'));

    expect(onRefresh).toHaveBeenCalled();
    resolve();
  });

  it('shows the running label while refreshing', () => {
    withToast(<RefreshForecastButton isRefreshing degraded={false} onRefresh={vi.fn()} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Running pipeline');
  });

  it('confirms a successful refresh', async () => {
    const user = userEvent.setup();
    withToast(
      <RefreshForecastButton isRefreshing={false} degraded={false} onRefresh={vi.fn().mockResolvedValue(undefined)} />,
    );

    await user.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(screen.getByText('Forecast refreshed — 3 markets re-ranked')).toBeInTheDocument(),
    );
  });

  // The prototype's banner said refreshing would not produce new predictions,
  // then toasted that it had. The page contradicted itself in the one state
  // where the operator most needs to trust it.
  it('does not claim a refresh succeeded while the service is down', async () => {
    const user = userEvent.setup();
    withToast(
      <RefreshForecastButton isRefreshing={false} degraded onRefresh={vi.fn().mockResolvedValue(undefined)} />,
    );

    await user.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(
        screen.getByText('Forecast service still unavailable — showing cached rankings'),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Forecast refreshed/)).not.toBeInTheDocument();
  });
});

describe('SignalSummary', () => {
  const base = {
    loading: false,
    degraded: false,
    unreadCount: 3,
    surgeCount: 2,
    surgeMarkets: ['South Korea'],
    topMarket: { id: 'usa', name: 'United States', matchScore: 90, category: 'Adventure & Nature' },
    onOpenMarket: vi.fn(),
  };

  it('reports the counts and names the surging markets', () => {
    render(<SignalSummary {...base} />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('South Korea')).toBeInTheDocument();
    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByText('90/100 · Adventure & Nature')).toBeInTheDocument();
  });

  it('skeletons the whole strip while loading, not just the feed', () => {
    const { container } = render(<SignalSummary {...base} loading />);
    expect(container.querySelectorAll('.skel')).toHaveLength(3);
  });

  it('opens the radar from the top-market tile', async () => {
    const user = userEvent.setup();
    const onOpenMarket = vi.fn();
    render(<SignalSummary {...base} onOpenMarket={onOpenMarket} />);

    await user.click(screen.getByText('United States'));

    expect(onOpenMarket).toHaveBeenCalledWith('usa');
  });

  it('marks the figures as cached when the forecast service is down', () => {
    render(<SignalSummary {...base} degraded />);
    expect(screen.getByText('cached')).toBeInTheDocument();
  });

  it('degrades gracefully when no market has been ranked', () => {
    render(<SignalSummary {...base} topMarket={null} />);

    expect(screen.getByText('No markets ranked yet')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('reassures rather than showing a bare zero when everything is read', () => {
    render(<SignalSummary {...base} unreadCount={0} />);
    expect(screen.getByText('You are all caught up')).toBeInTheDocument();
  });
});
