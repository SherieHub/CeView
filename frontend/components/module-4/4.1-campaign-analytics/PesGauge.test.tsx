import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PesGauge, { computeContributions } from './PesGauge';
import type { Metrics } from './campaignTypes';

// Mirrors campaignMetrics.test.ts's own metricsForNormalized helper: builds
// metrics so every normalized component equals `n` (CAC/CPC are
// inverse-good, so their raw values are constructed from (1 - n), not n
// directly). Since the 5 weights sum to 1.0, computePes's score for this
// input is exactly `n` — handy for deterministic label-band fixtures.
function metricsForNormalized(n: number): Metrics {
  return {
    roas: n * 8,
    convRate: n * 15,
    cac: 1 + (1 - n) * 4999,
    ctr: n * 10,
    cpc: 0.01 + (1 - n) * 499.99,
  };
}

function sumContributions(metrics: Metrics): number {
  return computeContributions(metrics).reduce((sum, c) => sum + c.contribution, 0);
}

describe('PesGauge', () => {
  it('renders the score value and the weighted-sum formula verbatim', () => {
    render(<PesGauge score={0.72} label="Good Performance" metrics={metricsForNormalized(0.72)} />);

    expect(screen.getByTestId('pes-score-value')).toHaveTextContent('0.72');
    expect(screen.getByTestId('pes-formula')).toHaveTextContent(
      'PES = ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05'
    );
  });

  it('renders the Poor Performance label band (score < 0.40)', () => {
    render(<PesGauge score={0.2} label="Poor Performance" metrics={metricsForNormalized(0.2)} />);
    expect(screen.getByTestId('pes-label')).toHaveTextContent('Poor Performance');
  });

  it('renders the Fair Performance label band (0.40 <= score < 0.60)', () => {
    render(<PesGauge score={0.5} label="Fair Performance" metrics={metricsForNormalized(0.5)} />);
    expect(screen.getByTestId('pes-label')).toHaveTextContent('Fair Performance');
  });

  it('renders the Good Performance label band (0.60 <= score < 0.80)', () => {
    render(<PesGauge score={0.7} label="Good Performance" metrics={metricsForNormalized(0.7)} />);
    expect(screen.getByTestId('pes-label')).toHaveTextContent('Good Performance');
  });

  it('renders the Excellent Performance label band (score >= 0.80)', () => {
    render(<PesGauge score={0.95} label="Excellent Performance" metrics={metricsForNormalized(0.95)} />);
    expect(screen.getByTestId('pes-label')).toHaveTextContent('Excellent Performance');
  });

  it('renders one contribution bar per weighted metric with the correct weight labels', () => {
    render(<PesGauge score={0.5} label="Fair Performance" metrics={metricsForNormalized(0.5)} />);

    expect(screen.getByTestId('pes-contribution-roas')).toBeInTheDocument();
    expect(screen.getByTestId('pes-contribution-cr')).toBeInTheDocument();
    expect(screen.getByTestId('pes-contribution-cac')).toBeInTheDocument();
    expect(screen.getByTestId('pes-contribution-ctr')).toBeInTheDocument();
    expect(screen.getByTestId('pes-contribution-cpc')).toBeInTheDocument();

    expect(screen.getByText('(35%)')).toBeInTheDocument(); // ROAS
    expect(screen.getByText('(30%)')).toBeInTheDocument(); // Conv. Rate
    expect(screen.getAllByText('(15%)')).toHaveLength(2); // CAC (Inv) + CTR
    expect(screen.getByText('(5%)')).toBeInTheDocument(); // CPC (Inv)
  });

  it('computeContributions sums to (approximately) the score for uniform-normalized metrics', () => {
    for (const n of [0, 0.25, 0.5, 0.75, 1]) {
      expect(sumContributions(metricsForNormalized(n))).toBeCloseTo(n, 5);
    }
  });

  it('computeContributions sums to (approximately) the score for non-uniform, realistic metrics', () => {
    const metrics: Metrics = { roas: 6, convRate: 9, cac: 1200, ctr: 4, cpc: 120 };
    const expectedScore =
      Math.min(1, 6 / 8) * 0.35 +
      Math.min(1, 9 / 15) * 0.3 +
      (1 - Math.min(1, (1200 - 1) / 4999)) * 0.15 +
      Math.min(1, 4 / 10) * 0.15 +
      (1 - Math.min(1, (120 - 0.01) / 499.99)) * 0.05;

    expect(sumContributions(metrics)).toBeCloseTo(expectedScore, 5);
  });

  it('the 5 rendered contribution values sum to (approximately) the score prop shown in the gauge', () => {
    const metrics = metricsForNormalized(0.63);
    render(<PesGauge score={0.63} label="Good Performance" metrics={metrics} />);

    const total = ['roas', 'cr', 'cac', 'ctr', 'cpc'].reduce((sum, key) => {
      const el = screen.getByTestId(`pes-contribution-${key}`);
      return sum + Number(el.getAttribute('data-value'));
    }, 0);

    expect(total).toBeCloseTo(0.63, 5);
  });
});
