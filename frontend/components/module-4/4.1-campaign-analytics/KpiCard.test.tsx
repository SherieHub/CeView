import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import KpiCard from './KpiCard';

describe('KpiCard', () => {
  it('renders the label and formatted value', () => {
    render(<KpiCard label="CTR" value={3.5} />);

    expect(screen.getByText('CTR')).toBeInTheDocument();
    expect(screen.getByText('3.50')).toBeInTheDocument();
  });

  it('renders 0 cleanly (not NaN/Infinity) for a flagged metric', () => {
    render(<KpiCard label="CPC" value={0} />);

    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Infinity/)).not.toBeInTheDocument();
  });

  it('renders no trend badge — there is no honest per-business benchmark to compare against', () => {
    render(<KpiCard label="ROAS" value={6} />);
    expect(screen.queryByTestId('kpi-trend')).not.toBeInTheDocument();
  });
});
