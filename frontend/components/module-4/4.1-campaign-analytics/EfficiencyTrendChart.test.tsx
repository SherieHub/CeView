import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EfficiencyTrendChart from './EfficiencyTrendChart';
import { MOCK_HISTORY } from '../../../services/fixtures/campaign';

describe('EfficiencyTrendChart', () => {
  it('renders without throwing against a 4-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-4);
    render(<EfficiencyTrendChart window={window} />);

    expect(screen.getByTestId('efficiency-trend-chart')).toHaveAttribute(
      'data-point-count',
      String(window.length)
    );
  });

  it('renders without throwing against an 8-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-8);
    render(<EfficiencyTrendChart window={window} />);

    expect(screen.getByTestId('efficiency-trend-chart')).toHaveAttribute(
      'data-point-count',
      String(window.length)
    );
  });
});
