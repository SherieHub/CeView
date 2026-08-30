import { describe, expect, it } from 'vitest';
import { computeMetrics, computePes } from './campaignMetrics';
import type { CampaignInput } from '@/types';
import type { Metrics } from './campaignTypes';

const BASE_INPUT: CampaignInput = {
  impressions: 95000,
  clicks: 2800,
  adSpend: 4000,
  revenue: 35000,
  conversions: 185,
  bookings: 112,
  newCustomers: 34,
};

describe('computeMetrics', () => {
  it('computes all 5 metrics with no flags when every denominator is non-zero', () => {
    const { metrics, flagged } = computeMetrics(BASE_INPUT);

    expect(flagged).toEqual([]);
    expect(metrics.ctr).toBeCloseTo((2800 / 95000) * 100, 5);
    expect(metrics.cpc).toBeCloseTo(4000 / 2800, 5);
    expect(metrics.convRate).toBeCloseTo((112 / 2800) * 100, 5);
    expect(metrics.roas).toBeCloseTo(35000 / 4000, 5);
    expect(metrics.cac).toBeCloseTo(4000 / 34, 5);
  });

  it('flags CTR and returns 0 when impressions is 0, without affecting other metrics', () => {
    const { metrics, flagged } = computeMetrics({ ...BASE_INPUT, impressions: 0 });

    expect(flagged).toEqual(['CTR']);
    expect(metrics.ctr).toBe(0);
    expect(metrics.roas).toBeCloseTo(35000 / 4000, 5);
  });

  it('flags CPC and Conversion rate (both clicks-denominated) when clicks is 0', () => {
    const { metrics, flagged } = computeMetrics({ ...BASE_INPUT, clicks: 0 });

    expect(flagged.sort()).toEqual(['CPC', 'Conversion rate'].sort());
    expect(metrics.cpc).toBe(0);
    expect(metrics.convRate).toBe(0);
    expect(metrics.ctr).toBe(0); // clicks is also CTR's numerator — 0 clicks means 0% CTR, not flagged
  });

  it('flags ROAS and returns 0 when adSpend is 0', () => {
    const { metrics, flagged } = computeMetrics({ ...BASE_INPUT, adSpend: 0 });

    expect(flagged).toEqual(['ROAS']);
    expect(metrics.roas).toBe(0);
    expect(metrics.cac).toBe(0); // adSpend is CAC's numerator — 0 adSpend means 0 CAC, not flagged
  });

  it('flags CAC and returns 0 when newCustomers is 0', () => {
    const { metrics, flagged } = computeMetrics({ ...BASE_INPUT, newCustomers: 0 });

    expect(flagged).toEqual(['CAC']);
    expect(metrics.cac).toBe(0);
  });
});

describe('computePes', () => {
  // CAC and CPC are inverse-good (lower raw value -> higher normalized score),
  // so to make every normalized component equal `n`, their raw values must be
  // constructed from (1 - n), not n directly.
  function metricsForNormalized(n: number): Metrics {
    return {
      roas: n * 8,
      convRate: n * 15,
      cac: 1 + (1 - n) * 4999,
      ctr: n * 10,
      cpc: 0.01 + (1 - n) * 499.99,
    };
  }

  it('computes the weighted-sum score for a mid-range input (all components at 0.5)', () => {
    const { score, label } = computePes(metricsForNormalized(0.5));

    expect(score).toBeCloseTo(0.5, 4);
    expect(label).toBe('Fair Performance');
  });

  it('caps the score at 1.0 when every metric exceeds its normalization bound', () => {
    const { score, label } = computePes(metricsForNormalized(1));

    expect(score).toBeCloseTo(1.0, 4);
    expect(label).toBe('Excellent Performance');
  });

  it('floors the score at 0.0 when every metric is at its worst', () => {
    const { score, label } = computePes(metricsForNormalized(0));

    expect(score).toBeCloseTo(0, 4);
    expect(label).toBe('Poor Performance');
  });

  it('labels exactly 0.40 as Fair (lower boundary, inclusive)', () => {
    const { score, label } = computePes(metricsForNormalized(0.4));
    expect(score).toBeCloseTo(0.4, 4);
    expect(label).toBe('Fair Performance');
  });

  it('labels exactly 0.60 as Good (lower boundary, inclusive)', () => {
    const { score, label } = computePes(metricsForNormalized(0.6));
    expect(score).toBeCloseTo(0.6, 4);
    expect(label).toBe('Good Performance');
  });

  it('labels exactly 0.80 as Excellent (lower boundary, inclusive)', () => {
    const { score, label } = computePes(metricsForNormalized(0.8));
    expect(score).toBeCloseTo(0.8, 4);
    expect(label).toBe('Excellent Performance');
  });

  it('labels just below 0.40 as Poor', () => {
    const { score, label } = computePes(metricsForNormalized(0.39));
    expect(score).toBeCloseTo(0.39, 4);
    expect(label).toBe('Poor Performance');
  });
});
