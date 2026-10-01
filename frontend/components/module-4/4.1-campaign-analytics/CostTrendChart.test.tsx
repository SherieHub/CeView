import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CostTrendChart from './CostTrendChart';
import { MOCK_HISTORY } from '../../../services/fixtures/campaign';

describe('CostTrendChart', () => {
  it('renders without throwing against a 4-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-4);
    render(<CostTrendChart window={window} />);

    expect(screen.getByTestId('cost-trend-chart')).toHaveAttribute('data-point-count', String(window.length));
  });

  it('renders without throwing against an 8-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-8);
    render(<CostTrendChart window={window} />);

    expect(screen.getByTestId('cost-trend-chart')).toHaveAttribute('data-point-count', String(window.length));
  });
});
