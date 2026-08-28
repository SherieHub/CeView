/**
 * CARD — Dashboard: Markets Reveal
 * DoD: re-ranking differs correctly across ≥2 fixture categories.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarketsRevealPanel from './MarketsRevealPanel';
import { marketsForCategory } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';

const accommodationAlert = MOCK_NOTIFICATIONS.find((a) => a.id === 'n1')!; // Accommodation
const adventureAlert = MOCK_NOTIFICATIONS.find((a) => a.id === 'n3')!; // Adventure & Nature

function renderPanel(alert: typeof accommodationAlert | null, onOpenMarket = vi.fn()) {
  const markets = alert ? marketsForCategory(alert.category) : [];
  const view = render(
    <MarketsRevealPanel selectedAlert={alert} markets={markets} onOpenMarket={onOpenMarket} />,
  );
  return { ...view, onOpenMarket };
}

function rankedNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.rank-card .heading-sm')].map((n) => n.textContent ?? '');
}

describe('MarketsRevealPanel — category-scoped ranking', () => {
  // The whole point of the screen: there is no one fixed top-3 shared across
  // the app, the order depends on which alert you opened.
  it('produces a different order for a different category', () => {
    const first = renderPanel(accommodationAlert);
    expect(rankedNames(first.container)).toEqual(['South Korea', 'Japan', 'United States']);
    first.unmount();

    const second = renderPanel(adventureAlert);
    expect(rankedNames(second.container)).toEqual(['United States', 'Japan', 'South Korea']);
  });

  it('names the category the ranking belongs to', () => {
    renderPanel(accommodationAlert);
    expect(screen.getByText('Accommodation & Staycation')).toBeInTheDocument();
  });

  it('marks only the leading market with the accent treatment', () => {
    const { container } = renderPanel(accommodationAlert);

    const leads = container.querySelectorAll('.rank-no[data-lead="true"]');
    expect(leads).toHaveLength(1);
    expect(leads[0]).toHaveTextContent('1');
    expect(container.querySelectorAll('.bar--lead')).toHaveLength(1);
  });

  // korea's fixture chart has a spike; the others do not.
  it('flags a live surge only on markets whose chart is spiking', () => {
    const { container } = renderPanel(accommodationAlert);

    const surges = [...container.querySelectorAll('.rank-card')].filter((card) =>
      card.textContent?.includes('Surge active'),
    );
    expect(surges).toHaveLength(1);
    expect(surges[0]).toHaveTextContent('South Korea');
  });

  it('opens the radar for the clicked market', async () => {
    const user = userEvent.setup();
    const { onOpenMarket } = renderPanel(accommodationAlert);

    await user.click(screen.getByText('Japan'));

    expect(onOpenMarket).toHaveBeenCalledWith('japan');
  });
});

describe('MarketsRevealPanel — resting state', () => {
  it('explains the interaction before an alert is picked', () => {
    renderPanel(null);
    expect(screen.getByText('Select a surge alert')).toBeInTheDocument();
  });

  it('renders no rank cards while nothing is selected', () => {
    const { container } = renderPanel(null);
    expect(container.querySelectorAll('.rank-card')).toHaveLength(0);
  });
});
