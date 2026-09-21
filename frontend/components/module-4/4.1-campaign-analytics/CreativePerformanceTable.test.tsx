import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CreativePerformance, LinkPerformance } from '../../../types';
import CreativePerformanceTable from './CreativePerformanceTable';

const creative = (id: string | null, clicks: number, conversions: number, revenue = 0): CreativePerformance => ({
  externalAdId: id, adLabel: null, untagged: id === null, clicks, conversions, revenue,
});
function result(creatives: CreativePerformance[]): LinkPerformance {
  return { linkId: 'link', slug: 'slug', creatives,
    totalClicks: creatives.reduce((n, c) => n + c.clicks, 0),
    totalConversions: creatives.reduce((n, c) => n + c.conversions, 0),
    totalRevenue: creatives.reduce((n, c) => n + c.revenue, 0) };
}

describe('CreativePerformanceTable', () => {
  it('sorts by conversions, retains zero rows and includes untagged in totals without mutating props', () => {
    const data = result([creative('C', 0, 0), creative(null, 2, 1, 250), creative('B', 2, 1), creative('A', 3, 2, 1500.5)]);
    render(<CreativePerformanceTable performance={data} />);
    const rows = screen.getAllByRole('row');
    expect(rows.slice(1, -1).map(row => within(row).getAllByRole('cell')[0].textContent))
      .toEqual(['Ad A', 'Ad B', 'Organic / untagged', 'Ad C']);
    expect(within(rows[4]).getAllByRole('cell').map(c => c.textContent)).toEqual(['Ad C', '0', '0', '₱0.00']);
    expect(rows[5]).toHaveTextContent('7');
    expect(rows[5]).toHaveTextContent('4');
    expect(rows[5]).toHaveTextContent('₱1,750.50');
    expect(data.creatives[0].externalAdId).toBe('C');
    expect(screen.getByText(/floor, not a census/i)).toBeVisible();
    expect(screen.queryByText(/bare link may have been pasted/i)).not.toBeInTheDocument();
  });

  it('diagnoses only untagged observed traffic even with a zero-click tagged row', () => {
    render(<CreativePerformanceTable performance={result([creative(null, 4, 1), creative('A', 0, 0)])} />);
    expect(screen.getByText(/bare link may have been pasted/i)).toBeVisible();
    expect(screen.getByText(/Organic traffic can also appear here/i)).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(screen.getByText(/An enquiry counts as one conversion/i)).toBeVisible();
  });

  it.each([[[]], [[creative('A', 0, 0)]]])('renders no clicks as an empty state: %j', creatives => {
    render(<CreativePerformanceTable performance={result(creatives)} />);
    expect(screen.getByText(/No tracked clicks yet/i)).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText(/floor, not a census/i)).toBeVisible();
  });
});
