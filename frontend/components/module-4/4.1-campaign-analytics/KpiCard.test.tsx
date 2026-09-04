import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiCard from './KpiCard';

describe('KpiCard', () => {
  it('shows an "up" trend for a normal metric above its benchmark', () => {
    // CTR benchmark is 2.5; value 3.5 => trend +40% (above benchmark is good).
    render(<KpiCard label="CTR" value={3.5} />);

    const trend = screen.getByTestId('kpi-trend');
    expect(trend).toHaveAttribute('data-direction', 'up');
    expect(trend).toHaveTextContent('40.0%');
  });

  it('shows a "down" trend for a normal metric below its benchmark', () => {
    // CTR benchmark is 2.5; value 1.5 => trend -40% (below benchmark is bad).
    render(<KpiCard label="CTR" value={1.5} />);

    const trend = screen.getByTestId('kpi-trend');
    expect(trend).toHaveAttribute('data-direction', 'down');
    expect(trend).toHaveTextContent('40.0%');
  });

  it('flips the trend direction for an inverse-good metric at the same raw trend sign as a normal metric', () => {
    // CPC benchmark is 2.0; value 1.5 => raw trend -25% (value below benchmark).
    // A normal metric at trend -25% shows "down" (bad). CPC is inverse-good
    // (lower is better), so the SAME raw trend sign is actually an
    // improvement, and the arrow flips to "up".
    render(<KpiCard label="CPC" value={1.5} inverseGood />);

    const trend = screen.getByTestId('kpi-trend');
    expect(trend).toHaveAttribute('data-direction', 'up');
  });

  it('shows a "down" (bad) trend for an inverse-good metric above its benchmark', () => {
    // CAC benchmark is 150; value 300 => trend +100% (above benchmark is worse for inverse-good).
    render(<KpiCard label="CAC" value={300} inverseGood />);

    const trend = screen.getByTestId('kpi-trend');
    expect(trend).toHaveAttribute('data-direction', 'down');
  });

  it('renders 0 cleanly (not NaN/Infinity) for a flagged metric', () => {
    render(<KpiCard label="CPC" value={0} inverseGood />);

    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
    // 0 is on the "good" side of CPC's benchmark per the same formula used
    // for any other value — no special-casing for the flagged/zero case.
    expect(screen.getByTestId('kpi-trend')).toHaveAttribute('data-direction', 'up');
  });

  it('renders the label', () => {
    render(<KpiCard label="ROAS" value={6} />);
    expect(screen.getByText('ROAS')).toBeInTheDocument();
  });
});
