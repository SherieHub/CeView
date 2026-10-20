/**
 * CARD — Performance: PES Gauge
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-2)
 * Pseudocode: pseudocode/module-4/pes-gauge.ts
 *
 * Renders the pre-computed PES score/label as a Recharts radial gauge, plus a
 * per-metric contribution-breakdown bar and the weighted-sum formula.
 *
 * Task 17: `score`/`label` are now server-authoritative when the shell has
 * one (from `POST /api/analytics/manual`'s `pes` field — the actual value
 * persisted to `tbl_campaign_records.pes_score`), falling back to
 * campaignMetrics.ts's computePes() otherwise (fixture runs, or a response
 * with no `pes`) — see CampaignAnalyticsView.tsx. This component itself is
 * unaware of the source; it just renders whatever score/label it's handed.
 *
 * The contribution-breakdown bar below is still client-derived: the server's
 * `pes.breakdown` gives {metric, weight, contribution} but no per-metric
 * `normalized` value, which the bar width needs, and inventing one
 * (normalized = contribution / weight) would just be re-deriving it a
 * different way — so this card independently re-derives each metric's
 * normalized value from raw `metrics` using the SAME formula/weights as
 * computePes() — the shell hands this component `metrics`, not a breakdown
 * array, specifically so this card can compute its own per-metric
 * contributions (see campaignTypes.ts's PesGaugeSlotProps doc comment and
 * campaignMetrics.ts's file header). The clamp bounds, normalization
 * denominators and weights below are therefore duplicated from
 * campaignMetrics.ts's computePes() on purpose, not imported — keep them in
 * sync by hand if that formula ever changes.
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

const GAUGE_SIZE = 148;

export default function PesGauge({ score, label, metrics }: PesGaugeSlotProps) {
  const clampedScore = clamp01(score);
  const tier = tierFor(clampedScore);
  const gaugeData = [{ value: clampedScore }];
  const contributions = computeContributions(metrics);

  return (
    <div className="card pes-card">
      <h3 className="pes-title">Performance Score</h3>

      <div className="pes-main">
        <div className="relative shrink-0" style={{ width: GAUGE_SIZE, height: GAUGE_SIZE }}>
          <RadialBarChart
            width={GAUGE_SIZE}
            height={GAUGE_SIZE}
            cx="50%"
            cy="50%"
            innerRadius="74%"
            outerRadius="100%"
            barSize={14}
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
            <span className="num pes-value" data-testid="pes-score-value">
              {clampedScore.toFixed(2)}
            </span>
            <span className="pes-outof">out of 1.00</span>
          </div>
        </div>
        <div className="pes-side">
          <p data-testid="pes-label" className={`pes-label ${TIER_TEXT_CLASS[tier]}`}>
            {label}
          </p>
          <p className="pes-explain">
            One score from five ad results, weighted by how much each matters to bookings.
          </p>
        </div>
      </div>

      {/* The working is there for anyone who wants it, closed by default so
          the score itself reads first. */}
      <details className="pes-details">
        <summary>How is my score calculated?</summary>
        <div className="pes-breakdown">
          {contributions.map((c) => (
            <div key={c.key} className="pes-row">
              <div className="pes-row-top">
                <span className="pes-row-name">
                  {c.label}{' '}
                  <span className="pes-row-weight">({c.weightPct}%)</span>
                </span>
                <span
                  data-testid={`pes-contribution-${c.key}`}
                  data-value={c.contribution}
                  className="num pes-row-value"
                >
                  {c.contribution.toFixed(3)}
                </span>
              </div>
              <div className="pes-bar">
                <i style={{ width: `${clamp01(c.normalized) * 100}%` }} />
              </div>
            </div>
          ))}
          <p data-testid="pes-formula" className="pes-formula">
            PES = ROAS×0.35 + CR×0.30 + CAC⁻¹×0.15 + CTR×0.15 + CPC⁻¹×0.05
          </p>
          <p className="pes-caveat">
            Each result is scaled to 0–1 against a target for Cebu tourism, then weighted. A good score is
            not the same as profit — check return on ad spend for that.
          </p>
        </div>
      </details>
    </div>
  );
}
