import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PesTrendChart from './PesTrendChart';
import { MOCK_HISTORY } from '../../../services/fixtures/campaign';

describe('PesTrendChart', () => {
  it('renders without throwing against a 4-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-4);
    render(<PesTrendChart window={window} weeks={4} onWeeksChange={vi.fn()} />);

    expect(screen.getByTestId('pes-trend-chart')).toHaveAttribute('data-point-count', String(window.length));
  });

  it('renders without throwing against an 8-week window and reflects its data-point count', () => {
    const window = MOCK_HISTORY.slice(-8);
    render(<PesTrendChart window={window} weeks={8} onWeeksChange={vi.fn()} />);

    expect(screen.getByTestId('pes-trend-chart')).toHaveAttribute('data-point-count', String(window.length));
  });

  it('calls onWeeksChange(8) when the 8WK button is clicked', () => {
    const onWeeksChange = vi.fn();
    render(<PesTrendChart window={MOCK_HISTORY.slice(-4)} weeks={4} onWeeksChange={onWeeksChange} />);

    fireEvent.click(screen.getByRole('button', { name: '8WK' }));

    expect(onWeeksChange).toHaveBeenCalledWith(8);
  });

  it('calls onWeeksChange(4) when the 4WK button is clicked', () => {
    const onWeeksChange = vi.fn();
    render(<PesTrendChart window={MOCK_HISTORY.slice(-8)} weeks={8} onWeeksChange={onWeeksChange} />);

    fireEvent.click(screen.getByRole('button', { name: '4WK' }));

    expect(onWeeksChange).toHaveBeenCalledWith(4);
  });

  it('marks the 4WK button as pressed and the 8WK button as unpressed when weeks is 4', () => {
    render(<PesTrendChart window={MOCK_HISTORY.slice(-4)} weeks={4} onWeeksChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '8WK' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks the 8WK button as pressed and the 4WK button as unpressed when weeks is 8', () => {
    render(<PesTrendChart window={MOCK_HISTORY.slice(-8)} weeks={8} onWeeksChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '8WK' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'false');
  });
});
