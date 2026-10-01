/**
 * CARD — Foundation: Performance Shell & Ingestion
 * Depends on: Foundation — Shell & Routing, Foundation — Fixture Data Layer
 * Prototype reference: computeMetrics() / computePes() — ui-ux-prototype.html:3882-3916
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-F)
 *
 * Ported verbatim from the prototype's formula (zero-guard divisions,
 * min-max normalization bounds, weights) — the pseudocode gives the function
 * shape, the prototype is ground truth for the literal constants. Unlike the
 * prototype, computePes() here returns only {score, label}, no breakdown
 * array — PesGaugeSlotProps hands the PES Gauge card (M4-2) raw `metrics` to
 * derive its own contribution bars from.
 */
import type { CampaignInput } from '@/types';
import type { Metrics, FlaggedMetric } from './campaignTypes';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function computeMetrics(input: CampaignInput): { metrics: Metrics; flagged: FlaggedMetric[] } {
  const flagged: FlaggedMetric[] = [];

  function div(a: number, b: number, label: FlaggedMetric): number {
    if (!b) {
      flagged.push(label);
      return 0;
    }
    return a / b;
  }

  const metrics: Metrics = {
    ctr: div(input.clicks, input.impressions, 'CTR') * 100,
    cpc: div(input.adSpend, input.clicks, 'CPC'),
    convRate: div(input.bookings, input.clicks, 'Conversion rate') * 100,
    roas: div(input.revenue, input.adSpend, 'ROAS'),
    cac: div(input.adSpend, input.newCustomers, 'CAC'),
  };

  return { metrics, flagged };
}

const WEIGHTS = { ROAS: 0.35, CR: 0.3, CAC: 0.15, CTR: 0.15, CPC: 0.05 } as const;

export function computePes(metrics: Metrics): { score: number; label: string } {
  const normalized = {
    ROAS: clamp01(metrics.roas / 8),
    CR: clamp01(metrics.convRate / 15),
    CAC: 1 - clamp01((metrics.cac - 1) / (5000 - 1)),
    CTR: clamp01(metrics.ctr / 10),
    CPC: 1 - clamp01((metrics.cpc - 0.01) / (500 - 0.01)),
  };

  const score = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce(
    (sum, key) => sum + normalized[key] * WEIGHTS[key],
    0
  );

  const label =
    score >= 0.8 ? 'Excellent Performance' :
    score >= 0.6 ? 'Good Performance' :
    score >= 0.4 ? 'Fair Performance' :
    'Poor Performance';

  return { score, label };
}
