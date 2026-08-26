/**
 * CARD — Performance: KPI Cards & Flagged Metrics
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-1)
 * Prototype reference: pct(value, benchmark) calls — ui-ux-prototype.html:3941-3945
 *
 * The shell (M4-F) mounts 5 of these, one per metric, each with its own
 * {label, value, inverseGood} — this is NOT the KpiSlotProps bundle
 * FlaggedMetricBanner takes.
 *
 * `value` alone carries no benchmark, so a fixed per-metric benchmark table
 * (ported from the prototype's pct() call sites) is keyed by `label`:
 * trendPct = ((value - benchmark) / benchmark) * 100 (0 if benchmark is 0,
 * guarding the divide-by-zero).
 *
 * For an inverseGood metric (CPC, CAC) a lower value is the improvement, so
 * "good" is trendPct <= 0 there instead of >= 0 — at the same raw trendPct
 * sign, the arrow/colour for an inverse metric is the opposite of a normal
 * one. This intentionally also covers the flagged-metric case (value 0):
 * the same formula applies with no special-casing, so a flagged inverse
 * metric renders "0.00" with an "up" (good) indicator, exactly as any other
 * value at/below its benchmark would.
 */
import { ArrowDown, ArrowUp } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: number;
  inverseGood?: boolean;
}

const BENCHMARKS: Record<string, number> = {
  CTR: 2.5,
  CPC: 2.0,
  ROAS: 5.0,
  CR: 4.5,
  CAC: 150,
};

export default function KpiCard({ label, value, inverseGood = false }: KpiCardProps) {
  const benchmark = BENCHMARKS[label] ?? 0;
  const trendPct = benchmark === 0 ? 0 : ((value - benchmark) / benchmark) * 100;
  const isGood = inverseGood ? trendPct <= 0 : trendPct >= 0;
  const formattedValue = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="card flex h-full flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <span className="num heading-lg">{formattedValue}</span>
      <span
        data-testid="kpi-trend"
        data-direction={isGood ? 'up' : 'down'}
        className={`inline-flex w-fit items-center gap-1 rounded-pill px-2 py-0.5 text-meta font-semibold ${
          isGood ? 'bg-success-bg text-success' : 'bg-critical-bg text-critical'
        }`}
      >
        {isGood ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        <span className="num">{Math.abs(trendPct).toFixed(1)}%</span>
      </span>
    </div>
  );
}
