/**
 * CARD — Performance: KPI Cards & Flagged Metrics
 * Depends on: Foundation — Performance Shell & Ingestion (M4-F)
 * Plan: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/05-module-4.md (M4-1)
 * Prototype reference: pct(value, benchmark) calls — ui-ux-prototype.html:3941-3945
 *
 * The shell (M4-F) mounts 5 of these, one per metric, each with its own
 * {label, value} — this is NOT the KpiSlotProps bundle FlaggedMetricBanner
 * takes.
 *
 * Previously this compared `value` against a fixed per-metric benchmark
 * table (ported from the prototype) to render an "up X% / down X%" trend
 * badge — the same benchmark for every operator regardless of business,
 * market, or currency, so the badge was a hardcoded number dressed up as a
 * real trend. There is no per-business or cohort baseline anywhere in the
 * system to compare against honestly, so the badge is dropped rather than
 * kept pointing at a fabricated reference — see the same "honest zero over
 * fake data" precedent in MetricsCalculationService.defaultMetrics().
 */
interface KpiCardProps {
  label: string;
  value: number;
}

export default function KpiCard({ label, value }: KpiCardProps) {
  const formattedValue = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="card flex h-full flex-col gap-2">
      <span className="eyebrow">{label}</span>
      <span className="num heading-lg">{formattedValue}</span>
    </div>
  );
}
