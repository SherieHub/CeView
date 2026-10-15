import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
