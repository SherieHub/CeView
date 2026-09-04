import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PesTrendChart from './PesTrendChart';
import { MOCK_HISTORY } from '../../../services/fixtures/campaign';

// The 4WK/8WK window control is a single shared toggle in the shell now
// (governs all three trend charts) — its behaviour is covered in
// CampaignAnalyticsView.test.tsx. This component just renders `window`.

describe('PesTrendChart', () => {
  it('renders without throwing against a 4-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-4);
    render(<PesTrendChart window={window} />);

    expect(screen.getByTestId('pes-trend-chart')).toHaveAttribute('data-point-count', String(window.length));
  });

  it('renders without throwing against an 8-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-8);
    render(<PesTrendChart window={window} />);

    expect(screen.getByTestId('pes-trend-chart')).toHaveAttribute('data-point-count', String(window.length));
  });

  it('no longer renders a week toggle of its own', () => {
    render(<PesTrendChart window={MOCK_HISTORY.slice(-4)} />);

    expect(screen.queryByRole('button', { name: '4WK' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '8WK' })).not.toBeInTheDocument();
  });
});
