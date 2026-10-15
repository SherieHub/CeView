import { OverlayStackProvider } from '../../shared/useOverlayStack';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PhilippineRegionsPanel from './PhilippineRegionsPanel';
import MarketsRevealPanel from './MarketsRevealPanel';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';

describe('MarketsRevealPanel', () => {
  it('lists the ranked markets without the ranking-formula footer', () => {
    render(
      <MarketsRevealPanel
        selectedAlert={MOCK_NOTIFICATIONS[0]}
        markets={MOCK_MARKETS}
        onOpenMarket={vi.fn()}
      />,
    );

    for (const market of MOCK_MARKETS) {
      expect(screen.getByRole('heading', { name: market.name })).toBeInTheDocument();
    }
    expect(screen.queryByTestId('ranking-formula')).not.toBeInTheDocument();
    expect(screen.queryByText(/market_score/)).not.toBeInTheDocument();
  });
});

describe('PhilippineRegionsPanel', () => {
  it('shows the empty card until selection and returns to it when cleared', () => {
    const { rerender } = render(<PhilippineRegionsPanel selectedAlert={null} />);
    expect(screen.getByRole('heading', { name: 'Select a surge alert' })).toBeInTheDocument();
    expect(screen.queryByText('CALABARZON')).not.toBeInTheDocument();
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
    rerender(<PhilippineRegionsPanel selectedAlert={MOCK_NOTIFICATIONS[0]} />);
    expect(screen.queryByText('Select a surge alert')).not.toBeInTheDocument();
    expect(screen.getByText('CALABARZON')).toBeInTheDocument();
    rerender(<PhilippineRegionsPanel selectedAlert={null} />);
    expect(screen.getByText('Select a surge alert')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
  it('labels the regional preview as sample data and shows all five regions', () => {
    render(<PhilippineRegionsPanel selectedAlert={MOCK_NOTIFICATIONS[0]} />);
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument();
    expect(screen.getByText(MOCK_NOTIFICATIONS[0].category!)).toBeInTheDocument();
    expect(screen.getByText(/live regional forecasts are not available/)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('CALABARZON')).toBeInTheDocument();
  });
});

it('opens region details from a row and closes them', () => {
  render(<OverlayStackProvider><PhilippineRegionsPanel selectedAlert={MOCK_NOTIFICATIONS[0]} /></OverlayStackProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'View CALABARZON region details' }));
  expect(screen.getByRole('dialog', { name: 'CALABARZON region details' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
