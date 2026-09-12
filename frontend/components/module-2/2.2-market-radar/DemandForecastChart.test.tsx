/**
 * CARD — Market Radar Drawer: Directive & Demand Chart
 *
 * Step 19 (C-14): the tooltip used to label every series "Demand", so
 * Observed and Forecast were indistinguishable, and the chart always implied
 * exactly 12 weeks of history even when the backend had stopped padding
 * short series with synthetic points.
 *
 * Recharts needs a real width to render and jsdom reports zero for
 * everything, and a Tooltip's content is hover-gated (unreliable to trigger
 * in jsdom) — so, matching RadarPanels.test.tsx's established approach, this
 * asserts the always-rendered Legend text and the history-count note, and
 * unit-tests the date-range formatter directly rather than simulating a hover.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DemandForecastChart, {
  DemandForecastTooltip,
  formatWeekRange,
  weekOffsetFromLabel,
} from './DemandForecastChart';
import { MOCK_MARKETS } from '../../../services/fixtures/markets';
import type { ChartDataPoint } from '@/types';

const korea = MOCK_MARKETS.find((m) => m.id === 'korea')!;

describe('DemandForecastTooltip', () => {
  it('identifies observed and forecast values separately under the actual ISO-week date range', () => {
    render(
      <DemandForecastTooltip
        active
        label="Current"
        payload={[
          { name: 'Observed', value: 64.4, color: '#000', payload: { weekStartDate: '2026-08-24' } },
          { name: 'Forecast', value: 70.2, color: '#000', payload: { weekStartDate: '2026-08-24' } },
        ]}
      />,
    );

    expect(screen.getByText('Current (Aug 24–Aug 30)')).toBeInTheDocument();
    expect(screen.getByText('Observed: 64')).toBeInTheDocument();
    expect(screen.getByText('Forecast: 70')).toBeInTheDocument();
  });
});

describe('DemandForecastChart — history count note', () => {
  it('reports the full 12 weeks when the fixture has a full history', () => {
    render(<DemandForecastChart data={korea.chartData} timeframe="4WK" />);
    expect(screen.getByText('12 weeks of history')).toBeInTheDocument();
  });

  // Step 19: the backend no longer pads short history with synthetic points —
  // a market with only 4 real weeks must say so, not silently claim 12.
  it('reports a short history honestly instead of implying a full 12 weeks', () => {
    const shortHistory: ChartDataPoint[] = [
      ...korea.chartData.filter((d) => d.history !== null).slice(-4),
      ...korea.chartData.filter((d) => d.forecast !== null && d.history === null),
    ];

    render(<DemandForecastChart data={shortHistory} timeframe="4WK" />);

    expect(screen.getByText('4 weeks of history')).toBeInTheDocument();
    expect(screen.queryByText('12 weeks of history')).not.toBeInTheDocument();
  });

  it('pluralises correctly for exactly one week of history', () => {
    const oneWeek: ChartDataPoint[] = [
      ...korea.chartData.filter((d) => d.history !== null).slice(-1),
      ...korea.chartData.filter((d) => d.forecast !== null && d.history === null),
    ];

    render(<DemandForecastChart data={oneWeek} timeframe="4WK" />);

    expect(screen.getByText('1 week of history')).toBeInTheDocument();
  });
});

describe('formatWeekRange / weekOffsetFromLabel', () => {
  it('parses relative week labels into a signed offset', () => {
    expect(weekOffsetFromLabel('Current')).toBe(0);
    expect(weekOffsetFromLabel('Wk -3')).toBe(-3);
    expect(weekOffsetFromLabel('Wk +2')).toBe(2);
  });

  it('computes the exact Monday-through-Sunday ISO week range', () => {
    expect(formatWeekRange('2026-08-24')).toBe('Aug 24–Aug 30');
  });

  it('returns null when the row has no ISO week start date', () => {
    expect(formatWeekRange(null)).toBeNull();
  });
});
