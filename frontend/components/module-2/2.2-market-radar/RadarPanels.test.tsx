/**
 * CARD — Market Radar Drawer: Directive & Demand Chart
 * CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs
 *
 * The two body slots. Recharts needs a real width to render, and jsdom reports
 * zero for everything, so these assert structure and copy rather than SVG
 * geometry — the charts themselves are checked in the browser.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DrawerChartPanel from './DrawerChartPanel';
import SeasonalPatternsTab, { seasonalityBand } from './SeasonalPatternsTab';
import PurchasingPowerTab from './PurchasingPowerTab';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import type { Market } from '@/types';

const korea = MOCK_MARKETS.find((m) => m.id === 'korea')!; // spikeIndicator: true
const market_gdp = (m: Market) => m.gdpTrend.map((g) => g.value);
const japan = MOCK_MARKETS.find((m) => m.id === 'japan')!; // spikeIndicator: false

describe('DrawerChartPanel — surge banner', () => {
  it('confirms a surge for a market that is spiking', () => {
    render(<DrawerChartPanel market={korea} timeframe="4WK" onTimeframeChange={vi.fn()} />);
    expect(screen.getByText(/Surge confirmed/)).toBeInTheDocument();
  });

  it('says so plainly when nothing is spiking', () => {
    render(<DrawerChartPanel market={japan} timeframe="4WK" onTimeframeChange={vi.fn()} />);

    expect(screen.getByText(/No active surge/)).toBeInTheDocument();
    expect(screen.queryByText(/Surge confirmed/)).not.toBeInTheDocument();
  });

  it('carries the market’s own directive, not a generic one', () => {
    render(<DrawerChartPanel market={korea} timeframe="4WK" onTimeframeChange={vi.fn()} />);
    expect(screen.getByText(korea.directive)).toBeInTheDocument();
  });

  it('reports the active timeframe and offers the other', () => {
    render(<DrawerChartPanel market={korea} timeframe="12WK" onTimeframeChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: '12WK' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '4WK' })).toHaveAttribute('aria-pressed', 'false');
  });

  // Each band has to say what to do about it, or the chart is just decoration.
  it('gives every demand zone a pricing action', () => {
    const { container } = render(
      <DrawerChartPanel market={korea} timeframe="4WK" onTimeframeChange={vi.fn()} />,
    );

    expect(container.querySelectorAll('.zone-key li')).toHaveLength(3);
    expect(screen.getByText('Discount to fill')).toBeInTheDocument();
    expect(screen.getByText('Hold rates')).toBeInTheDocument();
    expect(screen.getByText('Raise rates early')).toBeInTheDocument();
  });
});

describe('PurchasingPowerTab', () => {
  it('shows the four economic KPIs with the market’s own figures', () => {
    const { container } = render(<PurchasingPowerTab market={korea} />);

    const tiles = container.querySelectorAll('.stat-tile');
    expect(tiles).toHaveLength(4);
    // Scoped to the tiles: the sparklines below now print their own latest
    // value, which for forex is the same number as the KPI above it.
    const values = [...container.querySelectorAll('.stat-tile .stat-value')].map(
      (el) => el.textContent,
    );
    expect(values).toEqual([
      korea.forexValue.toFixed(2),
      `${korea.gdpValue}%`,
      korea.avgFlightPrice,
      `${korea.accessibilityScore}/10`,
    ]);
  });

  it('gives each sparkline its latest value and the range it moved through', () => {
    const { container } = render(<PurchasingPowerTab market={korea} />);

    const trends = container.querySelectorAll('.trend-now');
    expect(trends).toHaveLength(2);
    // A sparkline with no scale cannot say whether it moved 1% or 30%.
    const gdp = market_gdp(korea);
    expect(trends[1].textContent).toContain(`${gdp.at(-1)}%`);
    expect(trends[1].textContent).toContain(`${Math.min(...gdp)}%`);
    expect(trends[1].textContent).toContain(`${Math.max(...gdp)}%`);
  });

  it('carries the economic insight', () => {
    render(<PurchasingPowerTab market={korea} />);
    expect(screen.getByText(korea.economyInsight)).toBeInTheDocument();
  });
});

describe('seasonalityBand — the four thresholds', () => {
  it.each([
    [0.9, 'Strong'],
    [0.85, 'Strong'],
    [0.84, 'Moderate'],
    [0.7, 'Moderate'],
    [0.69, 'Weak — emerging'],
    [0.4, 'Weak — emerging'],
    [0.39, 'No seasonal basis'],
    [0, 'No seasonal basis'],
  ])('scores %s as "%s"', (score, band) => {
    expect(seasonalityBand(score as number)).toBe(band);
  });
});

describe('SeasonalPatternsTab', () => {
  it('marks only the market’s peak months', () => {
    const { container } = render(<SeasonalPatternsTab market={korea} />);

    expect(container.querySelectorAll('.month-grid li')).toHaveLength(12);
    const peaks = [...container.querySelectorAll('.month-grid li[data-peak="true"]')].map(
      (el) => el.textContent,
    );
    // Compared as a set: the grid runs Jan-Dec because it is a calendar, while
    // the fixture lists peaks in season order (Jul, Aug, Dec, Jan). Same months,
    // different and equally correct orderings.
    expect(new Set(peaks)).toEqual(new Set(korea.peakMonths));
  });

  // Below 59 weeks of history there is no prior year to compare against.
  // Printing a number there would imply a confirmation that has not happened.
  it('shows N/A rather than a number when there is no comparable year', () => {
    const noHistory: Market = { ...korea, yoyRatio: null };
    render(<SeasonalPatternsTab market={noHistory} />);

    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getByText(/not yet comparable/)).toBeInTheDocument();
  });

  it('reads a ratio at or above 1 as a repeat of last year', () => {
    render(<SeasonalPatternsTab market={korea} />); // 1.07
    expect(screen.getByText('Pattern repeated last year')).toBeInTheDocument();
  });

  it('reads a ratio below 1 as softer than last year', () => {
    render(<SeasonalPatternsTab market={{ ...korea, yoyRatio: 0.82 }} />);
    expect(screen.getByText('Softer than last year')).toBeInTheDocument();
  });
});
