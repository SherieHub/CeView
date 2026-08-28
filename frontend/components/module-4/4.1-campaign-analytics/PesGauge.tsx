/**
 * CARD — Performance: PES Gauge
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-2)
 * Pseudocode: pseudocode/module-4/pes-gauge.ts
 *
 * Renders the pre-computed PES score/label (from campaignMetrics.ts's
 * computePes(), called by the shell) as a Recharts radial gauge, plus a
 * per-metric contribution-breakdown bar and the weighted-sum formula.
 *
 * This card independently re-derives each metric's normalized value from raw
 * `metrics` using the SAME formula/weights as computePes() — the shell hands
 * this component `metrics`, not a breakdown array, specifically so this card
 * can compute its own per-metric contributions (see campaignTypes.ts's
 * PesGaugeSlotProps doc comment and campaignMetrics.ts's file header). The
 * clamp bounds, normalization denominators and weights below are therefore
 * duplicated from campaignMetrics.ts's computePes() on purpose, not imported
 * — keep them in sync by hand if that formula ever changes.
 *
 * Gauge implementation note: RadialBarChart is used with fixed pixel
 * width/height instead of wrapped in Recharts' ResponsiveContainer. This
 * single small gauge doesn't need fluid resizing, and ResponsiveContainer's
 * measurement relies on ResizeObserver, which jsdom (this repo's test
 * environment) doesn't provide — with a percentage-based container it would
 * render nothing at all in tests. Fixed numeric width/height sidesteps that
 * entirely (recharts computes fixed dimensions synchronously, no DOM
 * measurement needed) while still being simplest to read.
 */
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import type { Metrics, PesGaugeSlotProps } from './campaignTypes';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

type Tier = 'excellent' | 'good' | 'fair' | 'poor';

function tierFor(score: number): Tier {
  if (score >= 0.8) return 'excellent';
  if (score >= 0.6) return 'good';
  if (score >= 0.4) return 'fair';
  return 'poor';
}

// No dedicated "warning/amber" token exists in the brand system yet (see the
// tourism-app-branding skill and styles/index.css's token block), so the 4
// tiers borrow the closest existing brand-approved tokens rather than
// inventing a new one: the two semantic state tokens (success/critical) for
// the best/worst tiers, mint-primary (core brand accent) for Good, and sand
// (existing warm secondary accent) standing in for a "caution" tone for Fair.
// Written as full literal class strings (not built via template
// interpolation) so Tailwind's static scanner can find and generate them.
const TIER_TEXT_CLASS: Record<Tier, string> = {
  excellent: 'text-[var(--color-success)]',
  good: 'text-[var(--color-mint-primary)]',
  fair: 'text-[var(--color-sand)]',
  poor: 'text-[var(--color-critical)]',
};

const TIER_FILL: Record<Tier, string> = {
  excellent: 'var(--color-success)',
  good: 'var(--color-mint-primary)',
  fair: 'var(--color-sand)',
  poor: 'var(--color-critical)',
};

interface Contribution {
  key: string;
  label: string;
  weightPct: number;
  normalized: number;
  contribution: number;
}

/**
 * Per-metric normalization + contribution, duplicated from
 * campaignMetrics.ts's computePes() (see file header). Exported so the test
 * file can assert the breakdown sums back to the shell's `score` without
 * scraping rounded display text.
 */
export function computeContributions(metrics: Metrics): Contribution[] {
  const specs: { key: string; label: string; weightPct: number; normalized: number }[] = [
    { key: 'roas', label: 'ROAS', weightPct: 35, normalized: clamp01(metrics.roas / 8) },
    { key: 'cr', label: 'Conv. Rate', weightPct: 30, normalized: clamp01(metrics.convRate / 15) },
    { key: 'cac', label: 'CAC (Inv)', weightPct: 15, normalized: 1 - clamp01((metrics.cac - 1) / (5000 - 1)) },
    { key: 'ctr', label: 'CTR', weightPct: 15, normalized: clamp01(metrics.ctr / 10) },
    { key: 'cpc', label: 'CPC (Inv)', weightPct: 5, normalized: 1 - clamp01((metrics.cpc - 0.01) / (500 - 0.01)) },
  ];
  return specs.map((s) => ({ ...s, contribution: s.normalized * (s.weightPct / 100) }));
}

const GAUGE_SIZE = 200;

export default function PesGauge({ score, label, metrics }: PesGaugeSlotProps) {
  const clampedScore = clamp01(score);
  const tier = tierFor(clampedScore);
  const gaugeData = [{ value: clampedScore }];
  const contributions = computeContributions(metrics);

  return (
    <div className="card flex flex-col gap-6">
      <h3 className="heading-md">Performance Score</h3>

      <div className="flex flex-col items-center gap-3">
        <div className="relative" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
          <RadialBarChart
            width={GAUGE_SIZE}
            height={GAUGE_SIZE}
            cx="50%"
            cy="50%"
            innerRadius="72%"
            outerRadius="100%"
            barSize={18}
            data={gaugeData}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 1]} angleAxisId={0} tick={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={999}
              fill={TIER_FILL[tier]}
              background={{ fill: 'var(--color-mint-pale)' }}
              isAnimationActive={false}
            />
          </RadialBarChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="num heading-xl" data-testid="pes-score-value">
              {clampedScore.toFixed(2)}
            </span>
            <span className="body-xs">out of 1.00</span>
          </div>
        </div>
        <p data-testid="pes-label" className={`heading-sm text-center ${TIER_TEXT_CLASS[tier]}`}>
          {label}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-meta font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Contribution breakdown
        </h4>
        {contributions.map((c) => (
          <div key={c.key} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="body-sm font-semibold text-[var(--color-text-heading)]">
                {c.label}{' '}
                <span className="body-xs text-[var(--color-text-muted)]">({c.weightPct}%)</span>
              </span>
              <span
                data-testid={`pes-contribution-${c.key}`}
                data-value={c.contribution}
                className="num body-sm font-semibold text-[var(--color-text-heading)]"
              >
                {c.contribution.toFixed(3)}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-pill bg-[var(--color-mint-pale)]">
              <div
                className="h-full rounded-pill bg-[var(--color-mint-primary)]"
                style={{ width: `${clamp01(c.normalized) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p data-testid="pes-formula" className="body-xs text-[var(--color-text-muted)]">
        PES = ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05
      </p>
    </div>
  );
}
