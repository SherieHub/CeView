import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarketsRevealPanel from './MarketsRevealPanel';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import { MOCK_NOTIFICATIONS } from '../../../services/fixtures/notifications';

describe('MarketsRevealPanel — ranking formula', () => {
  it('renders the documented formula in a visible footer card when rankings are shown', () => {
    render(
      <MarketsRevealPanel
        selectedAlert={MOCK_NOTIFICATIONS[0]}
        markets={MOCK_MARKETS}
        onOpenMarket={vi.fn()}
      />,
    );

    const footer = screen.getByTestId('ranking-formula');
    expect(footer).toHaveClass('card');
    expect(footer).toHaveTextContent(
      'market_score = 0.40·demand₄w + 0.35·seasonality + 0.25·economic_viability',
    );
  });
});
